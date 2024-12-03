type Some<T, K extends keyof T = keyof T> = Partial<T> &
  { [X in K]: Required<Pick<T, X>> }[K];

type NonEmptyArray<I> = [I, ...I[]];

export type QueryOrderConfig = {
  /**
   * Determines the maximum number of queries in the queue.
   *
   * When adding queries in excess of the limit, those that were previously added
   * will be removed from the queue in FIFO order.
   *
   * @default Infinite
   */
  max?: number;

  /**
   * Determines whether to yield to the main thread after completing each query except the last one.
   *
   * @default false
   */
  shouldYieldAfterEach?: boolean;
};

export type QueryFunction = () => unknown | Promise<unknown>;

export type Query = {
  /**
   * A query function executed in an order.
   */
  func: QueryFunction;

  /**
   * Determines whether to yield to the main thread after completing a query.
   * Does not apply to the last query in the order.
   *
   * If not defined, the value of the `shouldYieldAfterEach` property from the order configuration
   * will be taken into account instead.
   *
   * @default undefined
   */
  shouldYieldAfter?: boolean;
};

type OrderedQuery = Query & {
  isPending: boolean;
};

const yieldToMainThread = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const ensurePromise = (func: QueryFunction) => {
  return new Promise((resolve) => {
    resolve(func());
  });
};

export class QueryOrder {
  protected readonly _config: Required<QueryOrderConfig>;
  protected readonly _queries: OrderedQuery[] = [];

  constructor(config?: Some<QueryOrderConfig>) {
    this._config = {
      max: Infinity,
      shouldYieldAfterEach: false,
      ...config,
    };
  }

  /**
   * Adds one or more queries to the queue in the order in which they are passed.
   *
   * @param queries list of queries added to the queue.
   * @returns current instance of the class.
   */
  add(...queries: NonEmptyArray<QueryFunction | Query>): QueryOrder {
    if (this._queries.length + queries.length > this._config.max) {
      this._removeFirstInactiveQueries(
        this._queries.length + queries.length - this._config.max,
      );
    }

    this._queries.push(
      ...queries.map((query) => {
        if (query instanceof Function) return { func: query, isPending: false };
        return { ...query, isPending: false };
      }),
    );

    return this;
  }

  /**
   * Starts a queue of added queries.
   *
   * While this method is running, queries can still be added to the queue,
   * except that an active one cannot be removed from it.
   */
  async start(): Promise<void> {
    const query = this._queries[0];

    if (query !== undefined && !query.isPending) {
      query.isPending = true;

      await ensurePromise(query.func).finally(() => {
        this._queries.shift();

        if (this._queries.length <= 0) return;

        if (query.shouldYieldAfter ?? this._config.shouldYieldAfterEach) {
          yieldToMainThread();
        }

        return this.start();
      });
    }
  }

  protected _removeFirstInactiveQueries(count: number): void {
    for (let i = 0; i < count; i++) {
      const indexToBeRemoved = this._queries.findIndex(
        (query) => !query.isPending,
      );

      this._queries.splice(indexToBeRemoved, 1);
    }
  }
}

// eslint-disable-next-line no-restricted-exports
export default QueryOrder;
