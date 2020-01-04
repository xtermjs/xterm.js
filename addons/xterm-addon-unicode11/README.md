## xterm-addon-unicode11

An addon providing Unicode version 11 rules for xterm.js.

### Install

```bash
npm install --save xterm-addon-unicode11
```

### Usage

```ts
import { Terminal } from 'xterm';
import { Unicode11Addon } from 'xterm-addon-unicode11';

const terminal = new Terminal();
const unicode11Addon = new Unicode11Addon();
terminal.loadAddon(unicode11Addon);

// activate the new version
terminal.unicode.activeVersion = '11';
```
