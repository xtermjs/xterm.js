"use strict";

var Terminal   = require('../');

  //provide fit(), proposeGeometry()
require('../addons/fit')(Terminal);

 //provide websocket attach()
require('../addons/attach')(Terminal);

  //wath for links and make them clickable
require('../addons/linkify')(Terminal);


var $ = function(sel) { return  document.querySelector(sel) };

createTerminal();

function createTerminal() {

  var term = new Terminal();

  var colsElement = $('#cols');
  var rowsElement = $('#rows');
  var terminalContainer = $('#terminal-container');

  $('#option-cursor-blink').addEventListener('change', function(){
    term.cursorBlink = this.checked;
  });


  // Clean terminal
  while (terminalContainer.children.length) 
    terminalContainer.removeChild(terminalContainer.children[0]);

  term.open(terminalContainer);



  term.fit();
  var size = term.proposeGeometry();

  colsElement.value = size.cols;
  rowsElement.value = size.rows;

  var charWidth  = Math.ceil(term.element.offsetWidth / size.cols);
  var charHeight = Math.ceil(term.element.offsetHeight / size.rows);

  function setTerminalSize () {
    var cols = parseInt(colsElement.value),
        rows = parseInt(rowsElement.value),
        width = (cols * charWidth).toString() + 'px',
        height = (rows * charHeight).toString() + 'px';

    terminalContainer.style.width = width;
    terminalContainer.style.height = height;
    term.resize(cols, rows);
  }


  colsElement.addEventListener('change', setTerminalSize);
  rowsElement.addEventListener('change', setTerminalSize);




  if(true) {
    var protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
    var socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/';

    var socket = new WebSocket(socketURL);
    socket.onopen  = runRealTerminal.bind(null, term, socket);
    socket.onerror = runFakeTerminal;
  } else 
    runFakeTerminal(term);

}

  //we do not need Buffer pollyfill for now
var fromASCII = function(str){
  var ret = [], len = str.length;
  while(len--) ret.unshift(str.charCodeAt(len));
  return Uint8Array.from(ret);
}


function runRealTerminal(term, socket) {
  if (term._initialized)
    return;
  term._initialized = true;


  term.attach(socket);

  term.on('resize', function (size) {
    socket.send(  fromASCII( JSON.stringify({cols : size.cols, rows : size.rows }  )) )
  });

  term._initialized = true;
}


function runFakeTerminal(term) {
  if (term._initialized)
    return;

  term._initialized = true;


  var shellprompt = '$ ';

  term.prompt = function () {
    term.write('\r\n' + shellprompt);
  };

  term.writeln('Welcome to xterm.js');
  term.writeln('This is a local terminal emulation, without a real terminal in the back-end.');
  term.writeln('Type some keys and commands to play around.');
  term.writeln('');
  term.prompt();

  term.on('key', function (key, ev) {
    var printable = (
      !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey
    );

    if (ev.keyCode == 13) {
      term.prompt();
    } else if (ev.keyCode == 8) {
     // Do not delete the prompt
      if (term.x > 2) {
        term.write('\b \b');
      }
    } else if (printable) {
      term.write(key);
    }
  });

  term.on('paste', function (data, ev) {
    term.write(data);
  });
}

