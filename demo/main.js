var term,
    protocol,
    baseSocketURL,
    socket,
    cmdSocket,
    pid;

var terminalContainer = document.getElementById('terminal-container');
    // actionElements = {
    //   findNext: document.querySelector('#find-next'),
    //   findPrevious: document.querySelector('#find-previous')
    // },
    // optionElements = {
    //   cursorBlink: document.querySelector('#option-cursor-blink'),
    //   cursorStyle: document.querySelector('#option-cursor-style'),
    //   scrollback: document.querySelector('#option-scrollback'),
    //   tabstopwidth: document.querySelector('#option-tabstopwidth'),
    //   bellStyle: document.querySelector('#option-bell-style')
    // },
    // colsElement = document.getElementById('cols'),
    // rowsElement = document.getElementById('rows');

// var colsElementValue;
// var rowsElementValue;

// function setTerminalSize() {
//   var cols = parseInt(colsElementValue, 10);
//   var rows = parseInt(rowsElementValue, 10);
//   var viewportElement = document.querySelector('.xterm-viewport');
//   var scrollBarWidth = viewportElement.offsetWidth - viewportElement.clientWidth;
//   var width = (cols * term.charMeasure.width + 20 /*room for scrollbar*/).toString() + 'px';
//   var height = (rows * term.charMeasure.height).toString() + 'px';

//   terminalContainer.style.width = width;
//   terminalContainer.style.height = height;
//   term.resize(cols, rows);
// }

//colsElement.addEventListener('change', setTerminalSize);
//rowsElement.addEventListener('change', setTerminalSize);

// actionElements.findNext.addEventListener('keypress', function (e) {
//   if (e.key === "Enter") {
//     e.preventDefault();
//     term.findNext(actionElements.findNext.value);
//   }
// });
// actionElements.findPrevious.addEventListener('keypress', function (e) {
//   if (e.key === "Enter") {
//     e.preventDefault();
//     term.findPrevious(actionElements.findPrevious.value);
//   }
// });

// optionElements.cursorBlink.addEventListener('change', function () {
//   term.setOption('cursorBlink', optionElements.cursorBlink.checked);
// });
// optionElements.cursorStyle.addEventListener('change', function () {
//   term.setOption('cursorStyle', optionElements.cursorStyle.value);
// });
// optionElements.bellStyle.addEventListener('change', function () {
//   term.setOption('bellStyle', optionElements.bellStyle.value);
// });
// optionElements.scrollback.addEventListener('change', function () {
//   term.setOption('scrollback', parseInt(optionElements.scrollback.value, 10));
// });
// optionElements.tabstopwidth.addEventListener('change', function () {
//   term.setOption('tabStopWidth', parseInt(optionElements.tabstopwidth.value, 10));
// });

createTerminal();
term.focus();

document.getElementById('button').onclick = () => {
  console.log("click")
  //term.detach(socket);
  console.log('detached');
  var cmd = 'dzn';
  var args = '-V';
  term.writeln(cmd + ' ' + args)
  fetch('/terminals?cmd='+cmd+'&args='+args+'&cols=' + term.cols + '&rows=' + term.rows, {method: 'POST'}).then(function (res) {
    
          res.text().then(function (pid) {
            console.log('exec resp pid', pid);
            window.pid = pid;
            var socketURL = baseSocketURL + pid;
            cmdSocket = new WebSocket(socketURL);
            cmdSocket.onopen = runRealTerminal;
            cmdSocket.onclose = runFakeTerminal;
            cmdSocket.onerror = runFakeTerminal;
          });
        });
}

function createTerminal() {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }
  term = new Terminal({
    //cursorBlink: optionElements.cursorBlink.checked,
    //scrollback: parseInt(optionElements.scrollback.value, 10),
    //tabStopWidth: parseInt(optionElements.tabstopwidth.value, 10)
    theme: {
      foreground: '#000000',
      background: '#ffffff',
      cursor: '#000000',
      cursorAccent: '#ffffff',
      selection: 'rgba(0, 0, 0, 0.3)'
    }
  });
  term.on('resize', function (size) {
    if (!pid) {
      return;
    }
    var cols = size.cols,
        rows = size.rows,
        url = '/terminals/' + pid + '/size?cols=' + cols + '&rows=' + rows;

    console.log("fetch resize", url);
    fetch(url, {method: 'POST'});
  });
  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  baseSocketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/terminals/';

  term.open(terminalContainer);
  term.fit();

  // fit is called within a setTimeout, cols and rows need this.
  setTimeout(function () {
    // colsElementValue = term.cols;
    // rowsElementValue = term.rows;

    // // Set terminal size again to set the specific dimensions on the demo
    //setTerminalSize();
    console.log('rows', term.rows, 'cols', term.cols);
    fetch('/terminals?cols=' + term.cols + '&rows=' + term.rows, {method: 'POST'}).then(function (res) {

      res.text().then(function (pid) {
        window.pid = pid;
        var socketURL = baseSocketURL + pid;
        socket = new WebSocket(socketURL);
        socket.onopen = runRealTerminal;
        socket.onclose = runFakeTerminal;
        socket.onerror = runFakeTerminal;
      });
    });
  }, 0);

  window.addEventListener('resize', function() {
    term.fit();
  }, true);
}

function runRealTerminal() {
  term.attach(cmdSocket || socket);
  term._initialized = true;
}

function runFakeTerminal(e) {
  console.log('error or close', e)
  if (socket && cmdSocket) {
    term.detach(cmdSocket);
    cmdSocket = null;
    socket.send('\r');
    term.focus();
    //term.attach(socket);
  }
  if (term._initialized) {
    return;
  }

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
