# @xterm/addon-kitty-graphics

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that adds support for the [Kitty graphics protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/).

## Install

```bash
npm install --save @xterm/addon-kitty-graphics @xterm/xterm
```

## Usage

```typescript
import { Terminal } from '@xterm/xterm';
import { KittyGraphicsAddon } from '@xterm/addon-kitty-graphics';

const terminal = new Terminal();
const kittyGraphicsAddon = new KittyGraphicsAddon();
terminal.loadAddon(kittyGraphicsAddon);
```

## Features

This addon implements the Kitty graphics protocol, allowing applications to display images directly in the terminal using APC (Application Program Command) escape sequences.

### Supported Features

- PNG image transmission (f=100)
- Direct RGB/RGBA pixel data (f=24, f=32)
- Image placement at cursor position
- Basic query support (a=q)

### Protocol Format

The Kitty graphics protocol uses APC escape sequences:

```
<ESC>_G<key>=<value>,<key>=<value>,...;<base64 data><ESC>\
```

Key parameters:
- `a`: Action (t=transmit, T=transmit+display, q=query)
- `f`: Format (100=PNG, 24=RGB, 32=RGBA)
- `i`: Image ID
- `m`: More data follows (1=yes, 0=no)

See the [Kitty graphics protocol documentation](https://sw.kovidgoyal.net/kitty/graphics-protocol/) for full details.
