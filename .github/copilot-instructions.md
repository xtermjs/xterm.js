This is a TypeScript-based repository with a Ruby client for certain API endpoints. It includes several sub projects called addons which are built separately. It contains a demo application which showcases the functionality of the project.

Please follow these guidelines when contributing:

## Development Flow

- Install dependencies: `npm install && npm run setup`
- Build and bundle demo: `npm run build && npm run esbuild`

## Unit tests

Unit tests are run with `yarn test-unit`:

```sh
# All unit tests
yarn test-unit

# Absolute file path
yarn test-unit out-esbuild/browser/Terminal.test.js

# Filter by wildcard
yarn test-unit out-esbuild/**/Terminal.test.js

# Specific addon unit tests tests
yarn test-unit addons/addon-image/out-esbuild/*.test.js

# Multiple files
yarn test-unit out-esbuild/**/Terminal.test.js out-esbuild/**/InputHandler.test.js
```

These use mocha to run all `.test.js` files within the esbuild output (`out-esbuild/`).

## Integration tests

Integration tests are run with `yarn test-integration`:

```sh
# All integration tests
yarn test-integration

# Core integration tests
yarn test-integration --suite=core

# Specific addon integration tests
yarn test-integration --suite=addon-search
```

These use `@playwright/test` to run all tests within the esbuild test output (`out-esbuild-test/`).
