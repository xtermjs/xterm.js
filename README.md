# term.js

A full xterm clone written in javascript. Used by
[**tty.js**](https://github.com/chjj/tty.js).

## Example

Server:

``` js
var term = require('term.js');
app.use(term.middleware());
...
```

Client:

``` js
window.addEventListener('load', function() {
  var socket = io.connect();
  socket.on('connect', function() {
    var term = new Terminal({
      cols: 80,
      rows: 24,
      screenKeys: true
    });

    term.on('data', function(data) {
      socket.emit('data', data);
    });

    term.on('title', function(title) {
      document.title = title;
    });

    term.open(document.body);

    term.write('\x1b[31mWelcome to term.js!\x1b[m\r\n');

    socket.on('data', function(data) {
      term.write(data);
    });

    socket.on('disconnect', function() {
      term.destroy();
    });
  });
}, false);
```

## Tmux-like

While term.js has always supported copy/paste using the mouse, it now also
supports several keyboard based solutions for copy/paste.

term.js includes a tmux-like selection mode (enabled with the `screenKeys`
option) which makes copy and paste very simple. `Ctrl-A` enters `prefix` mode,
from here you can type `Ctrl-V` to paste. Press `[` in prefix mode to enter
selection mode. To select text press `v` (or `space`) to enter visual mode, use
`hjkl` to navigate and create a selection, and press `Ctrl-C` to copy.

`Ctrl-C` (in visual mode) and `Ctrl-V` (in prefix mode) should work in any OS
for copy and paste. `y` (in visual mode) will work for copying only on X11
systems. It will copy to the primary selection.

Note: `Ctrl-C` will also work in prefix mode for the regular OS/browser
selection. If you want to select text with your mouse and copy it to the
clipboard, simply select the text and type `Ctrl-A + Ctrl-C`, and
`Ctrl-A + Ctrl-V` to paste it.

For mac users: consider `Ctrl` to be `Command/Apple` above.

## License

Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
