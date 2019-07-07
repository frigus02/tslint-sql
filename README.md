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

## TODO

- Generate database schema JSON file

  https://github.com/SweetIQ/schemats/blob/7c3d3e16b5d507b4d9bd246794e7463b05d20e75/src/schemaPostgres.ts#L17-L93

- Generate and check for types returned by query.

  ```ts
  interface Query<T> {
    text: string;
    values: any[];
  }

  const sql = <T>(
    strings: TemplateStringsArray,
    ...values: any[]
  ): Query<T> => ({
    text: String.raw(strings, ...values.map((_, i) => `$${i + 1}`)),
    values
  });

  interface UserDetails {
    name: string;
    age: string;
    hobbies: string[];
    email: string;
  }

  const getUserDetails = (userId: string) => sql<UserDetails>`
    SELECT
      name,
      age,     -- Error: is 'number' in schema but 'string' in type
      hobbies
               -- Error: is 'email' is required in type but not present in query
    FROM
      users
    WHERE
      user_id = ${userId}
  `;
  ```
