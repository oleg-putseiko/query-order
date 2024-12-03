type Some<T, K extends keyof T = keyof T> = Partial<T> &
  { [X in K]: Required<Pick<T, X>> }[K];

type NonEmptyArray<I> = [I, ...I[]];

type QueryOrderConfig = {
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

type QueryFunction = () => unknown | Promise<unknown>;

type Query = {
  func: QueryFunction;
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
