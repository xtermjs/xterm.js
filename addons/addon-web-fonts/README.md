## @xterm/addon-web-fonts

Addon to use webfonts with [xterm.js](https://github.com/xtermjs/xterm.js). This addon requires xterm.js v5+.

### Install

```bash
npm install --save @xterm/addon-web-fonts
```

### Issue with Webfonts

Webfonts are announced by CSS `font-face` rules (or its Javascript `FontFace` counterparts). Since font files tend to be quite big assets, browser engines often postpone their loading to an actual styling request of a codepoint matching a font file's `unicode-range`. In short - font files will not be loaded until really needed.

xterm.js on the other hand heavily relies on exact measurements of character glyphs to layout its output. This is done by determining the glyph width (DOM renderer) or by creating a glyph texture (WebGl renderer) for every output character.
For performance reasons both is done in synchronous code and cached. This logic only works properly,
if a font glyph is available on its first usage, or a wrong glyph from a fallback font chosen by the browser will be used instead.

For webfonts and xterm.js this means, that we cannot rely on the default loading strategy of the browser, but have to preload the font files before using that font in xterm.js.


### Static Preloading for the Rescue?

If you dont mind higher initial loading times of the embedding document, you can tell the browser to preload the needed font files by placing the following link elements in the document's head above any other CSS/Javascript:
```html
  <link rel="preload" as="font" href="/path/to/your/fontfile1.woff" type="font/woff2" crossorigin="anonymous">
  <link rel="preload" as="font" href="/path/to/your/fontfile2.woff" type="font/woff2" crossorigin="anonymous">
  ...
  <!-- CSS with font-face rules matching the URLs above -->
```
Downside of this approach is the much higher initial loading time showing as a white page. Browsers also will resort to system fonts, if the preloading takes too long, so with a slow connection or a very big font this solves literally nothing.


### Preloading with WebFontsAddon

The webfonts addon offers several ways to deal with the loading of font assets without leaving the terminal in an unusable state.


Recap - normally boostrapping of a new terminal involves these basic steps:

```typescript
import { Terminal } from '@xterm/xterm';
import { XYAddon } from '@xterm/addon-xy';

// create a `Terminal` instance with some options, e.g. a custom font family
const terminal = new Terminal({fontFamily: 'monospace'});

// create and load all addons you want to use, e.g. fit addon
const xyAddon = new XYAddon();
terminal.loadAddon(xyAddon);

// finally: call `open` of the terminal instance
terminal.open(your_terminal_div_element);   // <-- critical path for webfonts
// more boostrapping goes here ...
```

This synchronous code is guaranteed to work in all browsers, as the font `monospace` will always be available.
It will also work that way with any installed system font, but breaks horribly for webfonts. The actual culprit here is the call to `terminal.open`, which attaches the terminal to the DOM and starts the renderer with all the glyph caching mentioned above, while the webfont is not fully available yet.

To fix that, the webfonts addon provides a waiting condition:
```typescript
import { Terminal } from '@xterm/xterm';
import { XYAddon } from '@xterm/addon-xy';
import { WebFontsAddon } from '@xterm/addon-web-fonts';

// create a `Terminal` instance, now with webfonts
const terminal = new Terminal({fontFamily: '"Web Mono 1", "Super Powerline", monospace'});
const xyAddon = new XYAddon();
terminal.loadAddon(xyAddon);

const webFontsAddon = new WebFontsAddon();
terminal.loadAddon(webFontsAddon);

// wait for webfonts to be fully loaded
WebFontsAddon.loadFonts(['Web Mono 1', 'Super Powerline']).then(() => {
  terminal.open(your_terminal_div_element);
  // more boostrapping goes here ...
});
```
Here `loadFonts` will look up the font face objects in `document.fonts` and load them before continuing.
For this to work, you have to make sure, that the CSS `font-face` rules for these webfonts are loaded
on the initial document load (more precise - by the time this code runs).

Please note, that this code cannot run synchronous anymore, so you will have to split your
bootstrapping code into several stages. If thats too much of a hassle, you can also move the whole
bootstrapping under that waiting condition (`loadFonts` is actually a static method):
```typescript
import { Terminal } from '@xterm/xterm';
import { XYAddon } from '@xterm/addon-xy';
import { WebFontsAddon } from '@xterm/addon-web-fonts';

WebFontsAddon.loadFonts(['Web Mono 1', 'Super Powerline']).then(() => {
  // create a `Terminal` instance, now with webfonts
  const terminal = new Terminal({fontFamily: '"Web Mono 1", "Super Powerline", monospace'});
  const xyAddon = new XYAddon();
  terminal.loadAddon(xyAddon);

  const webFontsAddon = new WebFontsAddon();
  terminal.loadAddon(webFontsAddon);

  terminal.open(your_terminal_div_element);
  // more boostrapping goes here ...
});
```

### Webfont Loading at Runtime

Given you have a terminal already running and want to change the font family to a different not yet loaded webfont.
That can be achieved like this:
```typescript
// either create font face objects in javascript
const ff1 = new FontFace('New Web Mono', url1, ...);
const ff2 = new FontFace('New Web Mono', url2, ...);
// and await their loading
WebFontsAddon.loadFonts([ff1, ff2]).then(() => {
  // apply new webfont to terminal
  terminal.options.fontFamily = 'New Web Mono';
  // since the new font might have slighly different metrics,
  // also run the fit addon here (or any other custom resize logic)
  fitAddon.fit();
});

// or alternatively use CSS to add new font-face rules, e.g.
document.styleSheets[0].insertRule(
  "@font-face { font-family: 'New Web Mono'; src: url(newfont.woff); }", 0);
// and await the new font family name
WebFontsAddon.loadFonts(['New Web Mono']).then(() => {
  // apply new webfont to terminal
  terminal.options.fontFamily = 'New Web Mono';
  // since the new font might have slighly different metrics,
  // also run the fit addon here (or any other custom resize logic)
  fitAddon.fit();
});
```


See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-web-fonts/typings/addon-web-fonts.d.ts) for more advanced usage.
