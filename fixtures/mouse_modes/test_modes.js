let activeEnc = 0;

const stdin = process.openStdin();
process.stdin.setRawMode(true);

// close handler - reset terminal on exit
stdin.addListener('data', function(data) {
  if (data[0] === 0x04) {
      process.stdin.setRawMode(false);
      process.stdout.write('\x1bc');
      process.exit();
  }
  if (data[0] === 0x01) {
    switchActive();
    printMenu();
  }
  console.log('\x1b[100;H\x1b[2A\x1b[2KReport:', data, [data.toString('binary')]);
  // filter mouse reports
  if (data[0] === 0x1b && data[1] === '['.charCodeAt(0)) {
    applyReportData(data);
  }
});

const BUTTONS = ['left', 'middle', 'right'];

// encodings: ENCODING_NAME => [sequence, parse_report]
const ENC = {
  'X10'  : [
    '\x1b[?9h',
    // format: CSI M <button + 32> <row + 32> <col + 32>
    report => ({button: report[3] - 32, row: report[4] - 32, col: report[5] - 32})
  ],
  'UTF8' : [
    '\x1b[?9h\x1b[?1005h',
    // format: CSI M <button + 32> <row + 32> <col + 32>
    //         + utf8 encoding on row/col
    report => {
      const sReport = report.toString(); // decode with utf8
      return {button: sReport.charCodeAt(3) - 32, row: sReport.charCodeAt(4) - 32, col: sReport.charCodeAt(5) - 32};
    }
  ],
  'SGR'  : [
    '\x1b[?9h\x1b[?1006h',
    // format: CSI < Pbutton ; Prow ; Pcol M
    report => {
      // strip off introducer + M
      const sReport = report.toString().slice(3, -1);
      const [button, row, col] = sReport.split(';');
      return {button, row, col};
    }
  ],
  'URXVT': [
    '\x1b[?9h\x1b[?1015h',
    // format: CSI <button + 32> ; Prow ; Pcol M 
    report => {
      // strip off introducer + M
      const sReport = report.toString().slice(2, -1);
      const [button, row, col] = sReport.split(';');
      return {button: button - 32, row, col};
    }
  ]
}

function printMenu() {
  console.log('\x1b[2J\x1b\[HTest mouse reports [Ctrl-D to exit]');
  console.log();
  console.log('  Selected encoding [Ctrl-A to switch]');
  const encs = Object.keys(ENC);
  for (let i = 0; i < encs.length; ++i) {
    console.log(`  ${activeEnc === i ? '->' : '  '}  ${encs[i]}`);
  }
  process.stdout.write('\x1b[100;H');
}

function switchActive() {
  activeEnc++;
  activeEnc %= Object.keys(ENC).length;
  activate();
}

function activate() {
  // clear all protocols
  process.stdout.write('\x1b[?9l\x1b[?1005l\x1b[?1006l\x1b[?1015l');
  // apply new protocol
  process.stdout.write(ENC[Object.keys(ENC)[activeEnc]][0]);
  console.log('\x1b[100;H\x1b[2A\x1b[2KReport:');
}

function applyReportData(data) {
  let {button, row, col} = ENC[Object.keys(ENC)[activeEnc]][1](data);
  console.log('\x1b[2KButton:', BUTTONS[button], 'row:', row, 'col:', col);
  // apply to cursor position
  process.stdout.write(`\x1b[${col};${row}H`);
}

printMenu();
activate();
