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
      rows: 24
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

## License

Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
