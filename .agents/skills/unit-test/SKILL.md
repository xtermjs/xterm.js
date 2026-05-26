---
name: unit-test
description: Write and review xterm.js unit tests with project conventions. Use when editing `*.test.ts` files or when asked for test authoring guidelines.
---

# Unit Test Instructions

When writing unit tests, follow these rules:

- When writing unit tests for addons, always create a real xterm.js instance instead of mocking it.
- Prefer `assert.ok` over `assert.notStrictEqual` when checking something is undefined or not.
- Avoid comments as most tests should be self-documenting.
