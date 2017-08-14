var term,
    protocol,
    socketURL,
    socket,
    pid;

Split(['#left', '#right'], {
  direction: 'horizontal',
  sizes: [50, 50],
  minSize: 1
});

Split(['#top', '#bottom'], {
  direction: 'vertical',
  sizes: [50, 50],
  minSize: 1
});

var terminalContainer = document.getElementById('terminal-container'),
    verticalResizer = document.getElementsByClassName('gutter gutter-vertical')[0],
    horizontalResizer = document.getElementsByClassName('gutter gutter-horizontal')[0],
    rightPanel = document.getElementById("right"),
    actionElements = {
      findNext: document.querySelector('#find-next'),
      findPrevious: document.querySelector('#find-previous')
    },
    optionElements = {
      cursorBlink: document.querySelector('#option-cursor-blink'),
      cursorStyle: document.querySelector('#option-cursor-style'),
      scrollback: document.querySelector('#option-scrollback'),
      tabstopwidth: document.querySelector('#option-tabstopwidth')
    };

actionElements.findNext.addEventListener('keypress', function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    term.findNext(actionElements.findNext.value);
  }
});
actionElements.findPrevious.addEventListener('keypress', function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    term.findPrevious(actionElements.findPrevious.value);
  }
});

optionElements.cursorBlink.addEventListener('change', function () {
  term.setOption('cursorBlink', optionElements.cursorBlink.checked);
});
optionElements.cursorStyle.addEventListener('change', function () {
  term.setOption('cursorStyle', optionElements.cursorStyle.value);
});
optionElements.scrollback.addEventListener('change', function () {
  term.setOption('scrollback', parseInt(optionElements.scrollback.value, 10));
});
optionElements.tabstopwidth.addEventListener('change', function () {
  term.setOption('tabStopWidth', parseInt(optionElements.tabstopwidth.value, 10));
});

function resize() {
  verticalResizer.addEventListener('mousedown', initResize, false);
  horizontalResizer.addEventListener('mousedown', initResize, false);

  function initResize(e) {
    window.addEventListener('mousemove', Resize, false);
    window.addEventListener('mouseup', stopResize, false);
  }

  function Resize(e) {
    terminalContainer.style.width = terminalContainer.parentNode.parentElement.width;
    terminalContainer.style.height = terminalContainer.parentNode.parentElement.height;
    console.log(terminalContainer.style.width);
    resizeTerminal();
  }

  function stopResize(e) {
    window.removeEventListener('mousemove', Resize, false);
    window.removeEventListener('mouseup', stopResize, false);
  }
}
resize();

function resizeTerminal() {
  var initialGeometry = term.proposeGeometry(),
    cols = initialGeometry.cols,
    rows = initialGeometry.rows;
  term.resize(cols, rows);
}

createTerminal();

function createTerminal() {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }
  term = new Terminal({
    cursorBlink: optionElements.cursorBlink.checked,
    scrollback: parseInt(optionElements.scrollback.value, 10),
    tabStopWidth: parseInt(optionElements.tabstopwidth.value, 10)
  });

  createTerminalInfoTools(term, rightPanel);

  term.on('resize', function (size) {
    if (!pid) {
      return;
    }
    var cols = size.cols,
        rows = size.rows,
        url = '/terminals/' + pid + '/size?cols=' + cols + '&rows=' + rows;

    fetch(url, {method: 'POST'});
  });
  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/terminals/';

  term.open(terminalContainer);
  term.fit();

  var initialGeometry = term.proposeGeometry(),
      cols = initialGeometry.cols,
      rows = initialGeometry.rows;

  fetch('/terminals?cols=' + cols + '&rows=' + rows, {method: 'POST'}).then(function (res) {

    res.text().then(function (pid) {
      window.pid = pid;
      socketURL += pid;
      socket = new WebSocket(socketURL);
      socket.onopen = runRealTerminal;
      socket.onclose = runFakeTerminal;
      socket.onerror = runFakeTerminal;
    });
  });
}

function runRealTerminal() {
  term.attach(socket);
  term._initialized = true;
}

function runFakeTerminal() {
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

    if (ev.keyCode === 13) {
      term.prompt();
    } else if (ev.keyCode === 8) {
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

function createTerminalInfoTools(terminal, panel) {
  var rowsElem = createDisplayElement("Amount of rows:", function (ev) {
    terminal.rows = this.value;
  });
  panel.appendChild(rowsElem.view);

  var colsElem = createDisplayElement("Amount of cols:");
  panel.appendChild(colsElem.view);

  var ydispElem = createDisplayElement("Ydisp:");
  panel.appendChild(ydispElem.view);

  var yBaseElem = createDisplayElement("Ybase:");
  panel.appendChild(yBaseElem.view);

  var scrollTopElem = createDisplayElement("ScrollTop:");
  panel.appendChild(scrollTopElem.view);

  var scrollBottomElem = createDisplayElement("ScrollBottom:");
  panel.appendChild(scrollBottomElem.view);

  var xElem = createDisplayElement("X:");
  panel.appendChild(xElem.view);

  var yElem = createDisplayElement("Y:");
  panel.appendChild(yElem.view);

  var xSavedElem = createDisplayElement("Xsaved:");
  panel.appendChild(xSavedElem.view);

  var ySavedElem = createDisplayElement("Ysaved:");
  panel.appendChild(ySavedElem.view);

  var linesElem = createDisplayElement("Lines length:");
  panel.appendChild(linesElem.view);

  setInterval(function () {
    rowsElem.valueElem.innerHTML = terminal.rows.toString();
    colsElem.valueElem.innerHTML = terminal.cols.toString();
    ydispElem.valueElem.innerHTML = terminal.buffer.ydisp.toString();
    yBaseElem.valueElem.innerHTML = terminal.buffer.ybase.toString();
    scrollTopElem.valueElem.innerHTML = terminal.buffer.scrollTop.toString();
    scrollBottomElem.valueElem.innerHTML = terminal.buffer.scrollBottom.toString();
    xElem.valueElem.innerHTML = terminal.buffer.x.toString();
    yElem.valueElem.innerHTML = terminal.buffer.y.toString();
    xSavedElem.valueElem.innerHTML = typeof terminal.buffer.savedX !== 'undefined' ? terminal.buffer.savedX.toString() : '';
    ySavedElem.valueElem.innerHTML = typeof terminal.buffer.savedY !== 'undefined' ? terminal.buffer.savedY.toString() : '';
    linesElem.valueElem.innerHTML = terminal.buffer.lines.length.toString();
  }, 500);
}

function createDisplayElement(title) {
  var parentElem = document.createElement("div");

  //inner content
  var titleElement = document.createElement("span");
  titleElement.innerHTML = title;
  var valueElement = document.createElement("span");
  valueElement.classList = 'value-disp';

  parentElem.appendChild(titleElement);
  parentElem.appendChild(valueElement);


  parentElem.className = "elem";

  return {view: parentElem, valueElem: valueElement};
}
