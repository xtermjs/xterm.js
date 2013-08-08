# term.js

A terminal written in javascript. Used by
[tty.js](https://github.com/chjj/tty.js).

## Example

Server:

``` js
var term = require('term.js');
express.use(term.middleware());
```

Client:

``` js
window.addEventListener('load', function() {
  var term = new Terminal({
    cols: 80,
    rows: 24
  });

  term.open(document.body);

  term.on('data', function(data) {
    console.log(data);
  });

  term.write('\x1b[41hello world\x1b[m');
}, false);
```

## License

Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)

[1]: http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
