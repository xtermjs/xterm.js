## @xterm/addon-unicode-graphemes

⚠️ **This addon is currently experimental and may introduce unexpected and non-standard behavior**

An addon providing enhanced Unicode support (include grapheme clustering) for xterm.js.

The file `src/third-party/UnicodeProperties.ts` is generated and depends on the Unicode version (currently Unicode 18.0.0). It and the files `src/third-party/unicode-trie.ts` and `src/third-party/tiny-inflate.ts` come from the `out-ts` directory of [the unicode-properties project](https://github.com/PerBothner/unicode-properties); see that project for credits and re-generation instructions.

### Install

This addon is not yet published to npm

### Usage

```ts
import { Terminal } from '@xterm/xterm';
import { UnicodeGraphemesAddon } from '@xterm/addon-unicode-graphemes';

const terminal = new Terminal();
const unicodeGraphemesAddon = new UnicodeGraphemesAddon();
terminal.loadAddon(unicodeGraphemesAddon);
```
