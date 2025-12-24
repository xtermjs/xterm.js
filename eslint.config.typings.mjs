// @ts-check
import stylistic from '@stylistic/eslint-plugin';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['typings/**/*.d.ts'],
    plugins: {
      '@stylistic': stylistic,
      '@typescript-eslint': tseslint.plugin,
      jsdoc
    },
    languageOptions: {
      parser: tseslint.parser
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
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'interface', format: ['PascalCase'], prefix: ['I'] }
      ],
      '@typescript-eslint/prefer-namespace-keyword': 'warn',

      'comma-dangle': ['warn', { objects: 'never', arrays: 'never', functions: 'never' }],
      'curly': ['warn', 'multi-line'],
      'eol-last': 'warn',
      'eqeqeq': ['warn', 'always'],
      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-param-names': 'warn',
      'keyword-spacing': 'warn',
      'max-len': ['warn', {
        code: 1000,
        comments: 80,
        ignoreUrls: true,
        ignorePattern: '^ *(?<ps_description>\\* Ps=)'
      }],
      'no-extra-semi': 'error',
      'no-irregular-whitespace': 'warn',
      'no-trailing-spaces': 'warn',
      'object-curly-spacing': ['warn', 'always'],
      'spaced-comment': ['warn', 'always', { markers: ['/'], exceptions: ['-'] }]
    }
  }
);
