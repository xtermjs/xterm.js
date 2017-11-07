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
  setTimeout(function () {
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

        term.zmodemAttach(socket, {
            noTerminalWriteOutsideSession: true,
        } );

        term.on("zmodemRetract", () => {
            start_form.style.display = "none";
            start_form.onsubmit = null;
        });

        term.on("zmodemDetect", (detection) => {
            function do_zmodem() {
                term.detach();
                let zsession = detection.confirm();

                var promise;

                if (zsession.type === "receive") {
                    promise = _handle_receive_session(zsession);
                }
                else {
                    promise = _handle_send_session(zsession);
                }

                promise.catch( console.error.bind(console) ).then( () => {
                    term.attach(socket);
                } );
            }

            if (_auto_zmodem()) {
                do_zmodem();
            }
            else {
                start_form.style.display = "";
                start_form.onsubmit = function(e) {
                    start_form.style.display = "none";

                    if (document.getElementById("zmstart_yes").checked) {
                        do_zmodem();
                    }
                    else {
                        detection.deny();
                    }
                };
            }
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

    var xfer_opts = xfer.get_options();
    ["conversion", "management", "transport", "sparse"].forEach( (lbl) => {
        document.getElementById(`zfile_${lbl}`).textContent = xfer_opts[lbl];
    } );

    document.getElementById("zm_file").style.display = "";
}
function _hide_file_info() {
    document.getElementById("zm_file").style.display = "none";
}

function _save_to_disk(xfer, buffer) {
    return Zmodem.Browser.save_to_disk(buffer, xfer.get_details().name);
}

var skipper_button = document.getElementById("zm_progress_skipper");
var skipper_button_orig_text = skipper_button.textContent;

function _show_progress() {
    skipper_button.disabled = false;
    skipper_button.textContent = skipper_button_orig_text;

    document.getElementById("bytes_received").textContent = 0;
    document.getElementById("percent_received").textContent = 0;

    document.getElementById("zm_progress").style.display = "";
}

function _update_progress(xfer) {
    var total_in = xfer.get_offset();

    document.getElementById("bytes_received").textContent = total_in;

    var percent_received = 100 * total_in / xfer.get_details().size;
    document.getElementById("percent_received").textContent = percent_received.toFixed(2);
}

function _hide_progress() {
    document.getElementById("zm_progress").style.display = "none";
}

var start_form = document.getElementById("zm_start");

function _auto_zmodem() {
    return document.getElementById("zmodem-auto").checked;
}

// END UI STUFF
//----------------------------------------------------------------------

function _handle_receive_session(zsession) {
    zsession.on("offer", function(xfer) {
        current_receive_xfer = xfer;

        _show_file_info(xfer);

        var offer_form = document.getElementById("zm_offer");

        function on_form_submit() {
            offer_form.style.display = "none";

            //START
            //if (offer_form.zmaccept.value) {
            if (_auto_zmodem() || document.getElementById("zmaccept_yes").checked) {
                _show_progress();

                var FILE_BUFFER = [];
                xfer.on("input", (payload) => {
                    _update_progress(xfer);
                    FILE_BUFFER.push( new Uint8Array(payload) );
                });
                xfer.accept().then(
                    () => {
                        _save_to_disk(xfer, FILE_BUFFER);
                    },
                    console.error.bind(console)
                );
            }
            else {
                xfer.skip();
            }
            //END
        }

        if (_auto_zmodem()) {
            on_form_submit();
        }
        else {
            offer_form.onsubmit = on_form_submit;
            offer_form.style.display = "";
        }
    } );

    var promise = new Promise( (res) => {
        zsession.on("session_end", () => {
            _hide_file_info();
            _hide_progress();
            res();
        } );
    } );

    zsession.start();

    return promise;
}

function _handle_send_session(zsession) {
    var choose_form = document.getElementById("zm_choose");
    choose_form.style.display = "";

    var file_el = document.getElementById("zm_files");

    var promise = new Promise( (res) => {
        file_el.onchange = function(e) {
            choose_form.style.display = "none";

            var files_obj = file_el.files;

            Zmodem.Browser.send_files(
                zsession,
                files_obj,
                {
                    on_offer_response(obj, xfer) {
                        if (xfer) _show_progress();
                        //console.log("offer", xfer ? "accepted" : "skipped");
                    },
                    on_progress(obj, xfer) {
                        _update_progress(xfer);
                    },
                    on_file_complete(obj) {
                        //console.log("COMPLETE", obj);
                        _hide_progress();
                    },
                }
            ).then(_hide_progress).then(
                zsession.close.bind(zsession),
                console.error.bind(console)
            ).then( () => {
                _hide_file_info();
                _hide_progress();
                res();
            } );
        };
    } );

    return promise;
}

//This is here to allow canceling of an in-progress ZMODEM transfer.
var current_receive_xfer;

//Called from HTML directly.
function skip_current_file() {
    current_receive_xfer.skip();

    skipper_button.disabled = true;
    skipper_button.textContent = "Waiting for server to acknowledge skip …";
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
