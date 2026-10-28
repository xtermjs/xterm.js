## @xterm/addon-program-status

An xterm.js addon for the program status sequence, OSC 7501. Programs use it to report what they are doing, such as working, blocked on the user, done or failed, so the embedder can show that status outside the terminal, for example as a dot on the terminal's tab.
See https://www.superlogical.com/rex/docs/build/program-status for the specification.


### Install

```bash
npm install --save @xterm/addon-program-status
```


### Usage

```ts
import { Terminal } from '@xterm/xterm';
import { ProgramStatusAddon, IProgramStatusRecord } from '@xterm/addon-program-status';

const terminal = new Terminal();
const programStatusAddon = new ProgramStatusAddon();
terminal.loadAddon(programStatusAddon);
programStatusAddon.onChange((records: ReadonlyArray<IProgramStatusRecord>) => {
  // records: every record the terminal holds, least recently updated first

  // show the status here
  ...
});
```

Load the addon only in terminals whose status is shown. The addon answers the feature detection query, and a terminal that answers tells programs that their status is visible.

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-program-status/typings/addon-program-status.d.ts) for more advanced usage.


### Sequence

A report has the following format:

```plain
ESC ] 7501 ; key=value:key=value ESC \
```

BEL can end it instead of `ESC \`. The keys are:

- `state`: Required. One of `idle`, `working`, `done`, `blocked`, `error` or `clear`.
- `id`: Which record the report is for, as a path such as `deploy/eu-west`: up to 8 segments of `[A-Za-z0-9_.+-]{1,32}` joined by `/`, at most 128 bytes. A report without an id addresses the root record.
- `kind`: With `blocked` only. One of `permission`, `question` or `auth`.
- `progress`: With `working` or `blocked` only. 0 to 100.
- `app`: A machine-readable program name, such as `cargo`, in the form of one id segment.
- `title`: A short label, as base64 of UTF-8 text of at most 192 bytes.
- `msg`: One line, as base64 of UTF-8 text of at most 2048 bytes.

Each report replaces its record whole, so a key missing from a report is missing from the record afterwards. A `clear` report removes the record with its id and every record beneath it, or every record if it has no id.

The addon skips a pair that it cannot read and ignores keys that it does not know. It discards the whole report if the state is missing or unknown, the id is malformed, a value or the whole sequence is over its limit, or text does not decode to UTF-8 without control characters.


### Feature detection

A program queries support with:

```plain
ESC ] 7501 ; ? ESC \
```

The addon answers with the same sequence. The answer always ends with `ESC \`, whichever terminator the query used, and goes out before the terminal's answer to a query that follows it, such as DA1. It goes out through `onData`, so a terminal with `disableStdin` set sends no answer.


### Records

The addon holds at most 256 records. A report that would add a 257th first deletes the record that has gone longest without an update. `effectiveApp` is the record's own `app` if it has one. Otherwise it comes from the closest record above it in the id path that has an `app`, which may be the root record.

Switching between the normal and alternate screen doesn't touch records, and neither does a soft reset (DECSTR). A full reset (RIS) deletes them all.

Records hold untrusted text. Control characters never get in, but `title` and `message` may still carry bidirectional overrides or invisible formatting characters. Strip those before the text appears outside the terminal, and label each record with the terminal it came from.


### Embedder duties

The addon only sees what the terminal parses, so the embedder reports the rest:

- `terminal.reset()` leaves records in place. Call `clear()` after it.
- Call `processExited()` once the attached process has exited and its final output has been parsed, for example from the callback of `terminal.write('', callback)`. It drops `working` and `blocked` records.
- Call `promptStarted()` when a new shell prompt begins, for example where shell integration's OSC 133 `A` starts a new command. It drops `working` and `blocked` records too.
- Call `clear(id)` when the user dismisses a record, such as a `done` or `error` record they have seen.


### Headless

The addon also loads in `@xterm/headless`. In `@xterm/headless` 6.0.0, the `parser` property that the addon uses requires `allowProposedApi`.
