# [![xterm.js logo](logo.png)](https://xtermjs.org)

[![xterm.js build status](https://api.travis-ci.org/sourcelair/xterm.js.svg)](https://travis-ci.org/sourcelair/xterm.js) [![Coverage Status](https://coveralls.io/repos/github/sourcelair/xterm.js/badge.svg)](https://coveralls.io/github/sourcelair/xterm.js) [![Gitter](https://badges.gitter.im/sourcelair/xterm.js.svg)](https://gitter.im/sourcelair/xterm.js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge) [![jsDelivr Hits](https://data.jsdelivr.com/v1/package/npm/xterm/badge?style=rounded)](https://www.jsdelivr.com/package/npm/xterm)

Xterm.js is a terminal front-end component written in JavaScript that works in the browser.

It enables applications to provide fully featured terminals to their users and create great development experiences.

## Features
- **Text-based application support**: Use xterm.js to work with applications like `bash`, `git` etc.
- **Curses-based application support**: Use xterm.js to work with applications like `vim`, `tmux` etc.
- **Mouse events support**: Xterm.js captures mouse events like click and scroll and passes them to the terminal's back-end controlling process
- **CJK (Chinese, Japanese, Korean) character support**: Xterm.js renders CJK characters seamlessly
- **IME support**: Insert international (including CJK) characters using IME input with your keyboard
- **Self-contained library**: Xterm.js works on its own. It does not require any external libraries like jQuery or React to work
- **Modular, event-based API**: Lets you build addons and themes with ease

## What xterm.js is not
- Xterm.js is not a terminal application that you can download and use on your computer
- Xterm.js is not `bash`. Xterm.js can be connected to processes like `bash` and let you interact with them (provide input, receive output)

## Getting Started

First you need to install the module, we ship exclusively through [npm](https://www.npmjs.com/) so you need that installed and then add xterm.js as a dependency by running:

```
npm install
```

To start using xterm.js on your browser, add the `xterm.js` and `xterm.css` to the head of your html page. Then create a `<div id="terminal"></div>` onto which xterm can attach itself.

```html
<!doctype html>
  <html>
    <head>
      <link rel="stylesheet" href="node_modules/xterm/dist/xterm.css" />
      <script src="node_modules/xterm/dist/xterm.js"></script>
    </head>
    <body>
      <div id="terminal"></div>
      <script>
      	var term = new Terminal();
        term.open(document.getElementById('terminal'));
        term.write('Hello from \033[1;3;31mxterm.js\033[0m $ ')
      </script>
    </body>
  </html>
```

Finally instantiate the `Terminal` object and then call the `open` function with the DOM object of the `div`.

### Addons

Addons are JavaScript modules that attach functions to the `Terminal` prototype to extend its functionality. There are a handful available in the main repository in the `dist/addons` directory, you can even write your own (though they may break when the internals of xterm.js change across versions).

To use an addon, just include the JavaScript file after xterm.js and before the `Terminal` object has been instantiated. The function should then be exposed on the `Terminal` object:

```html
<script src="node_modules/xterm/dist/xterm.js"></script>
<script src="node_modules/xterm/dist/addons/fit/fit.js"></script>
```

```js
// Instantiate the terminal and call fit
var xterm = new Terminal();
xterm.fit();
```

### Importing

If the environment allows it, you can import xterm.js like so:

```ts
// CommonJS
var Terminal = require('xterm').Terminal;

// ES6 / TypeScript
import { Terminal } from 'xterm';
```

Importing addons in this environment can be done using a `Terminal.loadAddon` call:

```ts
import { Terminal } from 'xterm';

// Notice it's called statically on the type, not an object
Terminal.loadAddon('fit');

// Instantiate the terminal and call fit
var xterm = new Terminal();
xterm.fit();
```

*Note: There are currently no typings for addons so you will need to upcast if using TypeScript, eg. `(<any>xterm).fit()`*

## Browser Support

Since xterm.js is typically implemented as a developer tool, only modern browsers are supported officially. Here is a list of the versions we aim to support:

- Chrome latest
- Edge latest
- Firefox latest
- Safari latest
- IE11

Xterm.js works seamlessly in Electron apps and may even work on earlier versions of the browsers but these are the browsers we strive to keep working.

## Real-world uses
Xterm.js is used in several world-class applications to provide great terminal experiences.

- [**SourceLair**](https://www.sourcelair.com/): In-browser IDE that provides its users with fully-featured Linux terminals based on xterm.js
- [**Microsoft Visual Studio Code**](http://code.visualstudio.com/): Modern, versatile and powerful open source code editor that provides an integrated terminal based on xterm.js
- [**ttyd**](https://github.com/tsl0922/ttyd): A command-line tool for sharing terminal over the web, with fully-featured terminal emulation based on xterm.js
- [**Katacoda**](https://www.katacoda.com/): Katacoda is an Interactive Learning Platform for software developers, covering the latest Cloud Native technologies.
- [**Eclipse Che**](http://www.eclipse.org/che): Developer workspace server, cloud IDE, and Eclipse next-generation IDE.
- [**Codenvy**](http://www.codenvy.com): Cloud workspaces for development teams.
- [**CoderPad**](https://coderpad.io): Online interviewing platform for programmers. Run code in many programming languages, with results displayed by `xterm.js`.
- [**WebSSH2**](https://github.com/billchurch/WebSSH2): A web based SSH2 client using `xterm.js`, socket.io, and ssh2.
- [**Spyder Terminal**](https://github.com/spyder-ide/spyder-terminal): A full fledged system terminal embedded on Spyder IDE.
- [**Cloud Commander**](https://cloudcmd.io "Cloud Commander"): Orthodox web file manager with console and editor.
- [**Codevolve**](https://www.codevolve.com "Codevolve"): Online platform for interactive coding and web development courses. Live container-backed terminal uses `xterm.js`.
- [**RStudio**](https://www.rstudio.com/products/RStudio "RStudio"): RStudio is an integrated development environment (IDE) for R.
- [**Terminal for Atom**](https://github.com/jsmecham/atom-terminal-tab): A simple terminal for the Atom text editor.
- [**Eclipse Orion**](https://orionhub.org): A modern, open source software development environment that runs in the cloud. Code, deploy and run in the cloud.
- [**Gravitational Teleport**](https://github.com/gravitational/teleport): Gravitational Teleport is a modern SSH server for remotely accessing clusters of Linux servers via SSH or HTTPS.
- [**Hexlet**](https://en.hexlet.io): Practical programming courses (JavaScript, PHP, Unix, databases, functional programming). A steady path from the first line of code to the first job.
- [**Selenoid UI**](https://github.com/aerokube/selenoid-ui): Simple UI for the scallable golang implementation of Selenium Hub named Selenoid. We use XTerm for streaming logs over websockets from docker containers.
- [**Portainer**](https://portainer.io): Simple management UI for Docker.
- [**SSHy**](https://github.com/stuicey/SSHy): HTML5 Based SSHv2 Web Client with E2E encryption utilising `xterm.js`, SJCL & websockets.
- [**JupyterLab**](https://github.com/jupyterlab/jupyterlab): An extensible 
computational environment for Jupyter, supporting interactive data science and scientific computing across all programming languages.
- [**Theia**](https://github.com/theia-ide/theia): Theia is a cloud & desktop IDE framework implemented in TypeScript.
- [**Opshell**](https://github.com/ricktbaker/opshell) Ops Helper tool to make life easier working with AWS instances across multiple organizations.

Do you use xterm.js in your application as well? Please [open a Pull Request](https://github.com/sourcelair/xterm.js/pulls) to include it here. We would love to have it in our list.

## Demo

### Linux or macOS

First, be sure that a C++ compiler such as GCC-C++ or Clang is installed, then run these commands:

```
npm install
npm start
```

Then open http://0.0.0.0:3000 in a web browser.

### Windows

First, ensure [node-gyp](https://github.com/nodejs/node-gyp) is installed and configured correctly, then run these commands.

```
npm install
npm start
```

Then open http://127.0.0.1:3000 in a web browser.

*Note: Do not use ConEmu, as it seems to break the demo for some reason.*

## Releases

Xterm.js follows a monthly release cycle roughly.

The existing releases are available at this GitHub repo's [Releases](https://github.com/sourcelair/xterm.js/releases), while the roadmap is available as [Milestones](https://github.com/sourcelair/xterm.js/milestones).

## Development and Contribution

Xterm.js is maintained by [SourceLair](https://www.sourcelair.com/) and a few external contributors, but we would love to receive contributions from everyone!

To contribute either code, documentation or issues to xterm.js please read the [Contributing document](CONTRIBUTING.md) beforehand. The development of xterm.js does not require any special tool. All you need is an editor that supports JavaScript/TypeScript and a browser. You will need Node.js installed locally to get all the features working in the demo.

## License Agreement

If you contribute code to this project, you are implicitly allowing your code to be distributed under the MIT license. You are also implicitly verifying that all code is your original work.

Copyright (c) 2014-2017, SourceLair, Private Company ([www.sourcelair.com](https://www.sourcelair.com/home)) (MIT License)

Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
