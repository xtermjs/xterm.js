var terminalContainer = document.getElementById('terminal-container'),
    term = new Terminal({
      geometry: [95, 37]
    });

term.prompt = function () {
  console.log('before promtp');
  term.writeln('>  ');
  console.log('after promtp');
}

term.open(terminalContainer);
term.writeln('Welcome to xterm.js');
term.writeln('Just type some keys in the prompt below.');
term.writeln('');
term.prompt();

term.on('key', function (key, ev) {
  var printable = (!ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey);

  if (ev.keyIdentifier == 'Enter') {
    ev.preventDefault();
    term.writeln('');
    term.prompt();
  } else if (ev.keyCode == 8) {
    term.write('\b \b');
  } else if (printable) {
    term.write(key);
  }
});