declare module 'eslint-config-prettier' {
  import type { Linter } from 'eslint';

  const eslintConfigPrettier: {
    rules: Linter.RulesRecord;
  };

  export default eslintConfigPrettier;
}
