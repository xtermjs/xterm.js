---
applyTo: '**/*.benchmark.ts'
---
# Benchmark run instructions

- Full suite: `npm run benchmark`
- Single benchmark file:
  - Tree: `npm run benchmark -- -t out-test/benchmark/Event.benchmark.js`
  - Run file: `npm run benchmark -- -s "out-test/benchmark/Event.benchmark.js" out-test/benchmark/Event.benchmark.js`
- Single context/case:
  - Use `-t` to get the path, then:
  - `npm run benchmark -- -s "<path>" out-test/benchmark/Event.benchmark.js`

When writing instructions, use `RuntimeCase` to measure pure runtime in ms, use `ThroughputRuntimeCase` when measuring throughput in MB/s.

Notes:
- Benchmarks run from built JS in `out-test/benchmark/*.benchmark.js`.
- Keep `NODE_PATH=./out` (handled by the npm script).
