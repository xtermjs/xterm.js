/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This file is the entry point for browserify.
 */

// HACK: Playwright/WebKit on Windows does not support WebAssembly https://stackoverflow.com/q/62311688/1156119
import type { ImageAddon as ImageAddonType } from '@xterm/addon-image';
let ImageAddon: typeof ImageAddonType | undefined; // eslint-disable-line @typescript-eslint/naming-convention
if ('WebAssembly' in window) {
  const imageAddon = require('@xterm/addon-image');
  ImageAddon = imageAddon.ImageAddon;
}

import { Terminal, ITerminalOptions, type ITheme } from '@xterm/xterm';
import { AttachAddon } from '@xterm/addon-attach';
import { AddonImageWindow } from './components/window/addonImageWindow';
import { AddonSearchWindow } from './components/window/addonSearchWindow';
import { AddonSerializeWindow } from './components/window/addonSerializeWindow';
import { AddonsWindow } from './components/window/addonsWindow';
import { CellInspectorWindow } from './components/window/cellInspectorWindow';
import { ControlBar } from './components/controlBar';
import { WebglWindow } from './components/window/webglWindow';
import { OptionsWindow } from './components/window/optionsWindow';
import { StyleWindow } from './components/window/styleWindow';
import { TestWindow } from './components/window/testWindow';
import { VtWindow } from './components/window/vtWindow';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { FitAddon } from '@xterm/addon-fit';
import { LigaturesAddon } from '@xterm/addon-ligatures';
import { ProgressAddon } from '@xterm/addon-progress';
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
  AttachAddon?: typeof AttachAddon;
  ClipboardAddon?: typeof ClipboardAddon;
  FitAddon?: typeof FitAddon;
  ImageAddon?: typeof ImageAddon;
  ProgressAddon?: typeof ProgressAddon;
  SearchAddon?: typeof SearchAddon;
  SerializeAddon?: typeof SerializeAddon;
  WebLinksAddon?: typeof WebLinksAddon;
  WebglAddon?: typeof WebglAddon;
  Unicode11Addon?: typeof Unicode11Addon;
  UnicodeGraphemesAddon?: typeof UnicodeGraphemesAddon;
  LigaturesAddon?: typeof LigaturesAddon;
}
declare let window: IWindowWithTerminal;

let term;
let protocol;
let socketURL;
let socket;
let pid;
let controlBar: ControlBar;
let addonsWindow: AddonsWindow;
let addonSearchWindow: AddonSearchWindow;
let addonWebglWindow: WebglWindow;
let optionsWindow: OptionsWindow;

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
  optionsWindow = controlBar.registerWindow(new OptionsWindow(typedTerm, addons, { updateTerminalSize, updateTerminalContainerBackground }));
  const styleWindow = controlBar.registerWindow(new StyleWindow(typedTerm, addons));
  controlBar.registerWindow(new CellInspectorWindow(typedTerm, addons));
  controlBar.registerWindow(new VtWindow(typedTerm, addons));
  addonsWindow = controlBar.registerWindow(new AddonsWindow(typedTerm, addons));
  addonSearchWindow = controlBar.registerWindow(new AddonSearchWindow(typedTerm, addons), { afterId: 'addons', hidden: true, italics: true });
  controlBar.registerWindow(new AddonSerializeWindow(typedTerm, addons), { afterId: 'addon-search', hidden: true, italics: true });
  controlBar.registerWindow(new AddonImageWindow(typedTerm, addons), { afterId: 'addon-serialize', hidden: true, italics: true });
  addonWebglWindow = controlBar.registerWindow(new WebglWindow(typedTerm, addons), { afterId: 'addon-image', hidden: true, italics: true });
  controlBar.registerWindow(new TestWindow(typedTerm, addons, { disposeRecreateButtonHandler, createNewWindowButtonHandler }), { afterId: 'options' });
  actionElements = {
    findNext: addonSearchWindow.findNextInput,
    findPrevious: addonSearchWindow.findPreviousInput,
    findResults: addonSearchWindow.findResultsSpan
  };
  controlBar.activateDefaultTab();

  // TODO: Most of below should be encapsulated within windows
  paddingElement = styleWindow.paddingElement;

  controlBar.setTabVisible('addon-webgl', true);
  controlBar.setTabVisible('addon-search', true);
  controlBar.setTabVisible('addon-serialize', true);
  controlBar.setTabVisible('addon-image', true);
  addonWebglWindow.setTextureAtlas(addons.webgl.instance.textureAtlas);
  addons.webgl.instance.onChangeTextureAtlas(e => addonWebglWindow.setTextureAtlas(e));
  addons.webgl.instance.onAddTextureAtlasCanvas(e => addonWebglWindow.appendTextureAtlas(e));
  addons.webgl.instance.onRemoveTextureAtlasCanvas(e => addonWebglWindow.removeTextureAtlas(e));

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
    theme: { ...xtermjsTheme }
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
      // In general this should be debounced to avoid excessive work on the main
      // thread by firing the expensive resize action repeatedly
      addons.fit.instance.fit();
    }
  });
  resizeObserver.observe(terminalContainer);

  window.addEventListener('resize', () => {
    terminalContainer.style.width = document.body.clientWidth + 'px';
  });

  // fit is called within a setTimeout, cols and rows need this.
  setTimeout(async () => {
    optionsWindow.initOptions(addDomListener);

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
  if (term.options.allowTransparency) {
    terminalContainer.style.background = 'repeating-conic-gradient(#000000 0% 25%, #101010 0% 50%) 50% / 20px 20px';
  } else {
    terminalContainer.style.background = term.options.theme?.background ?? '#000000';
  }
}

function initAddons(term: Terminal): void {
  const fragment = document.createDocumentFragment();

  function postInitWebgl(): void {
    controlBar.setTabVisible('addon-webgl', true);
    setTimeout(() => {
      addonWebglWindow.setTextureAtlas(addons.webgl.instance.textureAtlas);
      addons.webgl.instance.onChangeTextureAtlas(e => addonWebglWindow.setTextureAtlas(e));
      addons.webgl.instance.onAddTextureAtlasCanvas(e => addonWebglWindow.appendTextureAtlas(e));
    }, 500);
  }
  function preDisposeWebgl(): void {
    controlBar.setTabVisible('addon-webgl', false);
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
          controlBar.setTabVisible('addon-image', true);
        } else {
          controlBar.setTabVisible('addon-image', false);
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
            controlBar.setTabVisible('addon-search', true);
            addons[name].instance.onDidChangeResults(e => updateFindResults(e));
          } else if (name === 'serialize') {
            controlBar.setTabVisible('addon-serialize', true);
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
        } else if (name === 'search') {
          controlBar.setTabVisible('addon-search', false);
        } else if (name === 'serialize') {
          controlBar.setTabVisible('addon-serialize', false);
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
    : (term.dimensions.css.canvas.width + term._core.viewport.scrollBarWidth).toString() + 'px';
  const height = optionsWindow.autoResize ? '100%'
    : (term.dimensions.css.canvas.height).toString() + 'px';
  terminalContainer.style.width = width;
  terminalContainer.style.height = height;
  addons.fit.instance.fit();
}

(console as any).image = (source: ImageData | HTMLCanvasElement, scale: number = 1) => {
  function getBox(width: number, height: number): any {
    return {
      string: '+',
      style: 'font-size: 1px; padding: ' + Math.floor(height/2) + 'px ' + Math.floor(width/2) + 'px; line-height: ' + height + 'px;'
    };
  }
  if (source instanceof HTMLCanvasElement) {
    source = source.getContext('2d')!.getImageData(0, 0, source.width, source.height)!;
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
