"use strict";

var term,
    protocol,
    socketURL,
    socket,
    pid;

var terminalContainer = document.getElementById('terminal-container'),
    actionElements = {
      findNext: document.querySelector('#find-next'),
      findPrevious: document.querySelector('#find-previous')
    },
    optionElements = {
      cursorBlink: document.querySelector('#option-cursor-blink'),
      cursorStyle: document.querySelector('#option-cursor-style'),
      scrollback: document.querySelector('#option-scrollback'),
      tabstopwidth: document.querySelector('#option-tabstopwidth'),
      bellStyle: document.querySelector('#option-bell-style')
    },
    colsElement = document.getElementById('cols'),
    rowsElement = document.getElementById('rows');

function setTerminalSize() {
  var cols = parseInt(colsElement.value, 10);
  var rows = parseInt(rowsElement.value, 10);
  var viewportElement = document.querySelector('.xterm-viewport');
  var scrollBarWidth = viewportElement.offsetWidth - viewportElement.clientWidth;
  var width = (cols * term.charMeasure.width + 20 /*room for scrollbar*/).toString() + 'px';
  var height = (rows * term.charMeasure.height).toString() + 'px';

  terminalContainer.style.width = width;
  terminalContainer.style.height = height;
  term.resize(cols, rows);
}

colsElement.addEventListener('change', setTerminalSize);
rowsElement.addEventListener('change', setTerminalSize);

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
optionElements.bellStyle.addEventListener('change', function () {
  term.setOption('bellStyle', optionElements.bellStyle.value);
});
optionElements.scrollback.addEventListener('change', function () {
  term.setOption('scrollback', parseInt(optionElements.scrollback.value, 10));
});
optionElements.tabstopwidth.addEventListener('change', function () {
  term.setOption('tabStopWidth', parseInt(optionElements.tabstopwidth.value, 10));
});

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

  // fit is called within a setTimeout, cols and rows need this.
  setTimeout(() => {
    colsElement.value = term.cols;
    rowsElement.value = term.rows;

    // Set terminal size again to set the specific dimensions on the demo
    setTerminalSize();

    fetch('/terminals?cols=' + term.cols + '&rows=' + term.rows, {method: 'POST'}).then(function (res) {

      res.text().then(function (pid) {
        window.pid = pid;
        socketURL += pid;
        socket = new WebSocket(socketURL);
        socket.onopen = runRealTerminal;
        socket.onclose = runFakeTerminal;
        socket.onerror = runFakeTerminal;

        term.zmodemAttach(socket);

        term.on("zmodemRetract", () => {
            start_form.style.display = "none";
            start_form.onsubmit = null;
        });

        term.on("zmodemDetect", (detection) => {
            start_form.style.display = "";
            start_form.onsubmit = function(e) {
                start_form.style.display = "none";

                if (document.getElementById("zmstart_yes").checked) {

                    try {
                        term.detach();
                        let zsession = detection.confirm();

                        current_zsession = zsession;

                        if (zsession.type === "receive") {
                            _handle_receive_session(zsession);
                        }
                        else {
                            _handle_send_session(zsession);
                        }
                    }
                    catch(e) { throw e }
                    finally {
                        term.attach(socket);
                    }
                }
                else {
                    detection.deny();
                }
            };
        });
      });
    });
  }, 0);
}

//----------------------------------------------------------------------
// UI STUFF

function _show_file_info(xfer) {
    var file_info = xfer.get_details();

    document.getElementById("name").textContent = file_info.name;
    document.getElementById("size").textContent = file_info.size;
    document.getElementById("mtime").textContent = file_info.mtime;
    document.getElementById("files_remaining").textContent = file_info.files_remaining;
    document.getElementById("bytes_remaining").textContent = file_info.bytes_remaining;

    document.getElementById("mode").textContent = "0" + file_info.mode.toString(8);

    document.getElementById("zm_file").style.display = "";
}
function _hide_file_info() {
    document.getElementById("zm_file").style.display = "none";
}

function _save_to_disk(xfer, buffer) {
    return Zmodem.Browser.save_to_disk(buffer, xfer.get_details().name);
}

function _update_progress(xfer) {
    document.getElementById("zm_progress").style.display = "";

    var total_in = xfer.get_offset();

    document.getElementById("bytes_received").textContent = total_in;

    var percent_received = 100 * total_in / xfer.get_details().size;
    document.getElementById("percent_received").textContent = percent_received;
}

function _hide_progress() {
    document.getElementById("zm_progress").style.display = "none";
}

var start_form = document.getElementById("zm_start");

// END UI STUFF
//----------------------------------------------------------------------

function _handle_receive_session(zsession) {
    zsession.on("offer", function(xfer) {
        _show_file_info(xfer);

        var offer_form = document.getElementById("zm_offer");
        offer_form.style.display = "";
        offer_form.onsubmit = function(e) {
            var the_form = e.currentTarget;
            the_form.style.display = "none";

            //START
            //if (offer_form.zmaccept.value) {
            if (document.getElementById("zmaccept_yes").checked) {
                var FILE_BUFFER = [];
                xfer.on("input", (payload) => {
                    _update_progress(xfer);
                    FILE_BUFFER.push( new Uint8Array(payload) );
                });
                xfer.accept().then(
                    () => {
                        _hide_file_info();
                        _hide_progress();
                        _save_to_disk(xfer, FILE_BUFFER);
                    },
                    console.error.bind(console)
                );
            }
            else {
                xfer.skip();
            }
            //END
        };
    } );

    zsession.start();
}

function _handle_send_session(zsession) {
    var choose_form = document.getElementById("zm_choose");
    choose_form.style.display = "";
    choose_form.onsubmit = function(e) {
        choose_form.style.display = "none";

        var file_el = document.getElementById("zm_files");
        var files_obj = file_el.files;

        Zmodem.Browser.send_files(
            zsession,
            files_obj,
            {
                on_offer_response(obj, xfer) {
                    console.log("offer", xfer ? "accepted" : "skipped");
                },
                on_progress(obj, xfer) {
                    _update_progress(xfer);
                },
                on_file_complete(obj) {
                    console.log("COMPLETE", obj);
                    _hide_progress();
                },
            }
        ).then(_hide_progress).then(
            zsession.close.bind(zsession),
            console.error.bind(console)
        ).then( () => {
            _hide_file_info();
            _hide_progress();
        } );
    };
}

//This is here to allow canceling of an in-progress ZMODEM transfer.
var current_zsession;

//Called from HTML directly.
function abort_current_session() {
    current_zsession.abort();
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
