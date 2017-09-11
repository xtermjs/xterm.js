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
  //term.fit();

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
        socket.binaryType = "arraybuffer";
        socket.onopen = runRealTerminal;
        socket.onclose = runFakeTerminal;
        socket.onerror = runFakeTerminal;

        socket.addEventListener("message", handleWSMessage);
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

function _download(xfer, buffer) {
    var uint8array = new Uint8Array(buffer);
    var blob = new Blob([uint8array]);
    var url = URL.createObjectURL(blob);

    var el = document.createElement("a");
    el.style.display = "none";
    el.href = url;
    el.download = xfer.get_details().name;
    document.body.appendChild(el);

    //It seems like a security problem that this actually works.
    //But, hey.
    el.click();
}

function _update_progress(xfer) {
    document.getElementById("zm_progress").style.display = "";

    var total_in = xfer.get_offset();

    document.getElementById("bytes_received").textContent = total_in;

    var percent_received = 100 * total_in / xfer.get_details().size;
    document.getElementById("percent_received").textContent = percent_received;
}

// END UI STUFF
//----------------------------------------------------------------------

var text_encoder = new TextEncoder();
var zsentry = new Zmodem.Sentry();

var zsession;
function handleWSMessage(evt) {
    var input = Array.prototype.slice.call(
        new Uint8Array(
            (typeof evt.data === "string") ? text_encoder.encode(evt.data) : evt.data
        )
    );

    if (zsession) {
        zsession.consume(input);
        if (zsession.has_ended()) {
            if (zsession.type === "receive") {
                input = zsession.get_trailing_bytes();
            }
            else {
                input = [];
            }
            zsession = null;
        }
        else input = [];    //keep ZMODEM from going to the terminal
    }
    else {
        let termbytes;
        [termbytes, zsession] = zsentry.parse(input);
        input = termbytes;

        if (zsession) {

            zsession.set_sender( (octets) => {
                //socket.send( String.fromCharCode.apply(String, octets) );
                socket.send( new Uint8Array(octets) );
            } );

            var start_form = document.getElementById("zm_start");
            start_form.style.display = "";
            start_form.onsubmit = function(e) {
                start_form.style.display = "none";

                if (zsession.type === "receive") {
                    zsession.on("offer", function(xfer) {
                        _show_file_info(xfer);

                        var offer_form = document.getElementById("zm_offer");
                        offer_form.style.display = "";
                        offer_form.onsubmit = function(e) {
                            offer_form.style.display = "none";

                            if (offer_form.zmaccept) {
                                var FILE_BUFFER = [];
                                xfer.on("input", (payload) => {
                                    _update_progress(xfer);
                                    FILE_BUFFER.push.apply(FILE_BUFFER, payload);
                                });
                                xfer.accept().then( () => {
                                    _download(xfer, FILE_BUFFER);
                                    _hide_file_info();
                                } );
                            }
                            else {
                                _hide_file_info();
                                xfer.skip();
                            }
                        };
                    } );

                    zsession.start();
                }
                else {
                    var choose_form = document.getElementById("zm_choose");
                    choose_form.style.display = "";
                    choose_form.onsubmit = function(e) {
                        choose_form.style.display = "none";

                        var file_el = document.getElementById("zm_files");
                        var batch = [];
                        var total_size = 0;
                        for (var f=0; f<file_el.files.length; f++) {
                            var fobj = file_el.files[f];
                            batch.push( {
                                obj: fobj,
                                name: fobj.name,
                                size: fobj.size,
                            } );
                            total_size += fobj.size;
                        }

                        var file_idx = 0;
                        function promise_callback() {
                            var cur_b = batch[file_idx];
                            if (cur_b) {
                                file_idx++;

                                zsession.send_offer(cur_b).then( (xfer) => {
                                    if (xfer === undefined) {
                                        return promise_callback();   //skipped
                                    }

                                    return new Promise( (res) => {
                                        var reader = new FileReader();
                                        reader.onerror = function(e) {
                                            console.error("file read error", e);
                                            throw("File read error: " + e);
                                        };

                                        var offset = xfer.get_offset();
                                        reader.onprogress = function(e) {
                                            xfer.send(
                                                new Uint8Array(e.target.result, offset)
                                            );
                                            offset = e.loaded;
                                        };

                                        reader.onload = function(e) {
                                            xfer.end(
                                                new Uint8Array(e.target.result, offset)
                                            ).then(res).then(promise_callback);
                                        };

                                        reader.readAsArrayBuffer(cur_b.obj);
                                    } );
                                } )
                            }
                            else {
                                zsession.close();
                                choose_form.style.display = "none";
                            }
                        }

                        promise_callback();
                    };

                }
            };
        }
    }

    if (input.length) {
        term.write(
            String.fromCharCode.apply(String, input)
        );
    }
}

//var text_encoder = new TextEncoder();

function runRealTerminal() {
  //term.attach(socket);

    term.on("data", (d) => {
        //socket.send( text_encoder.encode(d) );
        socket.send(d);
    });

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
