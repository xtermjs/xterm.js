## @xterm/addon-web-fonts

Addon to use webfonts with [xterm.js](https://github.com/xtermjs/xterm.js).
This addon requires xterm.js v5+.

### Install

```bash
npm install --save @xterm/addon-web-fonts
```

### Issue with Webfonts

Webfonts are announced by CSS `font-face` rules (or its Javascript `FontFace` counterparts).
Since font files tend to be quite big assets, browser engines often postpone their loading
to an actual styling request of a codepoint matching a font file's `unicode-range`.
In short - font files will not be loaded until really needed.

xterm.js on the other hand heavily relies on exact measurement of character glyphs
to layout its output. This is done by determining the glyph width (DOM renderer) or
by creating a glyph texture (WebGl renderer) for every output character.
For performance reasons both is done in synchronous code and cached.
This logic only works properly, if a font glyph is available on its first usage,
otherwise the browser will pick a glyph from a fallback font messing up the metrics.

For webfonts and xterm.js this means that we cannot rely on the default loading strategy
of the browser, but have to preload the font files before using that font in xterm.js.


### Static Preloading for the Rescue?

If you dont mind higher initial loading times with a white page shown,
you can tell the browser to preload the needed font files by placing the following
link elements in the document's head above any other CSS/Javascript:
```html
  <link rel="preload" as="font" href="/path/to/your/fontfile1.woff" type="font/woff2" crossorigin="anonymous">
  <link rel="preload" as="font" href="/path/to/your/fontfile2.woff" type="font/woff2" crossorigin="anonymous">
  ...
  <!-- CSS with font-face rules matching the URLs above -->
```
Browsers also will resort to system fonts, if the preloading takes too long.
So this solution has only a very limited scope.


### Loading with WebFontsAddon

The webfonts addon offers several ways to deal with font assets loading
without leaving the terminal in an unusable state.

Recap - normally boostrapping of a new terminal involves these basic steps (Typescript):

```typescript
import { Terminal } from '@xterm/xterm';
import { XYAddon } from '@xterm/addon-xy';

// create a `Terminal` instance with some options, e.g. a custom font family
const terminal = new Terminal({fontFamily: 'monospace'});

// create and load all addons you want to use, e.g. fit addon
const xyInstance = new XYAddon();
terminal.loadAddon(xyInstance);

// finally: call `open` of the terminal instance
terminal.open(your_terminal_div_element);   // <-- critical path for webfonts
// more boostrapping goes here ...
```
This code is guaranteed to work in all browsers synchronously, as the identifier `monospace`
will always be available. It will also work synchronously with any installed system font,
but breaks horribly with webfonts. The actual culprit here is the call to `terminal.open`,
which attaches the terminal to the DOM and starts the renderer with all the glyph caching
mentioned above, while the webfont is not yet fully available.

To fix that, the webfonts addon provides a waiting condition (Typescript):
```typescript
import { Terminal } from '@xterm/xterm';
import { XYAddon } from '@xterm/addon-xy';
import { WebFontsAddon } from '@xterm/addon-web-fonts';

// create a `Terminal` instance, now with webfonts
const terminal = new Terminal({fontFamily: '"Web Mono 1", "Super Powerline", monospace'});
const xyInstance = new XYAddon();
terminal.loadAddon(xyInstance);

const webFontsInstance = new WebFontsAddon();
terminal.loadAddon(webFontsInstance);  

// wait for webfonts to be fully loaded
webFontsInstance.loadFonts(['Web Mono 1', 'Super Powerline']).then(() => {
  terminal.open(your_terminal_div_element);
  // more boostrapping goes here ...
});
```
Here `loadFonts` will look up the font face objects in `document.fonts`
and load them before continuing. For this to work, you have to make sure,
that the CSS `font-face` rules for these webfonts are loaded beforehand,
otherwise `loadFonts` will not find the font family names (promise will be
rejected for missing font family names).

Please note, that this cannot run synchronous anymore, so you will have to split your
bootstrapping code into several stages. If that is too much of a hassle,
you can also move the whole bootstrapping under the waiting condition by using
the static loader instead (Typescript):
```typescript
import { Terminal } from '@xterm/xterm';
import { XYAddon } from '@xterm/addon-xy';
// import static loader
import { loadFonts } from '@xterm/addon-web-fonts';

loadFonts(['Web Mono 1', 'Super Powerline']).then(() => {
  // create a `Terminal` instance, now with webfonts
  const terminal = new Terminal({fontFamily: '"Web Mono 1", "Super Powerline", monospace'});
  const xyInstance = new XYAddon();
  terminal.loadAddon(xyInstance);

  // optional when using static loader
  const webfontsInstance = new WebFontsAddon();
  terminal.loadAddon(webfontsInstance);

  terminal.open(your_terminal_div_element);
  // more boostrapping goes here ...
});
```
With the static loader creating and loading of the actual addon can be omitted,
as fonts are already loaded before any terminal setup happens.

### Webfont Loading at Runtime

Given you have a terminal already running and want to change the font family
to a different not yet loaded webfont:
```typescript
// either create font face objects in javascript
const ff1 = new FontFace('New Web Mono', url1, ...);
const ff2 = new FontFace('New Web Mono', url2, ...);
// and await their loading
loadFonts([ff1, ff2]).then(() => {
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
loadFonts(['New Web Mono']).then(() => {
  // apply new webfont to terminal
  terminal.options.fontFamily = 'New Web Mono';
  // since the new font might have slighly different metrics,
  // also run the fit addon here (or any other custom resize logic)
  fitAddon.fit();
});
```

### Forced Layout Update

If you have the addon loaded into your terminal, you can force the terminal to update
the layout with the method `WebFontsAddon.relayout`. This might come handy,
if the terminal shows webfont related output issue for unknown reasons:
```typescript
...
// given - terminal shows weird font issues, run:
webFontsInstance.relayout().then(() => {
  // also run resize logic here, e.g. fit addon
  fitAddon.fit();
});
```
Note that this method is only meant as a quickfix on a running terminal to keep it
in a working condition. A production-ready integration should never rely on it,
better fix the  real root cause (most likely not properly awaiting the font loader
higher up in the code).


### Webfonts from Fontsource

The addon has been tested to work with webfonts from fontsource.
Javascript example for `vite` with ESM import:
```javascript
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { loadFonts } from '@xterm/addon-web-fonts';
import '@xterm/xterm/css/xterm.css';
import '@fontsource/roboto-mono';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/400-italic.css';
import '@fontsource/roboto-mono/700.css';
import '@fontsource/roboto-mono/700-italic.css';

async function main() {
  let fontFamily = '"Roboto Mono", monospace';
  try {
    await loadFonts(['Roboto Mono']);
  } catch (e) {
    fontFamily = 'monospace';
  }

  const terminal = new Terminal({ fontFamily });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(document.getElementById('your-xterm-container-div'));
  fitAddon.fit();

  // sync writing shows up in Roboto Mono w'o FOUT
  // and a fallback to monospace
  terminal.write('put any unicode char here');
}

main();
```
The fontsource packages download the font files to your project folder to be delivered
from there later on. For security sensitive projects this should be the preferred way,
as it brings the font files under your control.

The example furthermore contains proper exception handling with a fallback
(skipped in all other examples for better readability).

---

Also see the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-web-fonts/typings/addon-web-fonts.d.ts).
