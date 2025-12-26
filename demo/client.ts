/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This file is the entry point for browserify.
 */

/// <reference path="../typings/xterm.d.ts"/>

/* eslint-disable no-restricted-syntax */

// HACK: Playwright/WebKit on Windows does not support WebAssembly https://stackoverflow.com/q/62311688/1156119
import type { ImageAddon as ImageAddonType, IImageAddonOptions } from '@xterm/addon-image';
let ImageAddon: typeof ImageAddonType | undefined; // eslint-disable-line @typescript-eslint/naming-convention
if ('WebAssembly' in window) {
  const imageAddon = require('@xterm/addon-image');
  ImageAddon = imageAddon.ImageAddon;
}

import { Terminal, ITerminalOptions, type IDisposable, type ITheme } from '@xterm/xterm';
import { AttachAddon } from '@xterm/addon-attach';
import { AddonsWindow } from './components/window/addonsWindow';
import { ControlBar } from './components/controlBar';
import { GpuWindow } from './components/window/gpuWindow';
import { OptionsWindow } from './components/window/optionsWindow';
import { StyleWindow } from './components/window/styleWindow';
import { TestWindow } from './components/window/testWindow';
import { VtWindow } from './components/window/vtWindow';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { LigaturesAddon } from '@xterm/addon-ligatures';
import { ProgressAddon, IProgressState } from '@xterm/addon-progress';
import { SearchAddon, ISearchOptions } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { UnicodeGraphemesAddon } from '@xterm/addon-unicode-graphemes';

import { AddonCollection, type AddonType, type IDemoAddon } from './types';

export interface IWindowWithTerminal extends Window {
  term: typeof Terminal;
  Terminal: typeof Terminal;
  AttachAddon?: typeof AttachAddon; // eslint-disable-line @typescript-eslint/naming-convention
  ClipboardAddon?: typeof ClipboardAddon; // eslint-disable-line @typescript-eslint/naming-convention
  FitAddon?: typeof FitAddon; // eslint-disable-line @typescript-eslint/naming-convention
  ImageAddon?: typeof ImageAddon; // eslint-disable-line @typescript-eslint/naming-convention
  ProgressAddon?: typeof ProgressAddon; // eslint-disable-line @typescript-eslint/naming-convention
  SearchAddon?: typeof SearchAddon; // eslint-disable-line @typescript-eslint/naming-convention
  SerializeAddon?: typeof SerializeAddon; // eslint-disable-line @typescript-eslint/naming-convention
  WebLinksAddon?: typeof WebLinksAddon; // eslint-disable-line @typescript-eslint/naming-convention
  WebglAddon?: typeof WebglAddon; // eslint-disable-line @typescript-eslint/naming-convention
  Unicode11Addon?: typeof Unicode11Addon; // eslint-disable-line @typescript-eslint/naming-convention
  UnicodeGraphemesAddon?: typeof UnicodeGraphemesAddon; // eslint-disable-line @typescript-eslint/naming-convention
  LigaturesAddon?: typeof LigaturesAddon; // eslint-disable-line @typescript-eslint/naming-convention
}
declare let window: IWindowWithTerminal;

let term;
let protocol;
let socketURL;
let socket;
let pid;
let controlBar: ControlBar;
let addonsWindow: AddonsWindow;
let gpuWindow: GpuWindow;
let optionsWindow: OptionsWindow;
let styleWindow: StyleWindow;
let vtWindow: VtWindow;

const addons: AddonCollection = {
  attach: { name: 'attach', ctor: AttachAddon, canChange: false },
  clipboard: { name: 'clipboard', ctor: ClipboardAddon, canChange: true },
  fit: { name: 'fit', ctor: FitAddon, canChange: false },
  image: { name: 'image', ctor: ImageAddon, canChange: true },
  progress: { name: 'progress', ctor: ProgressAddon, canChange: true },
  search: { name: 'search', ctor: SearchAddon, canChange: true },
  serialize: { name: 'serialize', ctor: SerializeAddon, canChange: true },
  webLinks: { name: 'webLinks', ctor: WebLinksAddon, canChange: true },
  webgl: { name: 'webgl', ctor: WebglAddon, canChange: true },
  unicode11: { name: 'unicode11', ctor: Unicode11Addon, canChange: true },
  unicodeGraphemes: { name: 'unicodeGraphemes', ctor: UnicodeGraphemesAddon, canChange: true },
  ligatures: { name: 'ligatures', ctor: LigaturesAddon, canChange: true }
};

let terminalContainer = document.getElementById('terminal-container');
let actionElements: {
  findNext: HTMLInputElement;
  findPrevious: HTMLInputElement;
  findResults: HTMLElement;
};
let paddingElement: HTMLInputElement;

const xtermjsTheme = {
  foreground: '#F8F8F8',
  background: '#2D2E2C',
  selectionBackground: '#5DA5D533',
  selectionInactiveBackground: '#555555AA',
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
} satisfies ITheme;
function setPadding(): void {
  term.element.style.padding = parseInt(paddingElement.value, 10).toString() + 'px';
  addons.fit.instance.fit();
}

function getSearchOptions(): ISearchOptions {
  return {
    regex: (document.getElementById('regex') as HTMLInputElement).checked,
    wholeWord: (document.getElementById('whole-word') as HTMLInputElement).checked,
    caseSensitive: (document.getElementById('case-sensitive') as HTMLInputElement).checked,
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

const disposeRecreateButtonHandler: () => void = () => {
  // If the terminal exists dispose of it, otherwise recreate it
  if (term) {
    term.dispose();
    term = null;
    window.term = null;
    socket = null;
    addons.attach.instance = undefined;
    addons.clipboard.instance = undefined;
    addons.fit.instance = undefined;
    addons.image.instance = undefined;
    addons.search.instance = undefined;
    addons.serialize.instance = undefined;
    addons.unicode11.instance = undefined;
    addons.unicodeGraphemes.instance = undefined;
    addons.ligatures.instance = undefined;
    addons.webLinks.instance = undefined;
    addons.webgl.instance = undefined;
    document.getElementById('dispose').innerHTML = 'Recreate Terminal';
  } else {
    createTerminal();
    document.getElementById('dispose').innerHTML = 'Dispose terminal';
  }
};

const createNewWindowButtonHandler: () => void = () => {
  if (term) {
    disposeRecreateButtonHandler();
  }
  const win = window.open();
  terminalContainer = win.document.createElement('div');
  terminalContainer.id = 'terminal-container';
  win.document.body.appendChild(terminalContainer);

  // Stylesheets are needed to get the terminal in the popout window to render
  // correctly. We also need to wait for them to load before creating the
  // terminal, otherwise we will not compute the correct metrics when rendering.
  let pendingStylesheets = 0;
  for (const linkNode of document.querySelectorAll('head link[rel=stylesheet]')) {
    const newLink = document.createElement('link');
    newLink.rel = 'stylesheet';
    newLink.href = (linkNode as HTMLLinkElement).href;
    win.document.head.appendChild(newLink);

    pendingStylesheets++;
    newLink.addEventListener('load', () => {
      pendingStylesheets--;
      if (pendingStylesheets === 0) {
        createTerminal();
      }
    });
  }
};

if (document.location.pathname === '/test') {
  window.Terminal = Terminal;
  window.AttachAddon = AttachAddon;
  window.ClipboardAddon = ClipboardAddon;
  window.FitAddon = FitAddon;
  window.ImageAddon = ImageAddon;
  window.ProgressAddon = ProgressAddon;
  window.SearchAddon = SearchAddon;
  window.SerializeAddon = SerializeAddon;
  window.Unicode11Addon = Unicode11Addon;
  window.UnicodeGraphemesAddon = UnicodeGraphemesAddon;
  window.LigaturesAddon = LigaturesAddon;
  window.WebLinksAddon = WebLinksAddon;
  window.WebglAddon = WebglAddon;
} else {
  const typedTerm = createTerminal();
  
  controlBar = new ControlBar(document.getElementById('sidebar'), document.querySelector('.banner-tabs'), []);
  addonsWindow = new AddonsWindow();
  controlBar.registerWindow(addonsWindow);
  actionElements = {
    findNext: addonsWindow.findNextInput,
    findPrevious: addonsWindow.findPreviousInput,
    findResults: addonsWindow.findResultsSpan
  };
  gpuWindow = new GpuWindow();
  controlBar.registerWindow(gpuWindow, { afterId: 'addons', hidden: true, smallTab: true });
  optionsWindow = new OptionsWindow(updateTerminalSize, updateTerminalContainerBackground);
  const styleWindow = controlBar.registerWindow(new StyleWindow());
  paddingElement = styleWindow.paddingElement;
  controlBar.registerWindow(optionsWindow);
  controlBar.registerWindow(new TestWindow(typedTerm, addons));
  vtWindow = new VtWindow();
  controlBar.registerWindow(vtWindow);
  vtWindow.initTerminal(term);
  controlBar.activateDefaultTab();
  
  // TODO: Most of below should be encapsulated within windows
  controlBar.setTabVisible('gpu', true);
  gpuWindow.setTextureAtlas(addons.webgl.instance.textureAtlas);
  addons.webgl.instance.onChangeTextureAtlas(e => gpuWindow.setTextureAtlas(e));
  addons.webgl.instance.onAddTextureAtlasCanvas(e => gpuWindow.appendTextureAtlas(e));
  addons.webgl.instance.onRemoveTextureAtlasCanvas(e => gpuWindow.removeTextureAtlas(e));
  
  paddingElement.value = '0';
  addDomListener(paddingElement, 'change', setPadding);
  addDomListener(actionElements.findNext, 'keydown', (e) => {
    if (e.key === 'Enter') {
      addons.search.instance.findNext(actionElements.findNext.value, getSearchOptions());
      e.preventDefault();
    }
  });
  addDomListener(actionElements.findNext, 'input', (e) => {
    addons.search.instance.findNext(actionElements.findNext.value, getSearchOptions());
  });
  addDomListener(actionElements.findPrevious, 'keydown', (e) => {
    if (e.key === 'Enter') {
      addons.search.instance.findPrevious(actionElements.findPrevious.value, getSearchOptions());
      e.preventDefault();
    }
  });
  addDomListener(actionElements.findPrevious, 'input', (e) => {
    addons.search.instance.findPrevious(actionElements.findPrevious.value, getSearchOptions());
  });
  addDomListener(actionElements.findNext, 'blur', (e) => {
    addons.search.instance.clearActiveDecoration();
  });
  addDomListener(actionElements.findPrevious, 'blur', (e) => {
    addons.search.instance.clearActiveDecoration();
  });

  document.getElementById('dispose').addEventListener('click', disposeRecreateButtonHandler);
  document.getElementById('create-new-window').addEventListener('click', createNewWindowButtonHandler);
  document.getElementById('serialize').addEventListener('click', serializeButtonHandler);
  document.getElementById('htmlserialize').addEventListener('click', htmlSerializeButtonHandler);
  document.getElementById('load-test').addEventListener('click', loadTest);
  document.getElementById('load-test-long-lines').addEventListener('click', loadTestLongLines);
  document.getElementById('add-decoration').addEventListener('click', addDecoration);
  document.getElementById('add-overview-ruler').addEventListener('click', addOverviewRuler);
  document.getElementById('decoration-stress-test').addEventListener('click', decorationStressTest);
  document.getElementById('ligatures-test').addEventListener('click', ligaturesTest);
  document.getElementById('weblinks-test').addEventListener('click', testWeblinks);
  initImageAddonExposed();
  testEvents();
  progressButtons();
}

function createTerminal(): Terminal {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }

  const isWindows = ['Windows', 'Win16', 'Win32', 'WinCE'].indexOf(navigator.platform) >= 0;
  term = new Terminal({
    allowProposedApi: true,
    windowsPty: isWindows ? {
      // In a real scenario, these values should be verified on the backend
      backend: 'conpty',
      buildNumber: 22621
    } : undefined,
    fontFamily: '"Fira Code", monospace, "Powerline Extra Symbols"',
    theme: xtermjsTheme
  } as ITerminalOptions);

  // Load addons
  const typedTerm = term as Terminal;
  addons.search.instance = new SearchAddon();
  addons.serialize.instance = new SerializeAddon();
  addons.fit.instance = new FitAddon();
  addons.image.instance = new ImageAddon();
  addons.progress.instance = new ProgressAddon();
  addons.unicodeGraphemes.instance = new UnicodeGraphemesAddon();
  addons.clipboard.instance = new ClipboardAddon();
  try {  // try to start with webgl renderer (might throw on older safari/webkit)
    addons.webgl.instance = new WebglAddon();
  } catch (e) {
    console.warn(e);
  }
  addons.webLinks.instance = new WebLinksAddon();
  typedTerm.loadAddon(addons.fit.instance);
  typedTerm.loadAddon(addons.image.instance);
  typedTerm.loadAddon(addons.progress.instance);
  typedTerm.loadAddon(addons.search.instance);
  typedTerm.loadAddon(addons.serialize.instance);
  typedTerm.loadAddon(addons.unicodeGraphemes.instance);
  typedTerm.loadAddon(addons.webLinks.instance);
  typedTerm.loadAddon(addons.clipboard.instance);

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

  addons.fit.instance!.fit();

  if (addons.webgl.instance) {
    try {
      typedTerm.loadAddon(addons.webgl.instance);
      term.open(terminalContainer);
    } catch (e) {
      console.warn('error during loading webgl addon:', e);
      addons.webgl.instance.dispose();
      addons.webgl.instance = undefined;
    }
  }
  if (!typedTerm.element) {
    // webgl loading failed for some reason, attach with DOM renderer
    term.open(terminalContainer);
  }

  term.focus();
  updateTerminalContainerBackground();

  const resizeObserver = new ResizeObserver(entries => {
    if (optionsWindow.autoResize) {
      addons.fit.instance.fit();
    }
  });
  resizeObserver.observe(terminalContainer);

  // fit is called within a setTimeout, cols and rows need this.
  setTimeout(async () => {
    optionsWindow.initOptions(term, addDomListener);

    // Set terminal size again to set the specific dimensions on the demo
    updateTerminalSize();

    const useRealTerminal = document.getElementById('use-real-terminal');
    if (useRealTerminal instanceof HTMLInputElement && !useRealTerminal.checked) {
      runFakeTerminal();
    } else {
      const res = await fetch('/terminals?cols=' + term.cols + '&rows=' + term.rows, { method: 'POST' });
      const processId = await res.text();
      pid = processId;
      socketURL += processId;
      socket = new WebSocket(socketURL);
      socket.onopen = runRealTerminal;
      socket.onclose = runFakeTerminal;
      socket.onerror = runFakeTerminal;
    }
  }, 0);

  return typedTerm;
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

function updateTerminalContainerBackground(): void {
  const bg = term.options.theme?.background ?? '#000000';
  terminalContainer.style.backgroundColor = bg;
}

function initAddons(term: Terminal): void {
  const fragment = document.createDocumentFragment();

  function postInitWebgl(): void {
    controlBar.setTabVisible('gpu', true);
    setTimeout(() => {
      gpuWindow.setTextureAtlas(addons.webgl.instance.textureAtlas);
      addons.webgl.instance.onChangeTextureAtlas(e => gpuWindow.setTextureAtlas(e));
      addons.webgl.instance.onAddTextureAtlasCanvas(e => gpuWindow.appendTextureAtlas(e));
    }, 500);
  }
  function preDisposeWebgl(): void {
    controlBar.setTabVisible('gpu', false);
    if (addons.webgl.instance.textureAtlas) {
      addons.webgl.instance.textureAtlas.remove();
    }
  }

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
    if (name === 'unicodeGraphemes' && checkbox.checked) {
      term.unicode.activeVersion = '15-graphemes';
    }
    if (name === 'search' && checkbox.checked) {
      addons[name].instance.onDidChangeResults(e => updateFindResults(e));
    }
    addDomListener(checkbox, 'change', () => {
      if (name === 'image') {
        if (checkbox.checked) {
          const ctorOptionsJson = document.querySelector<HTMLTextAreaElement>('#image-options').value;
          addon.instance = ctorOptionsJson
            ? new addons[name].ctor(JSON.parse(ctorOptionsJson))
            : new addons[name].ctor();
          term.loadAddon(addon.instance);
        } else {
          addon.instance!.dispose();
          addon.instance = undefined;
        }
        return;
      }
      if (checkbox.checked) {
        // HACK: Manually remove addons that cannot be changes
        addon.instance = new (addon as IDemoAddon<Exclude<AddonType, 'attach'>>).ctor();
        try {
          term.loadAddon(addon.instance);
          if (name === 'webgl') {
            postInitWebgl();
          } else if (name === 'unicode11') {
            term.unicode.activeVersion = '11';
          } else if (name === 'unicodeGraphemes') {
            term.unicode.activeVersion = '15-graphemes';
          } else if (name === 'search') {
            addons[name].instance.onDidChangeResults(e => updateFindResults(e));
          }
        }
        catch {
          addon.instance = undefined;
          checkbox.checked = false;
          checkbox.disabled = true;
        }
      } else {
        if (name === 'webgl') {
          preDisposeWebgl();
        } else if (name === 'unicode11' || name === 'unicodeGraphemes') {
          term.unicode.activeVersion = '6';
        }
        addon.instance!.dispose();
        addon.instance = undefined;
      }
      if (name === 'ligatures') {
        // Recreate webgl when ligatures are toggled so texture atlas picks up any font feature
        // settings changes
        if (addons.webgl.instance) {
          preDisposeWebgl();
          addons.webgl.instance.dispose();
          const customGlyphsCheckbox = document.getElementById('webgl-custom-glyphs') as HTMLInputElement;
          addons.webgl.instance = new addons.webgl.ctor({ customGlyphs: customGlyphsCheckbox?.checked ?? true });
          term.loadAddon(addons.webgl.instance);
          postInitWebgl();
        }
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

    // Add customGlyphs sub-checkbox for webgl addon
    if (name === 'webgl') {
      const customGlyphsCheckbox = document.createElement('input') as HTMLInputElement;
      customGlyphsCheckbox.type = 'checkbox';
      customGlyphsCheckbox.checked = true; // Default to enabled
      customGlyphsCheckbox.id = 'webgl-custom-glyphs';
      addDomListener(customGlyphsCheckbox, 'change', () => {
        if (addons.webgl.instance) {
          preDisposeWebgl();
          addons.webgl.instance.dispose();
          addons.webgl.instance = new addons.webgl.ctor({ customGlyphs: customGlyphsCheckbox.checked });
          term.loadAddon(addons.webgl.instance);
          postInitWebgl();
        }
      });
      const customGlyphsLabel = document.createElement('label');
      customGlyphsLabel.classList.add('addon');
      customGlyphsLabel.style.display = 'block';
      customGlyphsLabel.style.marginLeft = '20px';
      customGlyphsLabel.appendChild(customGlyphsCheckbox);
      customGlyphsLabel.appendChild(document.createTextNode('customGlyphs'));
      wrapper.appendChild(customGlyphsLabel);
    }

    fragment.appendChild(wrapper);
  });
  const container = addonsWindow.addonsContainer;
  container.innerHTML = '';
  container.appendChild(fragment);
}

function updateFindResults(e: { resultIndex: number, resultCount: number } | undefined): void {
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
  term._core._register({ dispose: () => element.removeEventListener(type, handler) });
}

function updateTerminalSize(): void {
  const width = optionsWindow.autoResize ? '100%'
    : (term._core._renderService.dimensions.css.canvas.width + term._core.viewport.scrollBarWidth).toString() + 'px';
  const height = optionsWindow.autoResize ? '100%'
    : (term._core._renderService.dimensions.css.canvas.height).toString() + 'px';
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
  function listener(e: any): void {
    e.clipboardData.setData('text/html', output);
    e.preventDefault();
  }
  document.addEventListener('copy', listener);
  document.execCommand('copy');
  document.removeEventListener('copy', listener);
  document.getElementById('htmlserialize-output-result').innerText = 'Copied to clipboard';
}

function loadTest(): void {
  const rendererName = addons.webgl.instance ? 'webgl' : 'dom';
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

function loadTestLongLines(): void {
  const rendererName = addons.webgl.instance ? 'webgl' : 'dom';
  const testData = [];
  let byteCount = 0;
  for (let i = 0; i < 50; i++) {
    const count = 1 + Math.floor(Math.random() * 500);
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
  for (let i = 0; i < 1024 * 50; i++) {
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

function addDecoration(): void {
  term.options['overviewRuler'] = { width: 14 };
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

function addOverviewRuler(): void {
  term.options['overviewRuler'] = { width: 14 };
  term.registerDecoration({ marker: term.registerMarker(1), overviewRulerOptions: { color: '#ef2929' } });
  term.registerDecoration({ marker: term.registerMarker(3), overviewRulerOptions: { color: '#8ae234' } });
  term.registerDecoration({ marker: term.registerMarker(5), overviewRulerOptions: { color: '#729fcf' } });
  term.registerDecoration({ marker: term.registerMarker(7), overviewRulerOptions: { color: '#ef2929', position: 'left' } });
  term.registerDecoration({ marker: term.registerMarker(7), overviewRulerOptions: { color: '#8ae234', position: 'center' } });
  term.registerDecoration({ marker: term.registerMarker(7), overviewRulerOptions: { color: '#729fcf', position: 'right' } });
  term.registerDecoration({ marker: term.registerMarker(10), overviewRulerOptions: { color: '#8ae234', position: 'center' } });
  term.registerDecoration({ marker: term.registerMarker(10), overviewRulerOptions: { color: '#ffffff80', position: 'full' } });
}

let decorationStressTestDecorations: IDisposable[] | undefined;
function decorationStressTest(): void {
  if (decorationStressTestDecorations) {
    for (const d of decorationStressTestDecorations) {
      d.dispose();
    }
    decorationStressTestDecorations = undefined;
  } else {
    const t = term as Terminal;
    const buffer = t.buffer.active;
    const cursorY = buffer.baseY + buffer.cursorY;
    decorationStressTestDecorations = [];
    for (const x of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]) {
      for (let y = 0; y < t.buffer.active.length; y++) {
        const cursorOffsetY = y - cursorY;
        decorationStressTestDecorations.push(t.registerDecoration({
          marker: t.registerMarker(cursorOffsetY),
          x,
          width: 4,
          backgroundColor: '#FF0000',
          overviewRulerOptions: { color: '#FF0000' }
        }));
      }
    }
  }
}

(console as any).image = (source: ImageData | HTMLCanvasElement, scale: number = 1) => {
  function getBox(width: number, height: number): any {
    return {
      string: '+',
      style: 'font-size: 1px; padding: ' + Math.floor(height/2) + 'px ' + Math.floor(width/2) + 'px; line-height: ' + height + 'px;'
    };
  }
  if (source instanceof HTMLCanvasElement) {
    source = source.getContext('2d')?.getImageData(0, 0, source.width, source.height)!;
  }
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(source, 0, 0);

  const sw = source.width * scale;
  const sh = source.height * scale;
  const dim = getBox(sw, sh);
  console.log(
    `Image: ${source.width} x ${source.height}\n%c${dim.string}`,
    `${dim.style}background: url(${canvas.toDataURL()}); background-size: ${sw}px ${sh}px; background-repeat: no-repeat; color: transparent;`
  );
  console.groupCollapsed('Zoomed');
  console.log(
    `%c${dim.string}`,
    `${getBox(sw * 10, sh * 10).style}background: url(${canvas.toDataURL()}); background-size: ${sw * 10}px ${sh * 10}px; background-repeat: no-repeat; color: transparent; image-rendering: pixelated;-ms-interpolation-mode: nearest-neighbor;`
  );
  console.groupEnd();
};

function ligaturesTest(): void {
  term.write([
    '',
    '-<< -< -<- <-- <--- <<- <- -> ->> --> ---> ->- >- >>-',
    '=<< =< =<= <== <=== <<= <= => =>> ==> ===> =>= >= >>=',
    '<-> <--> <---> <----> <=> <==> <===> <====> :: ::: __',
    '<~~ </ </> /> ~~> == != /= ~= <> === !== !=== =/= =!=',
    '<: := *= *+ <* <*> *> <| <|> |> <. <.> .> +* =* =: :>',
    '(* *) /* */ [| |] {| |} ++ +++ \/ /\ |- -| <!-- <!---',
    '==== ===== ====== ======= ======== =========',
    '---- ----- ------ ------- -------- ---------'
  ].join('\r\n'));
}

function testWeblinks(): void {
  const linkExamples = `
aaa http://example.com aaa http://example.com aaa
￥￥￥ http://example.com aaa http://example.com aaa
aaa http://example.com ￥￥￥ http://example.com aaa
￥￥￥ http://example.com ￥￥￥ http://example.com aaa
aaa https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문 aaa
￥￥￥ https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문 ￥￥￥
aaa http://test:password@example.com/some_path aaa
brackets enclosed:
aaa [http://example.de] aaa
aaa (http://example.de) aaa
aaa <http://example.de> aaa
aaa {http://example.de} aaa
ipv6 https://[::1]/with/some?vars=and&a#hash aaa
stop at final '.': This is a sentence with an url to http://example.com.
stop at final '?': Is this the right url http://example.com/?
stop at final '?': Maybe this one http://example.com/with?arguments=false?
`;
  term.write(linkExamples.split('\n').join('\r\n'));
}

function initImageAddonExposed(): void {
  const DEFAULT_OPTIONS: IImageAddonOptions = (addons.image.instance as any)._defaultOpts;
  const limitStorageElement = document.querySelector<HTMLInputElement>('#image-storagelimit');
  limitStorageElement.valueAsNumber = addons.image.instance.storageLimit;
  addDomListener(limitStorageElement, 'change', () => {
    try {
      addons.image.instance.storageLimit = limitStorageElement.valueAsNumber;
      limitStorageElement.valueAsNumber = addons.image.instance.storageLimit;
      console.log('changed storageLimit to', addons.image.instance.storageLimit);
    } catch (e) {
      limitStorageElement.valueAsNumber = addons.image.instance.storageLimit;
      console.log('storageLimit at', addons.image.instance.storageLimit);
      throw e;
    }
  });
  const showPlaceholderElement = document.querySelector<HTMLInputElement>('#image-showplaceholder');
  showPlaceholderElement.checked = addons.image.instance.showPlaceholder;
  addDomListener(showPlaceholderElement, 'change', () => {
    addons.image.instance.showPlaceholder = showPlaceholderElement.checked;
  });
  const ctorOptionsElement = document.querySelector<HTMLTextAreaElement>('#image-options');
  ctorOptionsElement.value = JSON.stringify(DEFAULT_OPTIONS, null, 2);

  const sixelDemo = (url: string) => () => fetch(url)
    .then(resp => resp.arrayBuffer())
    .then(buffer => {
      term.write('\r\n');
      term.write(new Uint8Array(buffer));
    });

  const iipDemo = (url: string) => () => fetch(url)
    .then(resp => resp.arrayBuffer())
    .then(buffer => {
      const data = new Uint8Array(buffer);
      let sdata = '';
      for (let i = 0; i < data.length; ++i) sdata += String.fromCharCode(data[i]);
      term.write('\r\n');
      term.write(`\x1b]1337;File=inline=1;size=${data.length}:${btoa(sdata)}\x1b\\`);
    });

  document.getElementById('image-demo1').addEventListener('click',
    sixelDemo('https://raw.githubusercontent.com/saitoha/libsixel/master/images/snake.six'));
  document.getElementById('image-demo2').addEventListener('click',
    sixelDemo('https://raw.githubusercontent.com/jerch/node-sixel/master/testfiles/test2.sixel'));
  document.getElementById('image-demo3').addEventListener('click',
    iipDemo('https://raw.githubusercontent.com/jerch/node-sixel/master/palette.png'));

  // demo for image retrieval API
  term.element.addEventListener('click', (ev: MouseEvent) => {
    if (!ev.ctrlKey || !addons.image.instance) return;

    // TODO...
    // if (ev.altKey) {
    //   const sel = term.getSelectionPosition();
    //   if (sel) {
    //     addons.image.instance
    //       .extractCanvasAtBufferRange(term.getSelectionPosition())
    //       ?.toBlob(data => window.open(URL.createObjectURL(data), '_blank'));
    //     return;
    //   }
    // }

    const pos = term._core._mouseService!.getCoords(ev, term._core.screenElement!, term.cols, term.rows);
    const x = pos[0] - 1;
    const y = pos[1] - 1;
    const canvas = ev.shiftKey
      // ctrl+shift+click: get single tile
      ? addons.image.instance.extractTileAtBufferCell(x, term.buffer.active.viewportY + y)
      // ctrl+click: get original image
      : addons.image.instance.getImageAtBufferCell(x, term.buffer.active.viewportY + y);
    canvas?.toBlob(data => window.open(URL.createObjectURL(data), '_blank'));
  });
}

function testEvents(): void {
  document.getElementById('event-focus').addEventListener('click', ()=> term.focus());
  document.getElementById('event-blur').addEventListener('click', ()=> term.blur());
}


function progressButtons(): void {
  const STATES = { 0: 'remove', 1: 'set', 2: 'error', 3: 'indeterminate', 4: 'pause' };
  const COLORS = { 0: '', 1: 'green', 2: 'red', 3: '', 4: 'yellow' };

  function progressHandler({ state, value }: IProgressState): void {
    // Simulate windows taskbar hack by windows terminal:
    // Since the taskbar has no means to indicate error/pause state other than by coloring
    // the current progress, we move 0 to 10% and distribute higher values in the remaining 90 %
    // NOTE: This is most likely not what you want to do for other progress indicators,
    //       that have a proper visual state for error/paused.
    value = Math.min(10 + value * 0.9, 100);
    document.getElementById('progress-percent').style.width = `${value}%`;
    document.getElementById('progress-percent').style.backgroundColor = COLORS[state];
    document.getElementById('progress-state').innerText = `State: ${STATES[state]}`;

    document.getElementById('progress-percent').style.display = state === 3 ? 'none' : 'block';
    document.getElementById('progress-indeterminate').style.display = state === 3 ? 'block' : 'none';
  }

  const progressAddon = addons.progress.instance;
  progressAddon.onChange(progressHandler);

  // apply initial state once to make it visible on page load
  const initialProgress = progressAddon.progress;
  progressHandler(initialProgress);

  document.getElementById('progress-run').addEventListener('click', async () => {
    term.write('\x1b]9;4;0\x1b\\');
    for (let i = 0; i <= 100; i += 5) {
      term.write(`\x1b]9;4;1;${i}\x1b\\`);
      await new Promise(res => setTimeout(res, 200));
    }
  });
  document.getElementById('progress-0').addEventListener('click', () => term.write('\x1b]9;4;0\x1b\\'));
  document.getElementById('progress-1').addEventListener('click', () => term.write('\x1b]9;4;1;20\x1b\\'));
  document.getElementById('progress-2').addEventListener('click', () => term.write('\x1b]9;4;2\x1b\\'));
  document.getElementById('progress-3').addEventListener('click', () => term.write('\x1b]9;4;3\x1b\\'));
  document.getElementById('progress-4').addEventListener('click', () => term.write('\x1b]9;4;4\x1b\\'));
}
