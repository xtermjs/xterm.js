## xterm-addon-image

An addon providing image support for xterm.js. Currently it only supports the SIXEL format
(iTerm2 image protocol planned).

**Note:** This addon is still alpha, expect all sorts of weird errors at the current stage.


### Install

```bash
npm install --save xterm-addon-image
```

### Usage

```ts
import { Terminal } from 'xterm';
import { ImageAddon, IImageAddonOptions } from 'xterm-addon-image';

// customize as needed
const customSettings: IImageAddonOptions = {
  sixelSupport: true,
  ...
}

// initialization
const terminal = new Terminal();
const imageAddon = new ImageAddon(customSettings);
terminal.loadAddon(imageAddon);

// when done
imageAddon.dispose();
```


### Operation Modes

- **SIXEL Support**  
  On by default, change it with `{sixelSupport: true}`.

- **Scrolling On | Off**  
  By default scrolling is on, thus an image will advance the cursor at the bottom if needed.
  The cursor will move with the image and be placed either right to the image or in the next line
  (see cursor positioning).

  If scrolling is off, the image gets painted from the top left of the current viewport
  and might be truncated if the image exceeds the viewport size.
  The cursor position does not change.

  You can customize this behavior with the constructor option `{sixelScrolling: false}`
  or with `DECSET 80` (on, binary: `\x1b [ ? 80 h`) and
  `DECRST 80` (off, binary: `\x1b [ ? 80 l`) during runtime.

- **Cursor Positioning**  
  If scrolling is set, the cursor will be placed at the beginning of the next row by default.
  You can change this behavior with the following terminal sequences:
  - `DECSET 8452` (binary: `\x1b [ ? 8452 h`)  
    For images not overflowing to the right, the cursor will move right to the last image cell.
    Images overflowing to the right, move the cursor to the next line.
    Same as the constructor option `{cursorRight: true}`.

  - `DECRST 8452` (binary: `\x1b [ ? 8452 l`)  
    Always moves the cursor to the next line (default). Same as the constructor option `{cursorRight: false}`.

  - `DECSET 7730` (binary: `\x1b [ ? 7730 h`)  
    Move the cursor on the next line to the image start offset instead of the beginning.
    This setting only applies if the cursor will wrap to the next line (thus never for scrolling off,
    for `DECSET 8452` only after overflowing images). Same as the constructor option `{cursorBelow: true}`.

  - `DECRST 7730` (binary: `\x1b [ ? 7730 l`)  
    Keep the cursor on the next line at the beginning (default). Same as the constructor option `{cursorBelow: false}`.

- **SIXEL Palette Handling**
  By default the addon limits the palette size to 256 registers (as demanded by the DEC specification)
  and can be increased up to 65536.

  By default SIXEL images are initialized with their own palette derived from the default palette
  (default `{sixelDefaultPalette: 'ANSI256'}`). This can be changed to a shared palette with
  `DECRST 1070` (binary: `\x1b [ ? 1070 l`) or the constructor option `{sixelPrivatePalette: true}`.
  Note that a shared palette is only applied during the image construction once, a later change
  to the shared palette does not re-color older SIXEL images.
  