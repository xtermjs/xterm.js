// @ts-check
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'addons/*/src/third-party/*.ts',
      'src/vs/*',
      '**/out/*',
      '**/out-test/*',
      '**/out-esbuild/*',
      '**/out-esbuild-test/*',
      '**/inwasm-sdks/*',
      '**/typings/*.d.ts',
      '**/node_modules',
      '**/*.js',
      '**/*.mjs'
    ]
  },
  {
    files: ['**/*.ts'],
    plugins: {
      '@stylistic': stylistic,
      jsdoc
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@stylistic/indent': ['warn', 2],
      '@stylistic/semi': ['warn', 'always'],
      '@stylistic/quotes': ['warn', 'single', { allowTemplateLiterals: true }],
      '@stylistic/member-delimiter-style': ['warn', {
        multiline: { delimiter: 'semi', requireLast: true },
        singleline: { delimiter: 'comma', requireLast: false }
      }],
      '@stylistic/type-annotation-spacing': 'warn',

      '@typescript-eslint/array-type': ['warn', { default: 'array', readonly: 'generic' }],
      '@typescript-eslint/consistent-type-assertions': 'warn',
      '@typescript-eslint/consistent-type-definitions': 'warn',
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/explicit-member-accessibility': ['warn', { accessibility: 'explicit', overrides: { constructors: 'off' } }],
      '@typescript-eslint/naming-convention': [
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
      ],
      '@typescript-eslint/no-confusing-void-expression': ['warn', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-useless-constructor': 'warn',
      '@typescript-eslint/prefer-namespace-keyword': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { vars: 'all', args: 'none' }],
      '@typescript-eslint/no-require-imports': 'off',
      // Added in eslint upgrade, new defaults
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-namespace': 'off',
      // Allow duplicates for bit field constants
      '@typescript-eslint/no-duplicate-enum-values': 'off',

      'curly': ['warn', 'multi-line'],
      'eol-last': 'warn',
      'eqeqeq': ['warn', 'always'],
      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-param-names': 'warn',
      'jsdoc/no-multi-asterisks': 'warn',
      'keyword-spacing': 'warn',
      'max-len': ['warn', {
        code: 1000,
        comments: 100,
        ignoreTrailingComments: true,
        ignoreUrls: true,
        ignorePattern: '^ *((?<vt_comment>(//|\\*) @vt)|(?<table_comment>\\* \\| )|(?<commented_code>//  ))'
      }],
      'new-parens': 'warn',
      'no-duplicate-imports': 'warn',
      'no-else-return': ['warn', { allowElseIf: false }],
      'no-eval': 'warn',
      'no-extra-semi': 'error',
      'no-irregular-whitespace': 'warn',
      'no-restricted-imports': ['warn', { patterns: ['.*\\/out\\/.*'] }],
      'no-restricted-syntax': [
        'warn',
        { selector: "CallExpression[callee.name='requestAnimationFrame']", message: 'The global requestAnimationFrame() should be avoided, call it on the parent window from ICoreBrowserService.' },
        { selector: "CallExpression[callee.name='cancelAnimationFrame']", message: 'The global cancelAnimationFrame() should be avoided, call it on the parent window from ICoreBrowserService.' },
        { selector: "CallExpression > MemberExpression[object.name='window'][property.name='requestAnimationFrame']", message: 'window.requestAnimationFrame() should be avoided, call it on the parent window from ICoreBrowserService.' },
        { selector: "CallExpression > MemberExpression[object.name='window'][property.name='cancelAnimationFrame']", message: 'window.cancelAnimationFrame() should be avoided, call it on the parent window from ICoreBrowserService.' },
        { selector: "MemberExpression[object.name='window'][property.name='devicePixelRatio']", message: 'window.devicePixelRatio should be avoided, get it from ICoreBrowserService.' }
      ],
      'no-trailing-spaces': 'warn',
      'no-unsafe-finally': 'warn',
      'no-unused-vars': 'off',
      'no-var': 'warn',
      'one-var': ['warn', 'never'],
      'no-empty': 'off',
      'no-empty-pattern': 'off',
      'no-cond-assign': 'off',
      'no-case-declarations': 'off',
      'for-direction': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
      'no-self-assign': 'off',
      'no-async-promise-executor': 'off',
      'prefer-rest-params': 'off',
      'no-control-regex': 'off',
      'no-fallthrough': 'off',
      'prefer-spread': 'off',
      'object-curly-spacing': ['warn', 'always'],
      'prefer-const': 'warn',
      'spaced-comment': ['warn', 'always', { markers: ['/'], exceptions: ['-'] }]
    }
  },
  {
    files: ['**/*.api.ts', '**/*.test.ts'],
    rules: {
      'object-curly-spacing': 'off',
      'max-len': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off'
    }
  }
);
