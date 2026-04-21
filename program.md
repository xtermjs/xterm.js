# slim-forge: xterm.js parser perf

An experiment to autonomously speed up xterm.js's `EscapeSequenceParser`, the terminal escape sequence parser inside VS Code, GitHub Codespaces, and most web-based terminals.

## Setup

1. **Confirm the workspace**: fresh clone of `xtermjs/xterm.js`. Branch should be `autoresearch/xterm-<date>`. Verify: `git status`, `git log --oneline -5`.
2. **Read the in-scope files**:
   * `src/common/parser/EscapeSequenceParser.ts` — ~845 LOC. **THIS is what you optimize.** The main `parse()` method is the hot loop. Read the whole file.
   * `src/common/parser/Params.ts` — parameter accumulation. Called from the PARAM action in the main loop. Secondary surface.
   * `src/common/parser/Constants.ts` — `ParserState` and `ParserAction` enums.
   * `src/common/parser/EscapeSequenceParser.test.ts` — ~2236 LOC of tests. Read before making changes.
   * `bench/workload.js` — the benchmark. **Do NOT modify.**
   * `run.py` — the harness. **Do NOT modify.**
   * `program.md` — this file.
3. **Verify baseline exists**: `cat results.tsv`. One row, `baseline`, with a `mbps` value and `tests_pass: 1`.
4. **Confirm and go.**

## Mission

Primary metric: **`mbps`** — weighted throughput in MB/s across 5 representative terminal workloads (plain ASCII print, SGR-heavy colored output, cursor movement sequences, parameter-heavy truecolor, mixed realistic git-log-style output). Higher is better.

Hard gates:
1. `npm run test-unit` passes (2261 mocha tests, ~6s).
2. The harness enforces `mbps > best_so_far * 1.05` for a row to be labeled `keep`.

## Important: build pipeline

xterm.js is TypeScript. Your edits go in `src/`. The build pipeline is:

```
npm run build     # tsc: src/**/*.ts -> out/**/*.js
npm run esbuild   # esbuild: out/ -> out-esbuild/ (what tests and bench consume)
```

`run.py` handles this automatically. But if you want to test manually:
```
npm run build && npm run esbuild && npm run test-unit && node bench/workload.js
```

The agent edits `.ts` source. The bench runs against compiled `.js` in `out-esbuild/`. If your edit has a TS type error, `npm run build` fails and the experiment is `discard`.

## What you CAN do

* Edit `src/common/parser/EscapeSequenceParser.ts` — the main target.
* Edit `src/common/parser/Params.ts` — if parameter handling is the bottleneck.
* Edit `src/common/parser/OscParser.ts`, `DcsParser.ts`, `ApcParser.ts` — if those sub-parsers show up in the bench.
* Add internal helper functions or restructure the parse loop.

## What you CANNOT do

* Modify `src/common/parser/EscapeSequenceParser.test.ts` or any test file.
* Modify `bench/workload.js` or `run.py`.
* Modify `program.md`.
* Modify the `TransitionTable` initialization — the VT500 table is the spec-correct state machine. Changing transitions changes which sequences are recognized, which is a correctness violation even if tests pass.
* Cache parse results across calls. The parser is stateful (it maintains `currentState`), but each `parse()` call must process every byte of input. No memoization.
* Remove or weaken handler dispatch. The bench registers real handlers; skipping dispatch would be a benchmark exploit.

## What the parser already does well

Before you start, understand what's already optimized so you don't waste time re-discovering it:

* **Transition table**: `Uint16Array` lookup — state × charCode → action + nextState. One array access per byte. This is already near-optimal for the state machine itself.
* **PRINT action loop unrolling**: 4× unrolled inner loop for consecutive printable characters. This is why `print_ascii` hits ~2500 MB/s.
* **PARAM inner loop**: do-while that stays in the PARAM action for consecutive digit/semicolon/colon bytes without re-entering the main switch.

## Where to look for wins

The bench breakdown shows where time is actually spent:

* **`sgr_heavy`: ~84 MB/s** — 30× slower than print. Every SGR sequence goes through: state transitions for `ESC [ params m`, param parsing, CSI handler dispatch. The handler dispatch involves array lookups and function calls per sequence.
* **`params_heavy`: ~92 MB/s** — similar. Truecolor sequences have many params (e.g. `38;2;0;255;128`).
* **`cursor_move`: ~127 MB/s** — CSI sequences with fewer params but more state transitions per byte.
* **`mixed_realistic`: ~158 MB/s** — blend of print runs and SGR.

Likely sources of real speedups:

* **Reduce handler dispatch overhead.** The CSI dispatch does `this._csiHandlers[this._collect << 8 | code]` then iterates the handler array in reverse. For the common case of a single registered handler, the array iteration + `instanceof Promise` check is overhead. A fast-path for single-handler case could help.
* **Inline the PARAM parsing more aggressively.** The current do-while re-enters `this._params.addDigit()` / `addParam()` / `addSubParam()` per byte. If `Params` methods are not inlined by V8, each is a virtual dispatch.
* **Reduce property access in the hot loop.** `this._transitions`, `this.currentState`, `this._collect`, `this._params` — each `this.` access goes through the object's hidden class. Caching in locals at the top of `parse()` and writing back at the end could help.
* **Specialize the common case in the main switch.** PRINT and PARAM are the most common actions. If the switch has many cases, V8 may generate a jump table; if it has few hot cases, a nested if-else could be faster.
* **The `code < 0xa0 ? code : NON_ASCII_PRINTABLE` ternary** runs per byte. For ASCII-only input (the overwhelming common case), the branch is always taken. Consider a fast-path that skips the check when all input is < 0x80.

Anti-patterns:
* Don't try to change the transition table layout (e.g. making it a 2D array). The `Uint16Array` with bit shifting is already the most cache-friendly layout.
* Don't try to replace the state machine with regex. The state machine handles streaming input correctly; regex can't.
* Don't optimize the async handler resume path (top of `parse()`). It's cold code.

## Output format

`run.py` prints:

```
---
mbps:            693.3
tests_passed:    1
build_ok:        1
install_seconds: 5.0
build_seconds:   15.0
test_seconds:    6.0
best_so_far:     693.3
threshold:       728.0  (best_so_far * 1.05)
auto-status:     keep
```

Read the headline: `grep "^mbps:\|^tests_passed:\|^auto-status:" run.log`

Per-case breakdown is on stderr from the bench: `grep "per-case" -A 10 run.log` (or check the bench stderr output).

## Logging results

`python run.py --record --description "<one line>"` appends a row. The harness auto-labels status.

Schema: `commit  mbps  tests_pass  build_ok  status  description`

## The experiment loop

LOOP FOREVER:

1. `git log --oneline -10` and `tail -10 results.tsv`. What's the current best? What has been tried?
2. Pick one optimization idea. Be specific.
3. Edit `src/common/parser/EscapeSequenceParser.ts` (or Params.ts). One change per experiment.
4. `git add -A && git commit -m "try: <description>"` (commit BEFORE the record run).
5. `python run.py --record --description "<description>" > run.log 2>&1`
6. `grep "^mbps:\|^tests_passed:\|^auto-status:" run.log`.
7. Decision:
   * `auto-status: keep` → the branch advances.
   * `auto-status: discard` → `git reset --hard HEAD~1`.
8. Goto 1.

**Build failures**: if `npm run build` fails, it's a TS type error from your edit. Read the tsc output in run.log, fix the type error or revert.

**Verification for large wins**: if `auto-status: keep` on a >15% improvement, run `python run.py > /tmp/verify.log 2>&1` (no --record). If verify mbps is also clearly above threshold, it's real. If verify is close to baseline, it was noise — `git reset --hard HEAD~1`.

**NEVER STOP**: once the loop has begun, do NOT pause. Run indefinitely until manually stopped.
