# TSLint SQL

TSLint rule to validate SQL queries written inside tagged template literals.

:construction: This is only an experiment :construction:

## Usage

Only runs on Linux and macOS because of a dependency on [libpg_query](https://github.com/lfittl/libpg_query). To develop on Windows, use Docker (`yarn docker` and `yarn docker:attach`).

### Setup

```sh
# Install dependencies
yarn

# Generate typings for pg-query-native
yarn generate

# Compile
yarn compile --watch
```

### Test

```sh
# Run query analysis on some test queries
node build/index.js

# Test TSLint rule
yarn test:rules
```
