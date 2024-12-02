/**
 * @type {import('eslint').ESLint.ConfigData}
 */
module.exports = {
  root: true,
  extends: ['woofmeow', 'woofmeow/typescript'],
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
