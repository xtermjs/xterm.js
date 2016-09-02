# xterm.js

![xterm.js build status](https://api.travis-ci.org/sourcelair/xterm.js.svg) [![Gitter](https://badges.gitter.im/sourcelair/xterm.js.svg)](https://gitter.im/sourcelair/xterm.js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

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

## Real-world uses
Xterm.js is used in several world-class applications to provide great terminal experiences.

- [**SourceLair**](https://www.sourcelair.com/): In-browser IDE that provides its users with fully-featured Linux terminals based on xterm.js
- [**Microsoft Visual Studio Code**](http://code.visualstudio.com/): Modern, versatile and powerful open source code editor that provides an integrated terminal based on xterm.js

Do you use xterm.js in your application as well? Please [open a Pull Request](https://github.com/sourcelair/xterm.js/pulls) to include it here. We would love to have it in our list.

## Browser Support

Since xterm.js is typically implemented as a developer tool, only modern browsers are supported officially. Here is a list of the versions we aim to support:

- Chrome 48+
- Edge 13+
- Firefox 44+
- Internet Explorer 11+
- Opera 35+
- Safari 8+

Xterm.js works seamlessly in Electron apps and may even work on earlier versions of the browsers but these are the browsers we strive to keep working.

## Demo

To launch the demo simply run:

```
npm install
npm start
```

Then open http://0.0.0.0:3000 in a web browser (use http://127.0.0.1:3000 if running under Windows).

## Addons

Addons are JavaScript modules that attach functions to the `Terminal` prototype to extend its functionality. There are a handful available in the main repository in the `addons` directory, you can even write your own (though they may break when the internals of xterm.js change across versions).

To use an addon, just include the JavaScript file after xterm.js and before the `Terminal` object has been instantiated. The function should then be exposed on the `Terminal` object:

```html
<script src="node_modules/dist/xterm.js"></script>
<script src="node_modules/addons/fit/fit.js"></script>
```

```js
var xterm = new Terminal();
// init code...
xterm.fit();
```

## Releases

Xterm.js follows a monthly release cycle roughly.

The existing releases are available at this GitHub repo's [Releases](https://github.com/sourcelair/xterm.js/releases), while the roadmap is available as [Milestones](https://github.com/sourcelair/xterm.js/milestones).

## Development and Contribution

Xterm.js is maintained by [SourceLair](https://www.sourcelair.com/) and a few external contributors, but we would love to receive contributions from everyone!

To contribute either code, documentation or issues to xterm.js please read the [Contributing document](CONTRIBUTING.md) before.

The development of xterm.js does not require any special tool. All you need is an editor that supports JavaScript and a browser (if you would like to run the demo you will need Node.js to get all features).

It is recommended though to use a development tool that uses xterm.js internally, to develop for xterm.js. [Eating our own dogfood](https://en.wikipedia.org/wiki/Eating_your_own_dog_food) has been proved extremely beneficial for this project. Known tools that use xterm.js internally are:

#### [SourceLair](https://www.sourcelair.com)

Visit https://lair.io/sourcelair/xterm and follow the instructions. All development will happen in your browser.

#### [Visual Studio Code](http://code.visualstudio.com/)

[Download Visual Studio Code](http://code.visualstudio.com/Download), clone xterm.js and you are all set.

## License Agreement

If you contribute code to this project, you are implicitly allowing your code to be distributed under the MIT license. You are also implicitly verifying that all code is your original work.

Copyright (c) 2014-2016, SourceLair, Private Company ([www.sourcelair.com](https://www.sourcelair.com/home)) (MIT License)

Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
