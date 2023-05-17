## xterm-addon-unicode-graphemes

An addon providing enhanced Unicode support (include grapheme clustering) for xterm.js.

The file `src/UnicodeProperties.ts` is generated and depends on the Unicode version. See [the unicode-properties project](https://github.com/PerBothner/unicode-properties) for credits and re-generation instructions.

### Install

```bash
npm install --save xterm-addon-unicode-graphemes
```

### Usage

```ts
import { Terminal } from 'xterm';
import { UnicodeGraphemeAddon } from 'xterm-addon-unicode-graphemes';

const terminal = new Terminal();
const unicodeGraphemeAddon = new UnicodeGraphemeAddon();
terminal.loadAddon(unicodeGraphemeAddon);

// activate the new version
terminal.unicode.activeVersion = '15';
```
