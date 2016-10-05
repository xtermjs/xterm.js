Using Terminado with Xterm.js
=============================

Xterm.js is a very flexible system, and as such can be mapped to work with a wide variety of websocket/terminal backends.  [Terminado](https://github.com/takluyver/terminado) is one such backend written in Python using `Tornado` as the underlying web framework.  This directory shows a more-or-less barebones example of integrating `Terminado` and `Xterm.js`.  To do so requires some small edits to `Xterm.js`'s `attach.js` to change the websocket communication format.  Briefly, `Terminado` wraps messages in arrays with an element denoting what kind of data it holds, and so rather than simply sending user-typed data directly, one sends `['stdin', data]`.

To run this example, first install Terminado via `pip install terminado`, then simply run `python ./app.py` and connect to http://localhost:8000 to open a shell on localhost.
