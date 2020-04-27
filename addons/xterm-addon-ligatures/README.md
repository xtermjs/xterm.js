# xterm-addon-ligatures

[![Build Status](https://dev.azure.com/xtermjs/xterm-addon-ligatures/_apis/build/status/xtermjs.xterm-addon-ligatures)](https://dev.azure.com/xtermjs/xterm-addon-ligatures/_build/latest?definitionId=4)
[![Coverage Status](https://coveralls.io/repos/github/xtermjs/xterm-addon-ligatures/badge.svg?branch=refs%2Fheads%2Fmaster)](https://coveralls.io/github/xtermjs/xterm-addon-ligatures?branch=refs%2Fheads%2Fmaster)

Add support for programming ligatures to [xterm.js][] when running in
environments with access to [Node.js][] APIs (such as [Electron][]).

## Requirements

 * [Node.js][] 8.x or higher (present in [Electron][] 1.8.3 or higher)
 * [xterm.js][] 4.0.0 or higher using the default canvas renderer

## Usage

Install in your project by running:

```
npm install xterm-addon-ligatures
```

Then, modify the location where you initialize the terminal to enable ligature
support after opening. If you enable ligatures prior to opening the terminal,
they will not function properly.

Your code should look something like this:

```js
import { Terminal } from 'xterm';
import * as ligatures from 'xterm-addon-ligatures';

Terminal.applyAddon(ligatures);

const terminal = new Terminal();
terminal.open(document.getElementById('terminal-mount'));
terminal.enableLigatures();
```

### Importing in TypeScript

If you use TypeScript, you will need to cast the terminal variable as `any` when
you enable ligatures because TypeScript does not know that the addon is
available on the terminal object. It will look like this:

```ts
(terminal as any).enableLigatures()
```

Alternatively, you can import the addon directly as a function and pass the
terminal as an argument:

```js
import { Terminal } from 'xterm';
import { enableLigatures } from 'xterm-addon-ligatures';

const terminal = new Terminal();
terminal.open(document.getElementById('terminal-mount'));
enableLigatures(terminal);
```

## How It Works

In a browser environment, font ligature information is read directly by the web
browser and used to render text correctly without any intervention from the
developer. As of version 3, xterm.js uses the canvas to render characters
individually, resulting in a significant performance boost. However, this means
that it can no longer lean on the browser to determine when to draw font
ligatures.

This package locates the font file on disk for the font currently in use by the
terminal and parses the ligature information out of it (via the
[font-ligatures][] package). As text is rendered in xterm.js, this package
annotates it with the locations of ligatures, allowing xterm.js to render it
correctly.

Since this package depends on being able to find and resolve a system font from
disk, it has to have system access that isn't available in the web browser. As a
result, this package is mainly useful in environments that combine browser and
Node.js runtimes (such as [Electron][]).

## Fonts

This package makes use of the following fonts for testing:

 * [Fira Code][] - [Licensed under the OFL][Fira Code License] by Nikita
   Prokopov, Mozilla Foundation with reserved names Fira Code, Fira Mono, and
   Fira Sans
 * [Iosevka][] - [Licensed under the OFL][Iosevka License] by Belleve Invis with
   reserved name Iosevka

[xterm.js]: https://github.com/xtermjs/xterm.js
[Electron]: https://electronjs.org/
[Node.js]: https://nodejs.org/
[font-ligatures]: https://github.com/princjef/font-ligatures
[Fira Code]: https://github.com/tonsky/FiraCode
[Fira Code License]: https://github.com/tonsky/FiraCode/blob/master/LICENSE
[Iosevka]: https://github.com/be5invis/Iosevka
[Iosevka License]: https://github.com/be5invis/Iosevka/blob/master/LICENSE.md
