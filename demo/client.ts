/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This file is the entry point for browserify.
 */

/// <reference path="../typings/xterm.d.ts"/>

// Use tsc version (yarn watch)
import { Terminal } from '../out/browser/public/Terminal';
import { AttachAddon } from '../addons/xterm-addon-attach/out/AttachAddon';
import { CanvasAddon } from '../addons/xterm-addon-canvas/out/CanvasAddon';
import { FitAddon } from '../addons/xterm-addon-fit/out/FitAddon';
import { SearchAddon, ISearchOptions } from '../addons/xterm-addon-search/out/SearchAddon';
import { SerializeAddon } from '../addons/xterm-addon-serialize/out/SerializeAddon';
import { WebLinksAddon } from '../addons/xterm-addon-web-links/out/WebLinksAddon';
import { WebglAddon } from '../addons/xterm-addon-webgl/out/WebglAddon';
import { Unicode11Addon } from '../addons/xterm-addon-unicode11/out/Unicode11Addon';
import { LigaturesAddon } from '../addons/xterm-addon-ligatures/out/LigaturesAddon';

// Use webpacked version (yarn package)
// import { Terminal } from '../lib/xterm';
// import { AttachAddon } from 'xterm-addon-attach';
// import { FitAddon } from 'xterm-addon-fit';
// import { SearchAddon, ISearchOptions } from 'xterm-addon-search';
// import { SerializeAddon } from 'xterm-addon-serialize';
// import { WebLinksAddon } from 'xterm-addon-web-links';
// import { WebglAddon } from 'xterm-addon-webgl';
// import { Unicode11Addon } from 'xterm-addon-unicode11';
// import { LigaturesAddon } from 'xterm-addon-ligatures';

// Pulling in the module's types relies on the <reference> above, it's looks a
// little weird here as we're importing "this" module
import { Terminal as TerminalType, ITerminalOptions } from 'xterm';

export interface IWindowWithTerminal extends Window {
  term: TerminalType;
  Terminal?: typeof TerminalType;
  AttachAddon?: typeof AttachAddon;
  FitAddon?: typeof FitAddon;
  SearchAddon?: typeof SearchAddon;
  SerializeAddon?: typeof SerializeAddon;
  WebLinksAddon?: typeof WebLinksAddon;
  WebglAddon?: typeof WebglAddon;
  Unicode11Addon?: typeof Unicode11Addon;
  LigaturesAddon?: typeof LigaturesAddon;
}
declare let window: IWindowWithTerminal;

let term;
let protocol;
let socketURL;
let socket;
let pid;

type AddonType = 'attach' | 'canvas' | 'fit' | 'search' | 'serialize' | 'unicode11' | 'web-links' | 'webgl' | 'ligatures';

interface IDemoAddon<T extends AddonType> {
  name: T;
  canChange: boolean;
  ctor:
    T extends 'attach' ? typeof AttachAddon :
    T extends 'canvas' ? typeof CanvasAddon :
    T extends 'fit' ? typeof FitAddon :
    T extends 'search' ? typeof SearchAddon :
    T extends 'serialize' ? typeof SerializeAddon :
    T extends 'web-links' ? typeof WebLinksAddon :
    T extends 'unicode11' ? typeof Unicode11Addon :
    T extends 'ligatures' ? typeof LigaturesAddon :
    typeof WebglAddon;
    instance?:
    T extends 'attach' ? AttachAddon :
    T extends 'canvas' ? CanvasAddon :
    T extends 'fit' ? FitAddon :
    T extends 'search' ? SearchAddon :
    T extends 'serialize' ? SerializeAddon :
    T extends 'web-links' ? WebLinksAddon :
    T extends 'webgl' ? WebglAddon :
    T extends 'unicode11' ? typeof Unicode11Addon :
    T extends 'ligatures' ? typeof LigaturesAddon :
    never;
}

const addons: { [T in AddonType]: IDemoAddon<T> } = {
  attach: { name: 'attach', ctor: AttachAddon, canChange: false },
  canvas: { name: 'canvas', ctor: CanvasAddon, canChange: true },
  fit: { name: 'fit', ctor: FitAddon, canChange: false },
  search: { name: 'search', ctor: SearchAddon, canChange: true },
  serialize: { name: 'serialize', ctor: SerializeAddon, canChange: true },
  'web-links': { name: 'web-links', ctor: WebLinksAddon, canChange: true },
  webgl: { name: 'webgl', ctor: WebglAddon, canChange: true },
  unicode11: { name: 'unicode11', ctor: Unicode11Addon, canChange: true },
  ligatures: { name: 'ligatures', ctor: LigaturesAddon, canChange: true }
};

const terminalContainer = document.getElementById('terminal-container');
const actionElements = {
  find: <HTMLInputElement>document.querySelector('#find'),
  findNext: <HTMLInputElement>document.querySelector('#find-next'),
  findPrevious: <HTMLInputElement>document.querySelector('#find-previous'),
  findResults: document.querySelector('#find-results')
};
const paddingElement = <HTMLInputElement>document.getElementById('padding');

const xtermjsTheme = {
  foreground: '#F8F8F8',
  background: '#2D2E2C',
  selectionBackground: '#5DA5D533',
  black: '#1E1E1D',
  brightBlack: '#262625',
  red: '#CE5C5C',
  brightRed: '#FF7272',
  green: '#5BCC5B',
  brightGreen: '#72FF72',
  yellow: '#CCCC5B',
  brightYellow: '#FFFF72',
  blue: '#5D5DD3',
  brightBlue: '#7279FF',
  magenta: '#BC5ED1',
  brightMagenta: '#E572FF',
  cyan: '#5DA5D5',
  brightCyan: '#72F0FF',
  white: '#F8F8F8',
  brightWhite: '#FFFFFF'
};
function setPadding(): void {
  term.element.style.padding = parseInt(paddingElement.value, 10).toString() + 'px';
  addons.fit.instance.fit();
}

function getSearchOptions(e: KeyboardEvent): ISearchOptions {
  return {
    regex: (document.getElementById('regex') as HTMLInputElement).checked,
    wholeWord: (document.getElementById('whole-word') as HTMLInputElement).checked,
    caseSensitive: (document.getElementById('case-sensitive') as HTMLInputElement).checked,
    incremental: e.key !== `Enter`,
    decorations: (document.getElementById('highlight-all-matches') as HTMLInputElement).checked ? {
      matchBackground: '#232422',
      matchBorder: '#555753',
      matchOverviewRuler: '#555753',
      activeMatchBackground: '#ef2929',
      activeMatchBorder: '#ffffff',
      activeMatchColorOverviewRuler: '#ef2929'
    } : undefined
  };
}

const disposeRecreateButtonHandler = () => {
  // If the terminal exists dispose of it, otherwise recreate it
  if (term) {
    term.dispose();
    term = null;
    window.term = null;
    socket = null;
    addons.attach.instance = undefined;
    addons.canvas.instance = undefined;
    addons.fit.instance = undefined;
    addons.search.instance = undefined;
    addons.serialize.instance = undefined;
    addons.unicode11.instance = undefined;
    addons.ligatures.instance = undefined;
    addons['web-links'].instance = undefined;
    addons.webgl.instance = undefined;
    document.getElementById('dispose').innerHTML = 'Recreate Terminal';
  } else {
    createTerminal();
    document.getElementById('dispose').innerHTML = 'Dispose terminal';
  }
};

if (document.location.pathname === '/test') {
  window.Terminal = Terminal;
  window.AttachAddon = AttachAddon;
  window.FitAddon = FitAddon;
  window.SearchAddon = SearchAddon;
  window.SerializeAddon = SerializeAddon;
  window.Unicode11Addon = Unicode11Addon;
  window.LigaturesAddon = LigaturesAddon;
  window.WebLinksAddon = WebLinksAddon;
  window.WebglAddon = WebglAddon;
} else {
  createTerminal();
  document.getElementById('dispose').addEventListener('click', disposeRecreateButtonHandler);
  document.getElementById('serialize').addEventListener('click', serializeButtonHandler);
  document.getElementById('htmlserialize').addEventListener('click', htmlSerializeButtonHandler);
  document.getElementById('custom-glyph').addEventListener('click', writeCustomGlyphHandler);
  document.getElementById('load-test').addEventListener('click', loadTest);
  document.getElementById('powerline-symbol-test').addEventListener('click', powerlineSymbolTest);
  document.getElementById('underline-test').addEventListener('click', underlineTest);
  document.getElementById('ansi-colors').addEventListener('click', ansiColorsTest);
  document.getElementById('osc-hyperlinks').addEventListener('click', addAnsiHyperlink);
  document.getElementById('add-decoration').addEventListener('click', addDecoration);
  document.getElementById('add-overview-ruler').addEventListener('click', addOverviewRuler);
}

function createTerminal(): void {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }

  const isWindows = ['Windows', 'Win16', 'Win32', 'WinCE'].indexOf(navigator.platform) >= 0;
  term = new Terminal({
    allowProposedApi: true,
    windowsMode: isWindows,
    fontFamily: 'Fira Code, courier-new, courier, monospace',
    theme: xtermjsTheme
  } as ITerminalOptions);

  // Load addons
  const typedTerm = term as TerminalType;
  addons.search.instance = new SearchAddon();
  addons.serialize.instance = new SerializeAddon();
  addons.fit.instance = new FitAddon();
  addons.unicode11.instance = new Unicode11Addon();
  addons.webgl.instance = new WebglAddon();
  // TODO: Remove arguments when link provider API is the default
  addons['web-links'].instance = new WebLinksAddon(undefined, undefined, true);
  typedTerm.loadAddon(addons.fit.instance);
  typedTerm.loadAddon(addons.search.instance);
  typedTerm.loadAddon(addons.serialize.instance);
  typedTerm.loadAddon(addons.unicode11.instance);
  typedTerm.loadAddon(addons['web-links'].instance);

  window.term = term;  // Expose `term` to window for debugging purposes
  term.onResize((size: { cols: number, rows: number }) => {
    if (!pid) {
      return;
    }
    const cols = size.cols;
    const rows = size.rows;
    const url = '/terminals/' + pid + '/size?cols=' + cols + '&rows=' + rows;

    fetch(url, { method: 'POST' });
  });
  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/terminals/';

  term.open(terminalContainer);
  addons.fit.instance!.fit();
  try {
    typedTerm.loadAddon(addons.webgl.instance);
    setTimeout(() => {
      addTextureAtlas(addons.webgl.instance.textureAtlas);
      addons.webgl.instance.onChangeTextureAtlas(e => addTextureAtlas(e));
    }, 0);
  }
  catch {
    addons.webgl.instance = undefined;
  }
  term.focus();

  addDomListener(paddingElement, 'change', setPadding);

  addDomListener(actionElements.findNext, 'keyup', (e) => {
    addons.search.instance.findNext(actionElements.findNext.value, getSearchOptions(e));
  });
  addDomListener(actionElements.findPrevious, 'keyup', (e) => {
    addons.search.instance.findPrevious(actionElements.findPrevious.value, getSearchOptions(e));
  });
  addDomListener(actionElements.findNext, 'blur', (e) => {
    addons.search.instance.clearActiveDecoration();
  });
  addDomListener(actionElements.findPrevious, 'blur', (e) => {
    addons.search.instance.clearActiveDecoration();
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

    fetch('/terminals?cols=' + term.cols + '&rows=' + term.rows, { method: 'POST' }).then((res) => {
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
  addons.attach.instance = new AttachAddon(socket);
  term.loadAddon(addons.attach.instance);
  term._initialized = true;
  initAddons(term);
}

function runFakeTerminal(): void {
  if (term._initialized) {
    return;
  }

  term._initialized = true;
  initAddons(term);

  term.prompt = () => {
    term.write('\r\n$ ');
  };

  term.writeln('Welcome to xterm.js');
  term.writeln('This is a local terminal emulation, without a real terminal in the back-end.');
  term.writeln('Type some keys and commands to play around.');
  term.writeln('');
  term.prompt();

  term.onKey((e: { key: string, domEvent: KeyboardEvent }) => {
    const ev = e.domEvent;
    const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

    if (ev.keyCode === 13) {
      term.prompt();
    } else if (ev.keyCode === 8) {
      // Do not delete the prompt
      if (term._core.buffer.x > 2) {
        term.write('\b \b');
      }
    } else if (printable) {
      term.write(e.key);
    }
  });
}

function initOptions(term: TerminalType): void {
  const blacklistedOptions = [
    // Internal only options
    'cancelEvents',
    'convertEol',
    'termName',
    // Complex option
    'theme',
    'windowOptions'
  ];
  const stringOptions = {
    cursorStyle: ['block', 'underline', 'bar'],
    fastScrollModifier: ['alt', 'ctrl', 'shift', undefined],
    fontFamily: null,
    fontWeight: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    fontWeightBold: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    logLevel: ['debug', 'info', 'warn', 'error', 'off'],
    theme: ['default', 'xtermjs', 'sapphire', 'light'],
    wordSeparator: null
  };
  const options = Object.getOwnPropertyNames(term.options);
  const booleanOptions = [];
  const numberOptions = [
    'overviewRulerWidth'
  ];
  options.filter(o => blacklistedOptions.indexOf(o) === -1).forEach(o => {
    switch (typeof term.options[o]) {
      case 'boolean':
        booleanOptions.push(o);
        break;
      case 'number':
        numberOptions.push(o);
        break;
      default:
        if (Object.keys(stringOptions).indexOf(o) === -1 && numberOptions.indexOf(o) === -1 && booleanOptions.indexOf(o) === -1) {
          console.warn(`Unrecognized option: "${o}"`);
        }
    }
  });

  let html = '';
  html += '<div class="option-group">';
  booleanOptions.forEach(o => {
    html += `<div class="option"><label><input id="opt-${o}" type="checkbox" ${term.options[o] ? 'checked' : ''}/> ${o}</label></div>`;
  });
  html += '</div><div class="option-group">';
  numberOptions.forEach(o => {
    html += `<div class="option"><label>${o} <input id="opt-${o}" type="number" value="${term.options[o] ?? ''}" step="${o === 'lineHeight' || o === 'scrollSensitivity' ? '0.1' : '1'}"/></label></div>`;
  });
  html += '</div><div class="option-group">';
  Object.keys(stringOptions).forEach(o => {
    if (stringOptions[o]) {
      const selectedOption = o === 'theme' ? 'xtermjs' : term.options[o];
      html += `<div class="option"><label>${o} <select id="opt-${o}">${stringOptions[o].map(v => `<option ${v === selectedOption ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>`;
    } else {
      html += `<div class="option"><label>${o} <input id="opt-${o}" type="text" value="${term.options[o]}"/></label></div>`;
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
      term.options[o] = input.checked;
    });
  });
  numberOptions.forEach(o => {
    const input = <HTMLInputElement>document.getElementById(`opt-${o}`);
    addDomListener(input, 'change', () => {
      console.log('change', o, input.value);
      if (o === 'lineHeight') {
        term.options.lineHeight = parseFloat(input.value);
      } else if (o === 'scrollSensitivity') {
        term.options.scrollSensitivity = parseFloat(input.value);
      } else if (o === 'scrollback') {
        term.options.scrollback = parseInt(input.value);
        setTimeout(() => updateTerminalSize(), 5);
      } else {
        term.options[o] = parseInt(input.value);
      }
      // Always update terminal size in case the option changes the dimensions
      updateTerminalSize();
    });
  });
  Object.keys(stringOptions).forEach(o => {
    const input = <HTMLInputElement>document.getElementById(`opt-${o}`);
    addDomListener(input, 'change', () => {
      console.log('change', o, input.value);
      let value: any = input.value;
      if (o === 'theme') {
        switch (input.value) {
          case 'default':
            value = undefined;
            break;
          case 'xtermjs':
            // Custom theme to match style of xterm.js logo
            value = xtermjsTheme;
          case 'sapphire':
            // Color source: https://github.com/Tyriar/vscode-theme-sapphire
            value = {
              background: '#1c2431',
              foreground: '#cccccc',
              selectionBackground: '#399ef440',
              black: '#666666',
              blue: '#399ef4',
              brightBlack: '#666666',
              brightBlue: '#399ef4',
              brightCyan: '#21c5c7',
              brightGreen: '#4eb071',
              brightMagenta: '#b168df',
              brightRed: '#da6771',
              brightWhite: '#efefef',
              brightYellow: '#fff099',
              cyan: '#21c5c7',
              green: '#4eb071',
              magenta: '#b168df',
              red: '#da6771',
              white: '#efefef',
              yellow: '#fff099',
            };
            break;
          case 'light':
            // Color source: https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/light_plus.json
            value = {
              background: '#ffffff',
              foreground: '#333333',
              selectionBackground: '#add6ff',
              black: '#000000',
              blue: '#0451a5',
              brightBlack: '#666666',
              brightBlue: '#0451a5',
              brightCyan: '#0598bc',
              brightGreen: '#14ce14',
              brightMagenta: '#bc05bc',
              brightRed: '#cd3131',
              brightWhite: '#a5a5a5',
              brightYellow: '#b5ba00',
              cyan: '#0598bc',
              green: '#00bc00',
              magenta: '#bc05bc',
              red: '#cd3131',
              white: '#555555',
              yellow: '#949800',
            };
            break;
        }
      }
      term.options[o] = value;
    });
  });
}

function initAddons(term: TerminalType): void {
  const fragment = document.createDocumentFragment();
  Object.keys(addons).forEach((name: AddonType) => {
    const addon = addons[name];
    const checkbox = document.createElement('input') as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.checked = !!addon.instance;
    if (!addon.canChange) {
      checkbox.disabled = true;
    }
    if (name === 'unicode11' && checkbox.checked) {
      term.unicode.activeVersion = '11';
    }
    if (name === 'search' && checkbox.checked) {
      addon.instance.onDidChangeResults(e => updateFindResults(e));
    }
    addDomListener(checkbox, 'change', () => {
      if (checkbox.checked) {
        addon.instance = new addon.ctor();
        try {
          term.loadAddon(addon.instance);
          if (name === 'webgl') {
            (addon.instance as WebglAddon).onChangeTextureAtlas(e => addTextureAtlas(e));
          } else if (name === 'unicode11') {
            term.unicode.activeVersion = '11';
          } else if (name === 'search') {
            addon.instance.onDidChangeResults(e => updateFindResults(e));
          }
        }
        catch {
          addon.instance = undefined;
          checkbox.checked = false;
          checkbox.disabled = true;
        }
      } else {
        if (name === 'webgl') {
          (addon.instance as WebglAddon).textureAtlas.remove();
        } else if (name === 'unicode11') {
          term.unicode.activeVersion = '6';
        }
        addon.instance!.dispose();
        addon.instance = undefined;
      }
    });
    const label = document.createElement('label');
    label.classList.add('addon');
    if (!addon.canChange) {
      label.title = 'This addon is needed for the demo to operate';
    }
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(name));
    const wrapper = document.createElement('div');
    wrapper.classList.add('addon');
    wrapper.appendChild(label);
    fragment.appendChild(wrapper);
  });
  const container = document.getElementById('addons-container');
  container.innerHTML = '';
  container.appendChild(fragment);
}

function updateFindResults(e: { resultIndex: number, resultCount: number } | undefined) {
  let content: string;
  if (e === undefined) {
    content = 'undefined';
  } else {
    content = `index: ${e.resultIndex}, count: ${e.resultCount}`;
  }
  actionElements.findResults.textContent = content;
}

function addDomListener(element: HTMLElement, type: string, handler: (...args: any[]) => any): void {
  element.addEventListener(type, handler);
  term._core.register({ dispose: () => element.removeEventListener(type, handler) });
}

function updateTerminalSize(): void {
  const cols = parseInt((<HTMLInputElement>document.getElementById(`opt-cols`)).value, 10);
  const rows = parseInt((<HTMLInputElement>document.getElementById(`opt-rows`)).value, 10);
  const width = (cols * term._core._renderService.dimensions.actualCellWidth + term._core.viewport.scrollBarWidth).toString() + 'px';
  const height = (rows * term._core._renderService.dimensions.actualCellHeight).toString() + 'px';
  terminalContainer.style.width = width;
  terminalContainer.style.height = height;
  addons.fit.instance.fit();
}

function serializeButtonHandler(): void {
  const output = addons.serialize.instance.serialize();
  const outputString = JSON.stringify(output);

  document.getElementById('serialize-output').innerText = outputString;
  if ((document.getElementById('write-to-terminal') as HTMLInputElement).checked) {
    term.reset();
    term.write(output);
  }
}

function htmlSerializeButtonHandler(): void {
  const output = addons.serialize.instance.serializeAsHTML();
  document.getElementById('htmlserialize-output').innerText = output;

  // Deprecated, but the most supported for now.
  function listener(e: any) {
    e.clipboardData.setData("text/html", output);
    e.preventDefault();
  }
  document.addEventListener("copy", listener);
  document.execCommand("copy");
  document.removeEventListener("copy", listener);
  document.getElementById("htmlserialize-output-result").innerText = "Copied to clipboard";
}

function addTextureAtlas(e: HTMLCanvasElement) {
  document.querySelector('#texture-atlas').appendChild(e);
}

function writeCustomGlyphHandler() {
  term.write('\n\r');
  term.write('\n\r');
  term.write('Box styles:       ┎┰┒┍┯┑╓╥╖╒╤╕ ┏┳┓┌┲┓┌┬┐┏┱┐\n\r');
  term.write('┌─┬─┐ ┏━┳━┓ ╔═╦═╗ ┠╂┨┝┿┥╟╫╢╞╪╡ ┡╇┩├╊┫┢╈┪┣╉┤\n\r');
  term.write('│ │ │ ┃ ┃ ┃ ║ ║ ║ ┖┸┚┕┷┙╙╨╜╘╧╛ └┴┘└┺┛┗┻┛┗┹┘\n\r');
  term.write('├─┼─┤ ┣━╋━┫ ╠═╬═╣ ┏┱┐┌┲┓┌┬┐┌┬┐ ┏┳┓┌┮┓┌┬┐┏┭┐\n\r');
  term.write('│ │ │ ┃ ┃ ┃ ║ ║ ║ ┡╃┤├╄┩├╆┪┢╅┤ ┞╀┦├┾┫┟╁┧┣┽┤\n\r');
  term.write('└─┴─┘ ┗━┻━┛ ╚═╩═╝ └┴┘└┴┘└┺┛┗┹┘ └┴┘└┶┛┗┻┛┗┵┘\n\r');
  term.write('\n\r');
  term.write('Other:\n\r');
  term.write('╭─╮ ╲ ╱ ╷╻╎╏┆┇┊┋ ╺╾╴ ╌╌╌ ┄┄┄ ┈┈┈\n\r');
  term.write('│ │  ╳  ╽╿╎╏┆┇┊┋ ╶╼╸ ╍╍╍ ┅┅┅ ┉┉┉\n\r');
  term.write('╰─╯ ╱ ╲ ╹╵╎╏┆┇┊┋\n\r');
  term.write('\n\r');
  term.write('All box drawing characters:\n\r');
  term.write('─ ━ │ ┃ ┄ ┅ ┆ ┇ ┈ ┉ ┊ ┋ ┌ ┍ ┎ ┏\n\r');
  term.write('┐ ┑ ┒ ┓ └ ┕ ┖ ┗ ┘ ┙ ┚ ┛ ├ ┝ ┞ ┟\n\r');
  term.write('┠ ┡ ┢ ┣ ┤ ┥ ┦ ┧ ┨ ┩ ┪ ┫ ┬ ┭ ┮ ┯\n\r');
  term.write('┰ ┱ ┲ ┳ ┴ ┵ ┶ ┷ ┸ ┹ ┺ ┻ ┼ ┽ ┾ ┿\n\r');
  term.write('╀ ╁ ╂ ╃ ╄ ╅ ╆ ╇ ╈ ╉ ╊ ╋ ╌ ╍ ╎ ╏\n\r');
  term.write('═ ║ ╒ ╓ ╔ ╕ ╖ ╗ ╘ ╙ ╚ ╛ ╜ ╝ ╞ ╟\n\r');
  term.write('╠ ╡ ╢ ╣ ╤ ╥ ╦ ╧ ╨ ╩ ╪ ╫ ╬ ╭ ╮ ╯\n\r');
  term.write('╰ ╱ ╲ ╳ ╴ ╵ ╶ ╷ ╸ ╹ ╺ ╻ ╼ ╽ ╾ ╿\n\r');
  term.write('Box drawing alignment tests:\x1b[31m                                          █\n\r');
  term.write('                                                                      ▉\n\r');
  term.write('  ╔══╦══╗  ┌──┬──┐  ╭──┬──╮  ╭──┬──╮  ┏━━┳━━┓  ┎┒┏┑   ╷  ╻ ┏┯┓ ┌┰┐    ▊ ╱╲╱╲╳╳╳\n\r');
  term.write('  ║┌─╨─┐║  │╔═╧═╗│  │╒═╪═╕│  │╓─╁─╖│  ┃┌─╂─┐┃  ┗╃╄┙  ╶┼╴╺╋╸┠┼┨ ┝╋┥    ▋ ╲╱╲╱╳╳╳\n\r');
  term.write('  ║│╲ ╱│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╿ │┃  ┍╅╆┓   ╵  ╹ ┗┷┛ └┸┘    ▌ ╱╲╱╲╳╳╳\n\r');
  term.write('  ╠╡ ╳ ╞╣  ├╢   ╟┤  ├┼─┼─┼┤  ├╫─╂─╫┤  ┣┿╾┼╼┿┫  ┕┛┖┚     ┌┄┄┐ ╎ ┏┅┅┓ ┋ ▍ ╲╱╲╱╳╳╳\n\r');
  term.write('  ║│╱ ╲│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╽ │┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▎\n\r');
  term.write('  ║└─╥─┘║  │╚═╤═╝│  │╘═╪═╛│  │╙─╀─╜│  ┃└─╂─┘┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▏\n\r');
  term.write('  ╚══╩══╝  └──┴──┘  ╰──┴──╯  ╰──┴──╯  ┗━━┻━━┛           └╌╌┘ ╎ ┗╍╍┛ ┋  ▁▂▃▄▅▆▇█\n\r');
  term.write('Box drawing alignment tests:\x1b[32m                                          █\n\r');
  term.write('                                                                      ▉\n\r');
  term.write('  ╔══╦══╗  ┌──┬──┐  ╭──┬──╮  ╭──┬──╮  ┏━━┳━━┓  ┎┒┏┑   ╷  ╻ ┏┯┓ ┌┰┐    ▊ ╱╲╱╲╳╳╳\n\r');
  term.write('  ║┌─╨─┐║  │╔═╧═╗│  │╒═╪═╕│  │╓─╁─╖│  ┃┌─╂─┐┃  ┗╃╄┙  ╶┼╴╺╋╸┠┼┨ ┝╋┥    ▋ ╲╱╲╱╳╳╳\n\r');
  term.write('  ║│╲ ╱│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╿ │┃  ┍╅╆┓   ╵  ╹ ┗┷┛ └┸┘    ▌ ╱╲╱╲╳╳╳\n\r');
  term.write('  ╠╡ ╳ ╞╣  ├╢   ╟┤  ├┼─┼─┼┤  ├╫─╂─╫┤  ┣┿╾┼╼┿┫  ┕┛┖┚     ┌┄┄┐ ╎ ┏┅┅┓ ┋ ▍ ╲╱╲╱╳╳╳\n\r');
  term.write('  ║│╱ ╲│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╽ │┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▎\n\r');
  term.write('  ║└─╥─┘║  │╚═╤═╝│  │╘═╪═╛│  │╙─╀─╜│  ┃└─╂─┘┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▏\n\r');
  term.write('  ╚══╩══╝  └──┴──┘  ╰──┴──╯  ╰──┴──╯  ┗━━┻━━┛           └╌╌┘ ╎ ┗╍╍┛ ┋  ▁▂▃▄▅▆▇█\n\r');
  window.scrollTo(0, 0);
}

function loadTest() {
  const rendererName = addons.webgl.instance ? 'webgl' : !!addons.canvas.instance ? 'canvas' : 'dom';
  const testData = [];
  let byteCount = 0;
  for (let i = 0; i < 50; i++) {
    const count = 1 + Math.floor(Math.random() * 79);
    byteCount += count + 2;
    const data = new Uint8Array(count + 2);
    data[0] = 0x0A; // \n
    for (let i = 1; i < count + 1; i++) {
      data[i] = 0x61 + Math.floor(Math.random() * (0x7A - 0x61));
    }
    // End each line with \r so the cursor remains constant, this is what ls/tree do and improves
    // performance significantly due to the cursor DOM element not needing to change
    data[data.length - 1] = 0x0D; // \r
    testData.push(data);
  }
  const start = performance.now();
  for (let i = 0; i < 1024; i++) {
    for (const d of testData) {
      term.write(d);
    }
  }
  // Wait for all data to be parsed before evaluating time
  term.write('', () => {
    const time = Math.round(performance.now() - start);
    const mbs = ((byteCount / 1024) * (1 / (time / 1000))).toFixed(2);
    term.write(`\n\r\nWrote ${byteCount}kB in ${time}ms (${mbs}MB/s) using the (${rendererName} renderer)`);
    // Send ^C to get a new prompt
    term._core._onData.fire('\x03');
  });
}

function powerlineSymbolTest() {
  function s(char: string): string {
    return `${char} \x1b[7m${char}\x1b[0m  `;
  }
  term.write('\n\n\r');
  term.writeln('Standard powerline symbols:');
  term.writeln('      0    1    2    3    4    5    6    7    8    9    A    B    C    D    E    F');
  term.writeln(`0xA_  ${s('\ue0a0')}${s('\ue0a1')}${s('\ue0a2')}`);
  term.writeln(`0xB_  ${s('\ue0b0')}${s('\ue0b1')}${s('\ue0b2')}${s('\ue0b3')}`);
  term.writeln('');
  term.writeln(
    `\x1b[7m` +
    ` inverse \ue0b1 \x1b[0;40m\ue0b0` +
    ` 0 \ue0b1 \x1b[30;41m\ue0b0\x1b[39m` +
    ` 1 \ue0b1 \x1b[31;42m\ue0b0\x1b[39m` +
    ` 2 \ue0b1 \x1b[32;43m\ue0b0\x1b[39m` +
    ` 3 \ue0b1 \x1b[33;44m\ue0b0\x1b[39m` +
    ` 4 \ue0b1 \x1b[34;45m\ue0b0\x1b[39m` +
    ` 5 \ue0b1 \x1b[35;46m\ue0b0\x1b[39m` +
    ` 6 \ue0b1 \x1b[36;47m\ue0b0\x1b[30m` +
    ` 7 \ue0b1 \x1b[37;49m\ue0b0\x1b[0m`
  );
  term.writeln('');
  term.writeln(
    `\x1b[7m` +
    ` inverse \ue0b3 \x1b[0;7;40m\ue0b2\x1b[27m` +
    ` 0 \ue0b3 \x1b[7;30;41m\ue0b2\x1b[27;39m` +
    ` 1 \ue0b3 \x1b[7;31;42m\ue0b2\x1b[27;39m` +
    ` 2 \ue0b3 \x1b[7;32;43m\ue0b2\x1b[27;39m` +
    ` 3 \ue0b3 \x1b[7;33;44m\ue0b2\x1b[27;39m` +
    ` 4 \ue0b3 \x1b[7;34;45m\ue0b2\x1b[27;39m` +
    ` 5 \ue0b3 \x1b[7;35;46m\ue0b2\x1b[27;39m` +
    ` 6 \ue0b3 \x1b[7;36;47m\ue0b2\x1b[27;30m` +
    ` 7 \ue0b3 \x1b[7;37;49m\ue0b2\x1b[0m`
  );
  term.writeln('');
  term.writeln(
    `\x1b[7m` +
    ` inverse \ue0b5 \x1b[0;40m\ue0b4` +
    ` 0 \ue0b5 \x1b[30;41m\ue0b4\x1b[39m` +
    ` 1 \ue0b5 \x1b[31;42m\ue0b4\x1b[39m` +
    ` 2 \ue0b5 \x1b[32;43m\ue0b4\x1b[39m` +
    ` 3 \ue0b5 \x1b[33;44m\ue0b4\x1b[39m` +
    ` 4 \ue0b5 \x1b[34;45m\ue0b4\x1b[39m` +
    ` 5 \ue0b5 \x1b[35;46m\ue0b4\x1b[39m` +
    ` 6 \ue0b5 \x1b[36;47m\ue0b4\x1b[30m` +
    ` 7 \ue0b5 \x1b[37;49m\ue0b4\x1b[0m`
  );
  term.writeln('');
  term.writeln(
    `\x1b[7m` +
    ` inverse \ue0b7 \x1b[0;7;40m\ue0b6\x1b[27m` +
    ` 0 \ue0b7 \x1b[7;30;41m\ue0b6\x1b[27;39m` +
    ` 1 \ue0b7 \x1b[7;31;42m\ue0b6\x1b[27;39m` +
    ` 2 \ue0b7 \x1b[7;32;43m\ue0b6\x1b[27;39m` +
    ` 3 \ue0b7 \x1b[7;33;44m\ue0b6\x1b[27;39m` +
    ` 4 \ue0b7 \x1b[7;34;45m\ue0b6\x1b[27;39m` +
    ` 5 \ue0b7 \x1b[7;35;46m\ue0b6\x1b[27;39m` +
    ` 6 \ue0b7 \x1b[7;36;47m\ue0b6\x1b[27;30m` +
    ` 7 \ue0b7 \x1b[7;37;49m\ue0b6\x1b[0m`
  );
  term.writeln('');
  term.writeln('Powerline extra symbols:');
  term.writeln('      0    1    2    3    4    5    6    7    8    9    A    B    C    D    E    F');
  term.writeln(`0xA_                 ${s('\ue0a3')}`);
  term.writeln(`0xB_                      ${s('\ue0b4')}${s('\ue0b5')}${s('\ue0b6')}${s('\ue0b7')}${s('\ue0b8')}${s('\ue0b9')}${s('\ue0ba')}${s('\ue0bb')}${s('\ue0bc')}${s('\ue0bd')}${s('\ue0be')}${s('\ue0bf')}`);
  term.writeln(`0xC_  ${s('\ue0c0')}${s('\ue0c1')}${s('\ue0c2')}${s('\ue0c3')}${s('\ue0c4')}${s('\ue0c5')}${s('\ue0c6')}${s('\ue0c7')}${s('\ue0c8')}${s('\ue0c9')}${s('\ue0ca')}${s('\ue0cb')}${s('\ue0cc')}${s('\ue0cd')}${s('\ue0be')}${s('\ue0bf')}`);
  term.writeln(`0xD_  ${s('\ue0d0')}${s('\ue0d1')}${s('\ue0d2')}     ${s('\ue0d4')}`);
  term.writeln('');
  term.writeln('Sample of nerd fonts icons:');
  term.writeln('    nf-linux-apple (\\uF302) \uf302');
  term.writeln('nf-mdi-github_face (\\uFbd9) \ufbd9');
}

function underlineTest() {
  function u(style: number): string {
    return `\x1b[4:${style}m`;
  }
  function c(color: string): string {
    return `\x1b[58:${color}m`;
  }
  term.write('\n\n\r');
  term.writeln('Underline styles:');
  term.writeln('');
  term.writeln(`${u(0)}4:0m - No underline`);
  term.writeln(`${u(1)}4:1m - Straight`);
  term.writeln(`${u(2)}4:2m - Double`);
  term.writeln(`${u(3)}4:3m - Curly`);
  term.writeln(`${u(4)}4:4m - Dotted`);
  term.writeln(`${u(5)}4:5m - Dashed\x1b[0m`);
  term.writeln('');
  term.writeln(`Underline colors (256 color mode):`);
  term.writeln('');
  for (let i = 0; i < 256; i++) {
    term.write((i !== 0 ? '\x1b[0m, ' : '') + u(1 + i % 5) + c('5:' + i) + i);
  }
  term.writeln(`\x1b[0m\n\n\rUnderline colors (true color mode):`);
  term.writeln('');
  for (let i = 0; i < 80; i++) {
    const v = Math.round(i / 79 * 255);
    term.write(u(1) + c(`2:0:${v}:${v}:${v}`) + (i < 4 ? 'grey'[i] : ' '));
  }
  term.write('\n\r');
  for (let i = 0; i < 80; i++) {
    const v = Math.round(i / 79 * 255);
    term.write(u(1) + c(`2:0:${v}:${0}:${0}`) + (i < 3 ? 'red'[i] : ' '));
  }
  term.write('\n\r');
  for (let i = 0; i < 80; i++) {
    const v = Math.round(i / 79 * 255);
    term.write(u(1) + c(`2:0:${0}:${v}:${0}`) + (i < 5 ? 'green'[i] : ' '));
  }
  term.write('\n\r');
  for (let i = 0; i < 80; i++) {
    const v = Math.round(i / 79 * 255);
    term.write(u(1) + c(`2:0:${0}:${0}:${v}`) + (i < 4 ? 'blue'[i] : ' '));
  }
  term.write('\x1b[0m\n\r');
}

function ansiColorsTest() {
  term.writeln(`\x1b[0m\n\n\rStandard colors:                        Bright colors:`);
  for (let i = 0; i < 16; i++) {
    term.write(`\x1b[48;5;${i}m ${i.toString().padEnd(2, ' ').padStart(3, ' ')} \x1b[0m`);
  }

  term.writeln(`\x1b[0m\n\n\rColors 17-231 from 256 palette:`);
  for (let i = 0; i < 6; i++) {
    const startId = 16 + i * 36;
    const endId = 16 + (i + 1) * 36 - 1;
    term.write(`${startId.toString().padStart(3, ' ')}-${endId.toString().padStart(3, ' ')} `);
    for (let j = 0; j < 36; j++) {
      const id = 16 + i * 36 + j;
      term.write(`\x1b[48;5;${id}m${(id % 10).toString().padStart(2, ' ')}\x1b[0m`);
    }
    term.write(`\r\n`);
  }

  term.writeln(`\x1b[0m\n\rGreyscale from 256 palette:`);
  term.write('232-255 ');
  for (let i = 232; i < 256; i++) {
    term.write(`\x1b[48;5;${i}m ${(i % 10)} \x1b[0m`);
  }
}

function addAnsiHyperlink() {
  term.write('\n\n\r');
  term.writeln(`Regular link with no id:`);
  term.writeln('\x1b]8;;https://github.com\x07GitHub\x1b]8;;\x07');
  term.writeln('\x1b]8;;https://xtermjs.org\x07https://xtermjs.org\x1b]8;;\x07\x1b[C<- null cell');
  term.writeln(`\nAdjacent links:`);
  term.writeln('\x1b]8;;https://github.com\x07GitHub\x1b]8;;https://xtermjs.org\x07\x1b[32mxterm.js\x1b[0m\x1b]8;;\x07');
  term.writeln(`\nShared ID link (underline should be shared):`);
  term.writeln('╔════╗');
  term.writeln('║\x1b]8;id=testid;https://github.com\x07GitH\x1b]8;;\x07║');
  term.writeln('║\x1b]8;id=testid;https://github.com\x07ub\x1b]8;;\x07  ║');
  term.writeln('╚════╝');
  term.writeln(`\nWrapped link with no ID (not necessarily meant to share underline):`);
  term.writeln('╔════╗');
  term.writeln('║    ║');
  term.writeln('║    ║');
  term.writeln('╚════╝');
  term.write('\x1b[3A\x1b[1C\x1b]8;;https://xtermjs.org\x07xter\x1b[B\x1b[4Dm.js\x1b]8;;\x07\x1b[2B\x1b[5D');
}

function addDecoration() {
  term.options['overviewRulerWidth'] = 15;
  const marker = term.registerMarker(1);
  const decoration = term.registerDecoration({
    marker,
    backgroundColor: '#00FF00',
    foregroundColor: '#00FE00',
    overviewRulerOptions: { color: '#ef292980', position: 'left' }
  });
  decoration.onRender((e: HTMLElement) => {
    e.style.right = '100%';
    e.style.backgroundColor = '#ef292980';
  });
}

function addOverviewRuler() {
  term.options['overviewRulerWidth'] = 15;
  term.registerDecoration({ marker: term.registerMarker(1), overviewRulerOptions: { color: '#ef2929' } });
  term.registerDecoration({ marker: term.registerMarker(3), overviewRulerOptions: { color: '#8ae234' } });
  term.registerDecoration({ marker: term.registerMarker(5), overviewRulerOptions: { color: '#729fcf' } });
  term.registerDecoration({ marker: term.registerMarker(7), overviewRulerOptions: { color: '#ef2929', position: 'left' } });
  term.registerDecoration({ marker: term.registerMarker(7), overviewRulerOptions: { color: '#8ae234', position: 'center' } });
  term.registerDecoration({ marker: term.registerMarker(7), overviewRulerOptions: { color: '#729fcf', position: 'right' } });
  term.registerDecoration({ marker: term.registerMarker(10), overviewRulerOptions: { color: '#8ae234', position: 'center' } });
  term.registerDecoration({ marker: term.registerMarker(10), overviewRulerOptions: { color: '#ffffff80', position: 'full' } });
}

