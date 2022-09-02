/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 * 
 * Script to test different mouse modes in terminal emulators.
 * Tests for protocols DECSET 9, 1000, 1002, 1003 with different
 * report encodings (default, UTF8, SGR, URXVT, SGR-pixels).
 * 
 * VT200 Highlight mode (DECSET 1001) is not implemented.
 * 
 * The test basically applies the report data to the cursor, thus
 * a mouse report should move the cursor to the cell under the mouse.
 * Furthermore the reports are printed in the left lower corner as
 * raw data and their meaning.
 * 
 * A failing test might show:
 *  - wrong coords: the cursor will jump to some other place
 *  - wrong buttons: see meaning output and check whether it makes sense
 *  - faulty reports: inspect the raw data and compare with other emulators
 *  - missing events: compare with spec / other emulators
 */

let activeProtocol = 0;
let activeEnc = 0;

const stdin = process.openStdin();
process.stdin.setRawMode(true);

// close handler - reset terminal on exit
stdin.addListener('data', function(data) {
  if (data[0] === 0x03) {
      process.stdin.setRawMode(false);
      process.stdout.write('\x1bc');
      process.exit();
  }
  if (data[0] === 0x01) {
    switchActiveProtocol();
    printMenu();
  }
  if (data[0] === 0x02) {
    switchActiveEnc();
    printMenu();
  }
  console.log('\x1b[100;H\x1b[2A\x1b[2KReport:', data, [data.toString('binary')]);
  // filter mouse reports
  if (data[0] === 0x1b && data[1] === '['.charCodeAt(0)) {
    applyReportData(data);
  }
});

// button definitions
const buttons = {
  '<none>':  -1,
  left:       0,
  middle:     1,
  right:      2,
  released:   3,
  wheelUp:    4,
  wheelDown:  5,
  wheelLeft:  6,
  wheelRight: 7,
  aux1:       8,
  aux2:       9,
  aux3:      10,
  aux4:      11,
  aux5:      12,
  aux6:      13,
  aux7:      14,
  aux8:      15
};
const reverseButtons = {};
for (const el in buttons) {
  reverseButtons[buttons[el]] = el;
}

// extract button data from buttonCode
function evalButtonCode(code) {
  // more than 15 buttons are not supported
  if (code > 255) {
    return {button: 'invalid', action: 'invalid', modifier: {}};
  }
  const modifier = {shift: !!(code & 4), meta: !!(code & 8), control: !!(code & 16)};
  const move = code & 32;
  let button = code & 3;
  if (code & 128) {
    button |= 8;
  }
  if (code & 64) {
    button |= 4
  }
  let action = 'press';
  let buttonS = reverseButtons[button];
  if (button === 3) {
    buttonS = '<none>';
    action = 'release';
  }
  if (move) {
    action = 'move';
  } else if (4 <= button && button <= 7) {
    buttonS = 'wheel';
    action = button === 4 ? 'up' : button === 5 ? 'down' : button === 6 ? 'left' : 'right';
  }
  return {button: buttonS, action, modifier};
}

// protocols
const PROTOCOLS = {
  '9    (X10: press only)': '\x1b[?9h',
  '1000 (VT200: press, release, wheel)': '\x1b[?1000h',
  // '1001 (VT200 highlight)': '\x1b[?1001h',  // handle of backreport - not implemented
  '1002 (press, release, move on pressed, wheel)': '\x1b[?1002h',
  '1003 (press, relase, move, wheel)': '\x1b[?1003h'
}

// encodings: ENCODING_NAME => [sequence, parse_report]
const ENC = {
  'DEFAULT'  : [
    '',
    // format: CSI M <button + 32> <row + 32> <col + 32>
    report => ({
      state: evalButtonCode(report[3] - 32),
      col: report[4] - 32,
      row: report[5] - 32
    })
  ],
  'UTF8' : [
    '\x1b[?1005h',
    // format: CSI M <button + 32> <row + 32> <col + 32>
    //         + utf8 encoding on row/col
    report => {
      const sReport = report.toString(); // decode with utf8
      return {
        state: evalButtonCode(sReport.charCodeAt(3) - 32),
        col: sReport.charCodeAt(4) - 32,
        row: sReport.charCodeAt(5) - 32
      };
    }
  ],
  'SGR'  : [
    '\x1b[?1006h',
    // format: CSI < Pbutton ; Prow ; Pcol M
    report => {
      // strip off introducer + M
      const sReport = report.toString().slice(3, -1);
      const [buttonCode, col, row] = sReport.split(';');
      const state = evalButtonCode(buttonCode);
      if (report[report.length - 1] === 'm'.charCodeAt(0)) {
        state.action = 'release';
      }
      return {state, row, col};
    }
  ],
  'URXVT': [
    '\x1b[?1015h',
    // format: CSI <button + 32> ; Prow ; Pcol M
    report => {
      // strip off introducer + M
      const sReport = report.toString().slice(2, -1);
      const [button, col, row] = sReport.split(';');
      return {state: evalButtonCode(button - 32), row, col};
    }
  ],
  'SGR_PIXELS'  : [
    '\x1b[?1016h',
    // format: CSI < Pbutton ; Prow ; Pcol M
    report => {
      // strip off introducer + M
      const sReport = report.toString().slice(3, -1);
      const [buttonCode, col, row] = sReport.split(';');
      const state = evalButtonCode(buttonCode);
      if (report[report.length - 1] === 'm'.charCodeAt(0)) {
        state.action = 'release';
      }
      return {state, row, col};
    }
  ]
}

function printMenu() {
  console.log('\x1b[2J\x1b\[HTest mouse reports [Ctrl-C to exit]');
  console.log();
  console.log('  Selected protocol [Ctrl-A to switch]');
  const protocols = Object.keys(PROTOCOLS);
  for (let i = 0; i < protocols.length; ++i) {
    console.log(`  ${activeProtocol === i ? '->' : '  '}  ${protocols[i]}`);
  }
  console.log();
  console.log('  Selected encoding [Ctrl-B to switch]');
  const encs = Object.keys(ENC);
  for (let i = 0; i < encs.length; ++i) {
    console.log(`  ${activeEnc === i ? '->' : '  '}  ${encs[i]}`);
  }
  process.stdout.write('\x1b[100;H');
}

function switchActiveProtocol() {
  activeProtocol++;
  activeProtocol %= Object.keys(PROTOCOLS).length;
  activate();
}

function switchActiveEnc() {
  activeEnc++;
  activeEnc %= Object.keys(ENC).length;
  activate();
}

function activate() {
  // clear all protocols and encodings
  process.stdout.write('\x1b[?9l\x1b[?1000l\x1b[?1001l\x1b[?1002l\x1b[?1003l');
  process.stdout.write('\x1b[?1005l\x1b[?1006l\x1b[?1015l');
  // apply new protocol and encoding
  process.stdout.write(PROTOCOLS[Object.keys(PROTOCOLS)[activeProtocol]]);
  process.stdout.write(ENC[Object.keys(ENC)[activeEnc]][0]);
  console.log('\x1b[100;H\x1b[2A\x1b[2KReport:');
}

function applyReportData(data) {
  let {state, row, col} = ENC[Object.keys(ENC)[activeEnc]][1](data);
  if (Object.keys(ENC)[activeEnc] !== 'SGR_PIXELS') {
    console.log('\x1b[2KButton:', state.button, 'Action:', state.action, 'Modifier:', state.modifier, 'row:', row, 'col:', col);
    process.stdout.write(`\x1b[${row};${col}H`);
  } else {
    console.log('\x1b[2KButton:', state.button, 'Action:', state.action, 'Modifier:', state.modifier, 'x:', row, 'y:', col);
  }
}

printMenu();
activate();
