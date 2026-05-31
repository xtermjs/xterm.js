// @ts-check
import tseslint from 'typescript-eslint';

const ignores = [
  'addons/*/src/third-party/*.ts',
  '**/out/*',
  '**/out-test/*',
  '**/out-esbuild/*',
  '**/out-esbuild-test/*',
  '**/inwasm-sdks/*',
  '**/node_modules',
  '**/*.js',
  '**/*.mjs'
];

const namingConventionMain = [
  'warn',
  { selector: 'default', format: ['camelCase'], filter: { regex: '^[a-z]', match: true } },
  { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
  { selector: 'variable', filter: '^I.+Service$', format: ['PascalCase'], prefix: ['I'] },
  { selector: 'memberLike', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'require' },
  { selector: 'memberLike', modifiers: ['protected'], format: ['camelCase'], leadingUnderscore: 'require' },
  { selector: 'enumMember', format: ['UPPER_CASE'] },
  { selector: 'property', modifiers: ['public'], format: ['camelCase', 'UPPER_CASE'], filter: { regex: '^[a-z]', match: true } },
  { selector: 'method', modifiers: ['public'], format: ['camelCase', 'UPPER_CASE'], custom: { regex: '^on[A-Z].+', match: false } },
  { selector: 'method', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'require', custom: { regex: '^on[A-Z].+', match: false } },
  { selector: 'method', modifiers: ['protected'], format: ['camelCase'], leadingUnderscore: 'require', custom: { regex: '^on[A-Z].+', match: false } },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'interface', format: ['PascalCase'], prefix: ['I'] }
];

const namingConventionTypings = [
  'warn',
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'interface', format: ['PascalCase'], prefix: ['I'] }
];

export default tseslint.config(
  {
    ignores
  },
  {
    files: ['**/*.ts'],
    ignores: ['typings/**/*.d.ts', 'addons/**/typings/**'],
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/naming-convention': namingConventionMain
    }
  },
  {
    files: ['typings/**/*.d.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    languageOptions: {
      parser: tseslint.parser
    },
    rules: {
      '@typescript-eslint/naming-convention': namingConventionTypings
    }
  }
);
