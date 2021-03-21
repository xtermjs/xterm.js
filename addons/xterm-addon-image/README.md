## xterm-addon-image

Image support for xterm.js.

**Note:** This addon is still alpha, expect all sorts of weird errors at the current stage.
It only supports SIXEL at the moment.


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

**Note:** The image decoding is done with a worker internally, therefore the addon will only work
if you expose the worker file as well (distributed under `lib/xterm-addon-image-worker.js`).


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
  By default the addon limits the palette size to 256 registers (as demanded by the DEC specification).
  The limit can be increased to a maximum of 65536 registers (via `sixelPaletteLimit`).

  SIXEL images are initialized with their own private palette derived from the default palette
  (default `{sixelDefaultPalette: 'ANSI256'}`). Support for non-private palette is currently broken
  and falls back to private palette mode.


### Storage and Drawing Settings

The internal storage holds images up to `storageLimit` (in MB, calculated as 4-channel RBGA unpacked).
Once hit images get evicted by FIFO. Furthermore images on the alternate buffer will always
be erased on buffer changes.

The addon exposes two properties to interact with the storage limits at runtime:
- `storageLimit`  
  Change the value to your needs at runtime. This is especially useful, if you have multiple terminal
  instances running, that all add to one upper memory limit.
- `storageUsage`  
  Inspect the current memory usage of the image storage.

By default the addon will show a placeholder pattern for evicted images that are still part
of the terminal (e.g. in the scrollback). The pattern can be deactivated by toggling `showPlaceholder`.
