var terminalContainer = document.getElementById('terminal-container'),
    term = new Terminal();

term.open(terminalContainer);
term.fit();

term.prompt = function () {
  term.write('\r\n> ');
}

term.writeln('Welcome to xterm.js');
term.writeln('Just type some keys in the prompt below.');
term.writeln('');
term.prompt();

term.on('key', function (key, ev) {
  var printable = (!ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey);

  if (ev.keyIdentifier == 'Enter') {
    term.prompt();
  } else if (ev.keyCode == 8) {
    term.write('\b \b');
  } else if (printable) {
    term.write(key);
  }
});