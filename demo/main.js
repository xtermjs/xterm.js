var terminalContainer = document.getElementById('terminal-container'),
    term = new Terminal({geometry: [95, 37]});

term.prompt = function () {
    term.write('>  ');
}

term.open(terminalContainer);
term.writeln('Welcome to xterm.js');
term.writeln('Just type some keys in the prompt below.');
term.writeln('');
term.prompt();

term.on('key', function (key, ev) {
    console.log(this, key, ev);
    if (ev.keyIdentifier == 'Enter') {
        term.writeln('');
        term.prompt();
    } if (ev.keyCode == 8) {
        term.write('\b \b');
    }else {
        term.write(key);
    }
});