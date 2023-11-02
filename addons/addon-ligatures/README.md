## @xterm/addon-ligatures

Add support for programming ligatures to [xterm.js] when running in environments with access to [Node.js] APIs (such as [Electron]).

### Requirements

 * [Node.js] 8.x or higher (present in [Electron] 1.8.3 or higher)
 * [xterm.js] 4.0.0 or higher using the default canvas renderer

### Install

```bash
npm install --save @xterm/addon-ligatures
```

### Usage

```ts
import { Terminal } from '@xterm/xterm';
import { LigaturesAddon } from '@xterm/addon-ligatures';

const terminal = new Terminal();
const ligaturesAddon = new LigaturesAddon();
terminal.open(containerElement);
terminal.loadAddon(ligaturesAddon);
```

### How It Works

In a browser environment, font ligature information is read directly by the web browser and used to render text correctly without any intervention from the developer. As of version 3, xterm.js uses the canvas to render characters individually, resulting in a significant performance boost. However, this means that it can no longer lean on the browser to determine when to draw font ligatures.

This package locates the font file on disk for the font currently in use by the terminal and parses the ligature information out of it (via the [font-ligatures] package). As text is rendered in xterm.js, this package annotates it with the locations of ligatures, allowing xterm.js to render it correctly.

Since this package depends on being able to find and resolve a system font from disk, it has to have system access that isn't available in the web browser. As a result, this package is mainly useful in environments that combine browser and Node.js runtimes (such as [Electron]).

### Fallback Ligatures

When ligatures cannot be fetched from the environment, a set of "fallback" ligatures is used to get the most common ligatures working. These fallback ligatures can be customized with options passed to `LigatureAddon.constructor`.

### Fonts

This package makes use of the following fonts for testing:

* [Fira Code][Fira Code] - [Licensed under the OFL][Fira Code License] by Nikita Prokopov, Mozilla Foundation with reserved names Fira Code, Fira Mono, and Fira Sans
* [Iosevka] - [Licensed under the OFL][Iosevka License] by Belleve Invis with reserved name Iosevka

[xterm.js]: https://github.com/xtermjs/xterm.js
[Electron]: https://electronjs.org/
[Node.js]: https://nodejs.org/
[font-ligatures]: https://github.com/princjef/font-ligatures
[Fira Code]: https://github.com/tonsky/FiraCode
[Fira Code License]: https://github.com/tonsky/FiraCode/blob/master/LICENSE
[Iosevka]: https://github.com/be5invis/Iosevka
[Iosevka License]: https://github.com/be5invis/Iosevka/blob/master/LICENSE.md

