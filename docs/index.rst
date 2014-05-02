.. xterm.js documentation master file, created by
   sphinx-quickstart on Tue Mar 25 17:38:05 2014.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome to xterm.js's documentation!
====================================

This is the documentation for xterm.js. Xterm.js is a full xterm clone, written completely in JavaScript.

Xterm.js supplye a modular, event-based interface that lets developers build addons and themes that augment 
the experience of running a fully-feature terminal inside the browser.

Xterm.js serves as the foundation for the terminal found at www.sourcelair.com.

Getting started
^^^^^^^^^^^^^^^

.. code-block:: javascript
    
   var term = new Terminal(),
       socket = new WebSocket('ws://docker/containers/mycontainer/attach/ws');
  
   term.open(document.body);
   term.on('data', function (data) {
       socket.send(data);
   });
   socket.onmessage = function (e) {
       term.write(e.data);
   }
    

Contents

.. toctree::
   :maxdepth: 1
   
   methods
   events



Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`

