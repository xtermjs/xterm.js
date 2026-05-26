## @xterm/addon-search

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables searching the buffer. This addon requires xterm.js v4+.

### Install

```bash
npm install --save @xterm/addon-search
```

### Usage

```ts
import { Terminal } from '@xterm/xterm';
import { SearchAddon } from '@xterm/addon-search';

const terminal = new Terminal();
const searchAddon = new SearchAddon();
terminal.loadAddon(searchAddon);
searchAddon.findNext('foo');
```

### Search options

- `decorations` (`ISearchDecorationOptions`): Enables match highlighting and result tracking; pass a decoration options object (colors may be omitted).
- `highlightLimit` (constructor option): Caps how many matches are tracked/highlighted (default `1000`).
- `incremental`: Expands the current selection when the term still matches.
- `wholeWord`, `regex`, `caseSensitive`: Control match semantics.

`onDidChangeResults` fires after `findNext`/`findPrevious` when `decorations` is set. `clearDecorations()` clears highlights and tracked results but does not emit this event.

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-search/typings/addon-search.d.ts) for more advanced usage.
