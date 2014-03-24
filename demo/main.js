var terminalContainer = document.getElementById('terminal-container'),
    term = new Terminal({geometry: [60, 37]});

term.open(terminalContainer);

term.on('data', function (data) {
    term.write(data);
});