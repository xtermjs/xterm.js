/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This file is the entry point for browserify.
 */

/// <reference path="../typings/xterm.d.ts"/>

import { Terminal } from '../lib/public/Terminal';
import * as attach from '../lib/addons/attach/attach';
import * as fit from '../lib/addons/fit/fit';
import * as fullscreen from '../lib/addons/fullscreen/fullscreen';
import * as search from '../lib/addons/search/search';
import * as webLinks from '../lib/addons/webLinks/webLinks';
import * as winptyCompat from '../lib/addons/winptyCompat/winptyCompat';

// Pulling in the module's types relies on the <reference> above, it's looks a
// little weird here as we're importing "this" module
import { Terminal as TerminalType } from 'xterm';

export interface IWindowWithTerminal extends Window {
  term: TerminalType;
}
declare let window: IWindowWithTerminal;

Terminal.applyAddon(attach);
Terminal.applyAddon(fit);
Terminal.applyAddon(fullscreen);
Terminal.applyAddon(search);
Terminal.applyAddon(webLinks);
Terminal.applyAddon(winptyCompat);


let term;
let protocol;
let socketURL;
let socket;
let pid;

const terminalContainer = document.getElementById('terminal-container');
const actionElements = {
  findNext: <HTMLInputElement>document.querySelector('#find-next'),
  findPrevious: <HTMLInputElement>document.querySelector('#find-previous')
};
const paddingElement = <HTMLInputElement>document.getElementById('padding');

function setPadding(): void {
  term.element.style.padding = parseInt(paddingElement.value, 10).toString() + 'px';
  term.fit();
}

createTerminal();

const disposeRecreateButtonHandler = () => {
  // If the terminal exists dispose of it, otherwise recreate it
  if (term) {
    term.dispose();
    term = null;
    window.term = null;
    socket = null;
    document.getElementById('dispose').innerHTML = 'Recreate Terminal';
  }
  else {
    createTerminal();
    document.getElementById('dispose').innerHTML = 'Dispose terminal';
  }
};

document.getElementById('dispose').addEventListener('click', disposeRecreateButtonHandler);

function createTerminal(): void {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }
  term = new Terminal({});
  window.term = term;  // Expose `term` to window for debugging purposes
  term.on('resize', (size: { cols: number, rows: number }) => {
    if (!pid) {
      return;
    }
    const cols = size.cols;
    const rows = size.rows;
    const url = '/terminals/' + pid + '/size?cols=' + cols + '&rows=' + rows;

    fetch(url, {method: 'POST'});
  });
  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/terminals/';

  term.open(terminalContainer);
  term.winptyCompatInit();
  term.webLinksInit();
  term.fit();
  term.focus();

  addDomListener(paddingElement, 'change', setPadding);

  addDomListener(actionElements.findNext, 'keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const searchOptions = {
        regex: (document.getElementById('regex') as HTMLInputElement).checked,
        wholeWord: (document.getElementById('whole-word') as HTMLInputElement).checked,
        caseSensitive: (document.getElementById('case-sensitive') as HTMLInputElement).checked
      };
      term.findNext(actionElements.findNext.value, searchOptions);
    }
  });
  addDomListener(actionElements.findPrevious, 'keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const searchOptions = {
        regex: (document.getElementById('regex') as HTMLInputElement).checked,
        wholeWord: (document.getElementById('whole-word') as HTMLInputElement).checked,
        caseSensitive: (document.getElementById('case-sensitive') as HTMLInputElement).checked
      };
      term.findPrevious(actionElements.findPrevious.value, searchOptions);
    }
  });

  // fit is called within a setTimeout, cols and rows need this.
  setTimeout(() => {
    initOptions(term);
    // TODO: Clean this up, opt-cols/rows doesn't exist anymore
    (<HTMLInputElement>document.getElementById(`opt-cols`)).value = term.cols;
    (<HTMLInputElement>document.getElementById(`opt-rows`)).value = term.rows;
    paddingElement.value = '0';

    // Set terminal size again to set the specific dimensions on the demo
    updateTerminalSize();

    fetch('/terminals?cols=' + term.cols + '&rows=' + term.rows, {method: 'POST'}).then((res) => {
      res.text().then((processId) => {
        pid = processId;
        socketURL += processId;
        socket = new WebSocket(socketURL);
        socket.onopen = runRealTerminal;
        socket.onclose = runFakeTerminal;
        socket.onerror = runFakeTerminal;
      });
    });
  }, 0);
}

function runRealTerminal(): void {
  term.attach(socket);
  term._initialized = true;
}

function runFakeTerminal(): void {
  if (term._initialized) {
    return;
  }

  term._initialized = true;

  term.prompt = () => {
    term.write('\r\n$ ');
  };

  term.writeln('Welcome to xterm.js');
  term.writeln('This is a local terminal emulation, without a real terminal in the back-end.');
  term.writeln('Type some keys and commands to play around.');
  term.writeln('');
  term.prompt();

  term._core.register(term.addDisposableListener('key', (key, ev) => {
    const printable = !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey;

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
  }));

  term._core.register(term.addDisposableListener('paste', (data, ev) => {
    term.write(data);
  }));
}

function initOptions(term: TerminalType): void {
  const blacklistedOptions = [
    // Internal only options
    'cancelEvents',
    'convertEol',
    'debug',
    'handler',
    'screenKeys',
    'termName',
    'useFlowControl',
    // Complex option
    'theme'
  ];
  const stringOptions = {
    bellSound: null,
    bellStyle: ['none', 'sound'],
    cursorStyle: ['block', 'underline', 'bar'],
    experimentalCharAtlas: ['none', 'static', 'dynamic', 'webgl'],
    fontFamily: null,
    fontWeight: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    fontWeightBold: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    rendererType: ['dom', 'canvas', 'webgl'],
    experimentalBufferLineImpl: ['JsArray', 'TypedArray']
  };
  const options = Object.keys((<any>term)._core.options);
  const booleanOptions = [];
  const numberOptions = [];
  options.filter(o => blacklistedOptions.indexOf(o) === -1).forEach(o => {
    switch (typeof term.getOption(o)) {
      case 'boolean':
        booleanOptions.push(o);
        break;
      case 'number':
        numberOptions.push(o);
        break;
      default:
        if (Object.keys(stringOptions).indexOf(o) === -1) {
          console.warn(`Unrecognized option: "${o}"`);
        }
    }
  });

  let html = '';
  html += '<div class="option-group">';
  booleanOptions.forEach(o => {
    html += `<div class="option"><label><input id="opt-${o}" type="checkbox" ${term.getOption(o) ? 'checked' : ''}/> ${o}</label></div>`;
  });
  html += '</div><div class="option-group">';
  numberOptions.forEach(o => {
    html += `<div class="option"><label>${o} <input id="opt-${o}" type="number" value="${term.getOption(o)}" step="${o === 'lineHeight' ? '0.1' : '1'}"/></label></div>`;
  });
  html += '</div><div class="option-group">';
  Object.keys(stringOptions).forEach(o => {
    if (stringOptions[o]) {
      html += `<div class="option"><label>${o} <select id="opt-${o}">${stringOptions[o].map(v => `<option ${term.getOption(o) === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>`;
    } else {
      html += `<div class="option"><label>${o} <input id="opt-${o}" type="text" value="${term.getOption(o)}"/></label></div>`;
    }
  });
  html += '</div>';

  const container = document.getElementById('options-container');
  container.innerHTML = html;

  // Attach listeners
  booleanOptions.forEach(o => {
    const input = <HTMLInputElement>document.getElementById(`opt-${o}`);
    addDomListener(input, 'change', () => {
      console.log('change', o, input.checked);
      term.setOption(o, input.checked);
    });
  });
  numberOptions.forEach(o => {
    const input = <HTMLInputElement>document.getElementById(`opt-${o}`);
    addDomListener(input, 'change', () => {
      console.log('change', o, input.value);
      if (o === 'cols' || o === 'rows') {
        updateTerminalSize();
      } else {
        term.setOption(o, o === 'lineHeight' ? parseFloat(input.value) : parseInt(input.value, 10));
      }
    });
  });
  Object.keys(stringOptions).forEach(o => {
    const input = <HTMLInputElement>document.getElementById(`opt-${o}`);
    addDomListener(input, 'change', () => {
      console.log('change', o, input.value);
      term.setOption(o, input.value);
    });
  });
}

function addDomListener(element: HTMLElement, type: string, handler: (...args: any[]) => any): void {
  element.addEventListener(type, handler);
  term._core.register({ dispose: () => element.removeEventListener(type, handler) });
}

function updateTerminalSize(): void {
  const cols = parseInt((<HTMLInputElement>document.getElementById(`opt-cols`)).value, 10);
  const rows = parseInt((<HTMLInputElement>document.getElementById(`opt-rows`)).value, 10);
  const width = (cols * term._core.renderer.dimensions.actualCellWidth + term._core.viewport.scrollBarWidth).toString() + 'px';
  const height = (rows * term._core.renderer.dimensions.actualCellHeight).toString() + 'px';
  terminalContainer.style.width = width;
  terminalContainer.style.height = height;
  term.fit();
}
