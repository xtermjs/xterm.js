## @xterm/addon-progress

An xterm.js addon providing an interface for ConEmu's progress sequence.
See https://conemu.github.io/en/AnsiEscapeCodes.html#ConEmu_specific_OSC for sequence details.


### Install

```bash
npm install --save @xterm/addon-progress
```


### Usage

```ts
import { Terminal } from '@xterm/xterm';
import { ProgressAddon, IProgressState } from '@xterm/addon-progress';

const terminal = new Terminal();
const progressAddon = new ProgressAddon();
terminal.loadAddon(progressAddon);
progressAddon.onChange({state, value}: IProgressState) => {
  // state: 0-4 integer (see below for meaning)
  // value: 0-100 integer (percent value)
  
  // do your visualisation based on state/value here
  ...
});
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-progress/typings/addon-progress.d.ts) for more advanced usage.

### Sequence

The sequence to set progress information has the following format:

```plain
ESC ] 9 ; 4 ; <state> ; <progress value> BEL
```

where state is a decimal number in 0 to 4 and progress value is a decimal number in 0 to 100.
The states have the following meaning:

- 0: Remove any progress indication. Also resets progress value to 0. A given progress value will be ignored.
- 1: Normal state to set a progress value. The value should be in 0..100, greater values are clamped to 100.
  If the value is omitted, it will be set to 0.
- 2: Error state with an optional progress value. An omitted value will be set to 0,
  which has a special meaning using the last active value.
- 3: Actual progress is "indeterminate", any progress value will be ignored. Meant to be used to indicate
  a running task without progress information (e.g. by a spinner). A previously set progress value
  by any other state sequence will be left untouched.
- 4: Pause or warning state with an optional progress value. An omitted value will be set to 0,
  which has a special meaning using the last active value.

The addon resolves most of those semantic nuances and will provide these ready-to-go values:
- For the remove state (0) any progress value wont be parsed, thus is even allowed to contain garbage.
  It will always emit `{state: 0, value: 0}`.
- For the set state (1) an omitted value will be set to 0 emitting `{state: 1, value: 0}`.
  If a value was given, it must be decimal digits only, any characters outside will mark the whole sequence
  as faulty (no sloppy integer parsing). The value will be clamped to max 100 giving
  `{state: 1, value: parsedAndClampedValue}`.
- For the error and pause state (2 & 4) an omitted or zero value will emit `{state: 2|4, value: lastValue}`.
  If a value was given, it must be decimal digits only, any characters outside will mark the whole sequence
  as faulty (no sloppy integer parsing). The value will be clamped to max 100 giving
  `{state: 2|4, value: parsedAndClampedValue}`.
- For the indeterminate state (3) a value notion will be ignored.
  It still emits the value as `{state: 3, value: lastValue}`. Keep in mind not use that value while
  that state is active, as a task might have entered that state without a proper reset at the beginning.
