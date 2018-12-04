/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * @license MIT
 *
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 *   The original design remains. The terminal itself
 *   has been extended to include xterm CSI codes, among
 *   other features.
 *
 * Terminal Emulation References:
 *   http://vt100.net/
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.txt
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.html
 *   http://invisible-island.net/vttest/
 *   http://www.inwap.com/pdp10/ansicode.txt
 *   http://linux.die.net/man/4/console_codes
 *   http://linux.die.net/man/7/urxvt
 */

import { IInputHandlingTerminal, IViewport, ICompositionHelper, ITerminalOptions, ITerminal, IBrowser, ILinkifier, ILinkMatcherOptions, CustomKeyEventHandler, LinkMatcherHandler, CharData, CharacterJoinerHandler, IBufferLine } from './Types';
import { IMouseZoneManager } from './ui/Types';
import { IRenderer } from './renderer/Types';
import { BufferSet } from './BufferSet';
import { Buffer, MAX_BUFFER_SIZE, DEFAULT_ATTR, NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR, CHAR_DATA_ATTR_INDEX } from './Buffer';
import { CompositionHelper } from './CompositionHelper';
import { EventEmitter } from './common/EventEmitter';
import { Viewport } from './Viewport';
import { rightClickHandler, moveTextAreaUnderMouseCursor, pasteHandler, copyHandler } from './ui/Clipboard';
import { C0 } from './common/data/EscapeSequences';
import { InputHandler } from './InputHandler';
import { Renderer } from './renderer/Renderer';
import { Linkifier } from './Linkifier';
import { SelectionManager } from './SelectionManager';
import { CharMeasure } from './ui/CharMeasure';
import * as Browser from './core/Platform';
import { addDisposableDomListener } from './ui/Lifecycle';
import * as Strings from './Strings';
import { MouseHelper } from './utils/MouseHelper';
import { clone } from './utils/Clone';
import { DEFAULT_BELL_SOUND, SoundManager } from './SoundManager';
import { DEFAULT_ANSI_COLORS } from './renderer/ColorManager';
import { MouseZoneManager } from './ui/MouseZoneManager';
import { AccessibilityManager } from './AccessibilityManager';
import { ScreenDprMonitor } from './ui/ScreenDprMonitor';
import { ITheme, IMarker, IDisposable } from 'xterm';
import { removeTerminalFromCache } from './renderer/atlas/CharAtlasCache';
import { DomRenderer } from './renderer/dom/DomRenderer';
import { IKeyboardEvent } from './common/Types';
import { evaluateKeyboardEvent } from './core/input/Keyboard';
import { KeyboardResultType, ICharset } from './core/Types';

// Let it work inside Node.js for automated testing purposes.
const document = (typeof window !== 'undefined') ? window.document : null;

/**
 * The amount of write requests to queue before sending an XOFF signal to the
 * pty process. This number must be small in order for ^C and similar sequences
 * to be responsive.
 */
const WRITE_BUFFER_PAUSE_THRESHOLD = 5;

/**
 * The number of writes to perform in a single batch before allowing the
 * renderer to catch up with a 0ms setTimeout.
 */
const WRITE_BATCH_SIZE = 300;

/**
 * The set of options that only have an effect when set in the Terminal constructor.
 */
const CONSTRUCTOR_ONLY_OPTIONS = ['cols', 'rows'];

const DEFAULT_OPTIONS: ITerminalOptions = {
  cols: 80,
  rows: 24,
  convertEol: false,
  termName: 'xterm',
  cursorBlink: false,
  cursorStyle: 'block',
  bellSound: DEFAULT_BELL_SOUND,
  bellStyle: 'none',
  drawBoldTextInBrightColors: true,
  enableBold: true,
  experimentalCharAtlas: 'static',
  fontFamily: 'courier-new, courier, monospace',
  fontSize: 15,
  fontWeight: 'normal',
  fontWeightBold: 'bold',
  lineHeight: 1.0,
  letterSpacing: 0,
  scrollback: 1000,
  screenKeys: false,
  screenReaderMode: false,
  debug: false,
  macOptionIsMeta: false,
  macOptionClickForcesSelection: false,
  cancelEvents: false,
  disableStdin: false,
  useFlowControl: false,
  allowTransparency: false,
  tabStopWidth: 8,
  theme: null,
  rightClickSelectsWord: Browser.isMac,
  rendererType: 'canvas',
  experimentalBufferLineImpl: 'TypedArray'
};

export class Terminal extends EventEmitter implements ITerminal, IDisposable, IInputHandlingTerminal {
  public textarea: HTMLTextAreaElement;
  public element: HTMLElement;
  public screenElement: HTMLElement;

  /**
   * The HTMLElement that the terminal is created in, set by Terminal.open.
   */
  private _parent: HTMLElement;
  private _context: Window;
  private _document: Document;
  private _viewportScrollArea: HTMLElement;
  private _viewportElement: HTMLElement;
  private _helperContainer: HTMLElement;
  private _compositionView: HTMLElement;

  private _visualBellTimer: number;

  public browser: IBrowser = <any>Browser;

  public options: ITerminalOptions;

  // TODO: This can be changed to an enum or boolean, 0 and 1 seem to be the only options
  public cursorState: number;
  public cursorHidden: boolean;

  private _customKeyEventHandler: CustomKeyEventHandler;

  // modes
  public applicationKeypad: boolean;
  public applicationCursor: boolean;
  public originMode: boolean;
  public insertMode: boolean;
  public wraparoundMode: boolean; // defaults: xterm - true, vt100 - false
  public bracketedPasteMode: boolean;

  // charset
  // The current charset
  public charset: ICharset;
  public gcharset: number;
  public glevel: number;
  public charsets: ICharset[];

  // mouse properties
  private _decLocator: boolean; // This is unstable and never set
  public x10Mouse: boolean;
  public vt200Mouse: boolean;
  private _vt300Mouse: boolean; // This is unstable and never set
  public normalMouse: boolean;
  public mouseEvents: boolean;
  public sendFocus: boolean;
  public utfMouse: boolean;
  public sgrMouse: boolean;
  public urxvtMouse: boolean;

  // misc
  private _refreshStart: number;
  private _refreshEnd: number;
  public savedCols: number;

  public curAttr: number;

  public params: (string | number)[];
  public currentParam: string | number;

  // user input states
  public writeBuffer: string[];
  private _writeInProgress: boolean;

  /**
   * Whether _xterm.js_ sent XOFF in order to catch up with the pty process.
   * This is a distinct state from writeStopped so that if the user requested
   * XOFF via ^S that it will not automatically resume when the writeBuffer goes
   * below threshold.
   */
  private _xoffSentToCatchUp: boolean;

  /** Whether writing has been stopped as a result of XOFF */
  // private _writeStopped: boolean;

  // Store if user went browsing history in scrollback
  private _userScrolling: boolean;

  private _inputHandler: InputHandler;
  public soundManager: SoundManager;
  public renderer: IRenderer;
  public selectionManager: SelectionManager;
  public linkifier: ILinkifier;
  public buffers: BufferSet;
  public viewport: IViewport;
  private _compositionHelper: ICompositionHelper;
  public charMeasure: CharMeasure;
  private _mouseZoneManager: IMouseZoneManager;
  public mouseHelper: MouseHelper;
  private _accessibilityManager: AccessibilityManager;
  private _screenDprMonitor: ScreenDprMonitor;
  private _theme: ITheme;

  // bufferline to clone/copy from for new blank lines
  private _blankLine: IBufferLine = null;

  public cols: number;
  public rows: number;

  /**
   * Creates a new `Terminal` object.
   *
   * @param options An object containing a set of options, the available options are:
   *   - `cursorBlink` (boolean): Whether the terminal cursor blinks
   *   - `cols` (number): The number of columns of the terminal (horizontal size)
   *   - `rows` (number): The number of rows of the terminal (vertical size)
   *
   * @public
   * @class Xterm Xterm
   * @alias module:xterm/src/xterm
   */
  constructor(
    options: ITerminalOptions = {}
  ) {
    super();
    this.options = clone(options);
    this._setup();
  }

  public dispose(): void {
    super.dispose();
    this._customKeyEventHandler = null;
    removeTerminalFromCache(this);
    this.handler = () => {};
    this.write = () => {};
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  /**
   * @deprecated Use dispose instead.
   */
  public destroy(): void {
    this.dispose();
  }

  private _setup(): void {
    Object.keys(DEFAULT_OPTIONS).forEach((key) => {
      if (this.options[key] === null || this.options[key] === undefined) {
        this.options[key] = DEFAULT_OPTIONS[key];
      }
    });

    // this.context = options.context || window;
    // this.document = options.document || document;
    // TODO: WHy not document.body?
    this._parent = document ? document.body : null;

    this.cols = this.options.cols;
    this.rows = this.options.rows;

    if (this.options.handler) {
      this.on('data', this.options.handler);
    }

    this.cursorState = 0;
    this.cursorHidden = false;
    this._customKeyEventHandler = null;

    // modes
    this.applicationKeypad = false;
    this.applicationCursor = false;
    this.originMode = false;
    this.insertMode = false;
    this.wraparoundMode = true; // defaults: xterm - true, vt100 - false
    this.bracketedPasteMode = false;

    // charset
    this.charset = null;
    this.gcharset = null;
    this.glevel = 0;
    // TODO: Can this be just []?
    this.charsets = [null];

    this.curAttr = DEFAULT_ATTR;

    this.params = [];
    this.currentParam = 0;

    // user input states
    this.writeBuffer = [];
    this._writeInProgress = false;

    this._xoffSentToCatchUp = false;
    // this._writeStopped = false;
    this._userScrolling = false;

    this._inputHandler = new InputHandler(this);
    this.register(this._inputHandler);
    // Reuse renderer if the Terminal is being recreated via a reset call.
    this.renderer = this.renderer || null;
    this.selectionManager = this.selectionManager || null;
    this.linkifier = this.linkifier || new Linkifier(this);
    this._mouseZoneManager = this._mouseZoneManager || null;
    this.soundManager = this.soundManager || new SoundManager(this);

    // Create the terminal's buffers and set the current buffer
    this.buffers = new BufferSet(this);
    if (this.selectionManager) {
      this.selectionManager.clearSelection();
      this.selectionManager.initBuffersListeners();
    }
  }

  /**
   * Convenience property to active buffer.
   */
  public get buffer(): Buffer {
    return this.buffers.active;
  }

  /**
   * back_color_erase feature for xterm.
   */
  public eraseAttr(): number {
    // if (this.is('screen')) return DEFAULT_ATTR;
    return (DEFAULT_ATTR & ~0x1ff) | (this.curAttr & 0x1ff);
  }

  /**
   * Focus the terminal. Delegates focus handling to the terminal's DOM element.
   */
  public focus(): void {
    if (this.textarea) {
      this.textarea.focus();
    }
  }

  public get isFocused(): boolean {
    return document.activeElement === this.textarea && document.hasFocus();
  }

  /**
   * Retrieves an option's value from the terminal.
   * @param key The option key.
   */
  public getOption(key: string): any {
    if (!(key in DEFAULT_OPTIONS)) {
      throw new Error('No option with key "' + key + '"');
    }

    return this.options[key];
  }

  /**
   * Sets an option on the terminal.
   * @param key The option key.
   * @param value The option value.
   */
  public setOption(key: string, value: any): void {
    if (!(key in DEFAULT_OPTIONS)) {
      throw new Error('No option with key "' + key + '"');
    }
    if (CONSTRUCTOR_ONLY_OPTIONS.indexOf(key) !== -1) {
      console.error(`Option "${key}" can only be set in the constructor`);
    }
    if (this.options[key] === value) {
      return;
    }
    switch (key) {
      case 'bellStyle':
        if (!value) {
          value = 'none';
        }
        break;
      case 'cursorStyle':
        if (!value) {
          value = 'block';
        }
        break;
      case 'fontWeight':
        if (!value) {
          value = 'normal';
        }
        break;
      case 'fontWeightBold':
        if (!value) {
          value = 'bold';
        }
        break;
      case 'lineHeight':
        if (value < 1) {
          console.warn(`${key} cannot be less than 1, value: ${value}`);
          return;
        }
      case 'rendererType':
        if (!value) {
          value = 'canvas';
        }
        break;
      case 'tabStopWidth':
        if (value < 1) {
          console.warn(`${key} cannot be less than 1, value: ${value}`);
          return;
        }
        break;
      case 'theme':
        // If open has been called we do not want to set options.theme as the
        // source of truth is owned by the renderer.
        if (this.renderer) {
          this._setTheme(<ITheme>value);
          return;
        }
        break;
      case 'scrollback':
        value = Math.min(value, MAX_BUFFER_SIZE);

        if (value < 0) {
          console.warn(`${key} cannot be less than 0, value: ${value}`);
          return;
        }
        if (this.options[key] !== value) {
          const newBufferLength = this.rows + value;
          if (this.buffer.lines.length > newBufferLength) {
            const amountToTrim = this.buffer.lines.length - newBufferLength;
            const needsRefresh = (this.buffer.ydisp - amountToTrim < 0);
            this.buffer.lines.trimStart(amountToTrim);
            this.buffer.ybase = Math.max(this.buffer.ybase - amountToTrim, 0);
            this.buffer.ydisp = Math.max(this.buffer.ydisp - amountToTrim, 0);
            if (needsRefresh) {
              this.refresh(0, this.rows - 1);
            }
          }
        }
        break;
    }
    this.options[key] = value;
    switch (key) {
      case 'fontFamily':
      case 'fontSize':
        // When the font changes the size of the cells may change which requires a renderer clear
        if (this.renderer) {
          this.renderer.clear();
          this.charMeasure.measure(this.options);
        }
        break;
      case 'drawBoldTextInBrightColors':
      case 'experimentalCharAtlas':
      case 'enableBold':
      case 'letterSpacing':
      case 'lineHeight':
      case 'fontWeight':
      case 'fontWeightBold':
        // When the font changes the size of the cells may change which requires a renderer clear
        if (this.renderer) {
          this.renderer.clear();
          this.renderer.onResize(this.cols, this.rows);
          this.refresh(0, this.rows - 1);
        }
      case 'rendererType':
        if (this.renderer) {
          this.unregister(this.renderer);
          this.renderer.dispose();
          this.renderer = null;
        }
        this._setupRenderer();
        this.renderer.onCharSizeChanged();
        if (this._theme) {
          this.renderer.setTheme(this._theme);
        }
        this.mouseHelper.setRenderer(this.renderer);
        break;
      case 'scrollback':
        this.buffers.resize(this.cols, this.rows);
        if (this.viewport) {
          this.viewport.syncScrollArea();
        }
        break;
      case 'screenReaderMode':
        if (value) {
          if (!this._accessibilityManager) {
            this._accessibilityManager = new AccessibilityManager(this);
          }
        } else {
          if (this._accessibilityManager) {
            this._accessibilityManager.dispose();
            this._accessibilityManager = null;
          }
        }
        break;
      case 'tabStopWidth': this.buffers.setupTabStops(); break;
      case 'experimentalBufferLineImpl':
        this.buffers.normal.setBufferLineFactory(value);
        this.buffers.alt.setBufferLineFactory(value);
        this._blankLine = null;
        break;
    }
    // Inform renderer of changes
    if (this.renderer) {
      this.renderer.onOptionsChanged();
    }
  }

  /**
   * Binds the desired focus behavior on a given terminal object.
   */
  private _onTextAreaFocus(ev: KeyboardEvent): void {
    if (this.sendFocus) {
      this.handler(C0.ESC + '[I');
    }
    this.updateCursorStyle(ev);
    this.element.classList.add('focus');
    this.showCursor();
    this.emit('focus');
  }

  /**
   * Blur the terminal, calling the blur function on the terminal's underlying
   * textarea.
   */
  public blur(): void {
    return this.textarea.blur();
  }

  /**
   * Binds the desired blur behavior on a given terminal object.
   */
  private _onTextAreaBlur(): void {
    // Text can safely be removed on blur. Doing it earlier could interfere with
    // screen readers reading it out.
    this.textarea.value = '';
    this.refresh(this.buffer.y, this.buffer.y);
    if (this.sendFocus) {
      this.handler(C0.ESC + '[O');
    }
    this.element.classList.remove('focus');
    this.emit('blur');
  }

  /**
   * Initialize default behavior
   */
  private _initGlobal(): void {
    this._bindKeys();

    // Bind clipboard functionality
    this.register(addDisposableDomListener(this.element, 'copy', (event: ClipboardEvent) => {
      // If mouse events are active it means the selection manager is disabled and
      // copy should be handled by the host program.
      if (!this.hasSelection()) {
        return;
      }
      copyHandler(event, this, this.selectionManager);
    }));
    const pasteHandlerWrapper = (event: ClipboardEvent) => pasteHandler(event, this);
    this.register(addDisposableDomListener(this.textarea, 'paste', pasteHandlerWrapper));
    this.register(addDisposableDomListener(this.element, 'paste', pasteHandlerWrapper));

    // Handle right click context menus
    if (Browser.isFirefox) {
      // Firefox doesn't appear to fire the contextmenu event on right click
      this.register(addDisposableDomListener(this.element, 'mousedown', (event: MouseEvent) => {
        if (event.button === 2) {
          rightClickHandler(event, this.textarea, this.selectionManager, this.options.rightClickSelectsWord);
        }
      }));
    } else {
      this.register(addDisposableDomListener(this.element, 'contextmenu', (event: MouseEvent) => {
        rightClickHandler(event, this.textarea, this.selectionManager, this.options.rightClickSelectsWord);
      }));
    }

    // Move the textarea under the cursor when middle clicking on Linux to ensure
    // middle click to paste selection works. This only appears to work in Chrome
    // at the time is writing.
    if (Browser.isLinux) {
      // Use auxclick event over mousedown the latter doesn't seem to work. Note
      // that the regular click event doesn't fire for the middle mouse button.
      this.register(addDisposableDomListener(this.element, 'auxclick', (event: MouseEvent) => {
        if (event.button === 1) {
          moveTextAreaUnderMouseCursor(event, this.textarea);
        }
      }));
    }
  }

  /**
   * Apply key handling to the terminal
   */
  private _bindKeys(): void {
    const self = this;
    this.register(addDisposableDomListener(this.element, 'keydown', function (ev: KeyboardEvent): void {
      if (document.activeElement !== this) {
        return;
      }
      self._keyDown(ev);
    }, true));

    this.register(addDisposableDomListener(this.element, 'keypress', function (ev: KeyboardEvent): void {
      if (document.activeElement !== this) {
        return;
      }
      self._keyPress(ev);
    }, true));

    this.register(addDisposableDomListener(this.element, 'keyup', (ev: KeyboardEvent) => {
      if (!wasModifierKeyOnlyEvent(ev)) {
        this.focus();
      }

      self._keyUp(ev);
    }, true));

    this.register(addDisposableDomListener(this.textarea, 'keydown', (ev: KeyboardEvent) => this._keyDown(ev), true));
    this.register(addDisposableDomListener(this.textarea, 'keypress', (ev: KeyboardEvent) => this._keyPress(ev), true));
    this.register(addDisposableDomListener(this.textarea, 'compositionstart', () => this._compositionHelper.compositionstart()));
    this.register(addDisposableDomListener(this.textarea, 'compositionupdate', (e: CompositionEvent) => this._compositionHelper.compositionupdate(e)));
    this.register(addDisposableDomListener(this.textarea, 'compositionend', () => this._compositionHelper.compositionend()));
    this.register(this.addDisposableListener('refresh', () => this._compositionHelper.updateCompositionElements()));
    this.register(this.addDisposableListener('refresh', (data) => this._queueLinkification(data.start, data.end)));
  }

  /**
   * Opens the terminal within an element.
   *
   * @param parent The element to create the terminal within.
   */
  public open(parent: HTMLElement): void {
    this._parent = parent || this._parent;

    if (!this._parent) {
      throw new Error('Terminal requires a parent element.');
    }

    // Grab global elements
    this._context = this._parent.ownerDocument.defaultView;
    this._document = this._parent.ownerDocument;

    this._screenDprMonitor = new ScreenDprMonitor();
    this._screenDprMonitor.setListener(() => this.emit('dprchange', window.devicePixelRatio));
    this.register(this._screenDprMonitor);

    // Create main element container
    this.element = this._document.createElement('div');
    this.element.dir = 'ltr';   // xterm.css assumes LTR
    this.element.classList.add('terminal');
    this.element.classList.add('xterm');
    this.element.setAttribute('tabindex', '0');
    this._parent.appendChild(this.element);

    // Performance: Use a document fragment to build the terminal
    // viewport and helper elements detached from the DOM
    const fragment = document.createDocumentFragment();
    this._viewportElement = document.createElement('div');
    this._viewportElement.classList.add('xterm-viewport');
    fragment.appendChild(this._viewportElement);
    this._viewportScrollArea = document.createElement('div');
    this._viewportScrollArea.classList.add('xterm-scroll-area');
    this._viewportElement.appendChild(this._viewportScrollArea);

    this.screenElement = document.createElement('div');
    this.screenElement.classList.add('xterm-screen');
    // Create the container that will hold helpers like the textarea for
    // capturing DOM Events. Then produce the helpers.
    this._helperContainer = document.createElement('div');
    this._helperContainer.classList.add('xterm-helpers');
    this.screenElement.appendChild(this._helperContainer);
    fragment.appendChild(this.screenElement);

    this._mouseZoneManager = new MouseZoneManager(this);
    this.register(this._mouseZoneManager);
    this.register(this.addDisposableListener('scroll', () => this._mouseZoneManager.clearAll()));
    this.linkifier.attachToDom(this._mouseZoneManager);

    this.textarea = document.createElement('textarea');
    this.textarea.classList.add('xterm-helper-textarea');
    // TODO: New API to set title? This could say "Terminal bash input", etc.
    this.textarea.setAttribute('aria-label', Strings.promptLabel);
    this.textarea.setAttribute('aria-multiline', 'false');
    this.textarea.setAttribute('autocorrect', 'off');
    this.textarea.setAttribute('autocapitalize', 'off');
    this.textarea.setAttribute('spellcheck', 'false');
    this.textarea.tabIndex = 0;
    this.register(addDisposableDomListener(this.textarea, 'focus', (ev: KeyboardEvent) => this._onTextAreaFocus(ev)));
    this.register(addDisposableDomListener(this.textarea, 'blur', () => this._onTextAreaBlur()));
    this._helperContainer.appendChild(this.textarea);

    this._compositionView = document.createElement('div');
    this._compositionView.classList.add('composition-view');
    this._compositionHelper = new CompositionHelper(this.textarea, this._compositionView, this);
    this._helperContainer.appendChild(this._compositionView);

    this.charMeasure = new CharMeasure(document, this._helperContainer);

    // Performance: Add viewport and helper elements from the fragment
    this.element.appendChild(fragment);

    this._setupRenderer();
    this._theme = this.options.theme;
    this.options.theme = null;
    this.viewport = new Viewport(this, this._viewportElement, this._viewportScrollArea, this.charMeasure);
    this.viewport.onThemeChanged(this.renderer.colorManager.colors);
    this.register(this.viewport);

    this.register(this.addDisposableListener('cursormove', () => this.renderer.onCursorMove()));
    this.register(this.addDisposableListener('resize', () => this.renderer.onResize(this.cols, this.rows)));
    this.register(this.addDisposableListener('blur', () => this.renderer.onBlur()));
    this.register(this.addDisposableListener('focus', () => this.renderer.onFocus()));
    this.register(this.addDisposableListener('dprchange', () => this.renderer.onWindowResize(window.devicePixelRatio)));
    // dprchange should handle this case, we need this as well for browsers that don't support the
    // matchMedia query.
    this.register(addDisposableDomListener(window, 'resize', () => this.renderer.onWindowResize(window.devicePixelRatio)));
    this.register(this.charMeasure.addDisposableListener('charsizechanged', () => this.renderer.onCharSizeChanged()));
    this.register(this.renderer.addDisposableListener('resize', (dimensions) => this.viewport.syncScrollArea()));

    this.selectionManager = new SelectionManager(this, this.charMeasure);
    this.register(addDisposableDomListener(this.element, 'mousedown', (e: MouseEvent) => this.selectionManager.onMouseDown(e)));
    this.register(this.selectionManager.addDisposableListener('refresh', data => this.renderer.onSelectionChanged(data.start, data.end, data.columnSelectMode)));
    this.register(this.selectionManager.addDisposableListener('newselection', text => {
      // If there's a new selection, put it into the textarea, focus and select it
      // in order to register it as a selection on the OS. This event is fired
      // only on Linux to enable middle click to paste selection.
      this.textarea.value = text;
      this.textarea.focus();
      this.textarea.select();
    }));
    this.register(this.addDisposableListener('scroll', () => {
      this.viewport.syncScrollArea();
      this.selectionManager.refresh();
    }));
    this.register(addDisposableDomListener(this._viewportElement, 'scroll', () => this.selectionManager.refresh()));

    this.mouseHelper = new MouseHelper(this.renderer);

    if (this.options.screenReaderMode) {
      // Note that this must be done *after* the renderer is created in order to
      // ensure the correct order of the dprchange event
      this._accessibilityManager = new AccessibilityManager(this);
    }

    // Measure the character size
    this.charMeasure.measure(this.options);

    // Setup loop that draws to screen
    this.refresh(0, this.rows - 1);

    // Initialize global actions that need to be taken on the document.
    this._initGlobal();

    // Listen for mouse events and translate
    // them into terminal mouse protocols.
    this.bindMouse();

  }

  private _setupRenderer(): void {
    switch (this.options.rendererType) {
      case 'canvas': this.renderer = new Renderer(this, this.options.theme); break;
      case 'dom': this.renderer = new DomRenderer(this, this.options.theme); break;
      default: throw new Error(`Unrecognized rendererType "${this.options.rendererType}"`);
    }
    this.register(this.renderer);
  }

  /**
   * Sets the theme on the renderer. The renderer must have been initialized.
   * @param theme The theme to set.
   */
  private _setTheme(theme: ITheme): void {
    this._theme = theme;
    const colors = this.renderer.setTheme(theme);
    if (this.viewport) {
      this.viewport.onThemeChanged(colors);
    }
  }

  /**
   * XTerm mouse events
   * http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
   * To better understand these
   * the xterm code is very helpful:
   * Relevant files:
   *   button.c, charproc.c, misc.c
   * Relevant functions in xterm/button.c:
   *   BtnCode, EmitButtonCode, EditorButton, SendMousePosition
   */
  public bindMouse(): void {
    const el = this.element;
    const self = this;
    let pressed = 32;

    // mouseup, mousedown, wheel
    // left click: ^[[M 3<^[[M#3<
    // wheel up: ^[[M`3>
    function sendButton(ev: MouseEvent | WheelEvent): void {
      let button;
      let pos;

      // get the xterm-style button
      button = getButton(ev);

      // get mouse coordinates
      pos = self.mouseHelper.getRawByteCoords(ev, self.screenElement, self.charMeasure, self.cols, self.rows);
      if (!pos) return;

      sendEvent(button, pos);

      switch ((<any>ev).overrideType || ev.type) {
        case 'mousedown':
          pressed = button;
          break;
        case 'mouseup':
          // keep it at the left
          // button, just in case.
          pressed = 32;
          break;
        case 'wheel':
          // nothing. don't
          // interfere with
          // `pressed`.
          break;
      }
    }

    // motion example of a left click:
    // ^[[M 3<^[[M@4<^[[M@5<^[[M@6<^[[M@7<^[[M#7<
    function sendMove(ev: MouseEvent): void {
      let button = pressed;
      const pos = self.mouseHelper.getRawByteCoords(ev, self.screenElement, self.charMeasure, self.cols, self.rows);
      if (!pos) return;

      // buttons marked as motions
      // are incremented by 32
      button += 32;

      sendEvent(button, pos);
    }

    // encode button and
    // position to characters
    function encode(data: number[], ch: number): void {
      if (!self.utfMouse) {
        if (ch === 255) {
          data.push(0);
          return;
        }
        if (ch > 127) ch = 127;
        data.push(ch);
      } else {
        if (ch === 2047) {
          data.push(0);
          return;
        }
        if (ch < 127) {
          data.push(ch);
        } else {
          if (ch > 2047) ch = 2047;
          data.push(0xC0 | (ch >> 6));
          data.push(0x80 | (ch & 0x3F));
        }
      }
    }

    // send a mouse event:
    // regular/utf8: ^[[M Cb Cx Cy
    // urxvt: ^[[ Cb ; Cx ; Cy M
    // sgr: ^[[ Cb ; Cx ; Cy M/m
    // vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
    // locator: CSI P e ; P b ; P r ; P c ; P p & w
    function sendEvent(button: number, pos: {x: number, y: number}): void {
      // self.emit('mouse', {
      //   x: pos.x - 32,
      //   y: pos.x - 32,
      //   button: button
      // });

      if (self._vt300Mouse) {
        // NOTE: Unstable.
        // http://www.vt100.net/docs/vt3xx-gp/chapter15.html
        button &= 3;
        pos.x -= 32;
        pos.y -= 32;
        let data = C0.ESC + '[24';
        if (button === 0) data += '1';
        else if (button === 1) data += '3';
        else if (button === 2) data += '5';
        else if (button === 3) return;
        else data += '0';
        data += '~[' + pos.x + ',' + pos.y + ']\r';
        self.handler(data);
        return;
      }

      if (self._decLocator) {
        // NOTE: Unstable.
        button &= 3;
        pos.x -= 32;
        pos.y -= 32;
        if (button === 0) button = 2;
        else if (button === 1) button = 4;
        else if (button === 2) button = 6;
        else if (button === 3) button = 3;
        self.handler(C0.ESC + '['
                  + button
                  + ';'
                  + (button === 3 ? 4 : 0)
                  + ';'
                  + pos.y
                  + ';'
                  + pos.x
                  + ';'
                  // Not sure what page is meant to be
                  + (<any>pos).page || 0
                  + '&w');
        return;
      }

      if (self.urxvtMouse) {
        pos.x -= 32;
        pos.y -= 32;
        pos.x++;
        pos.y++;
        self.handler(C0.ESC + '[' + button + ';' + pos.x + ';' + pos.y + 'M');
        return;
      }

      if (self.sgrMouse) {
        pos.x -= 32;
        pos.y -= 32;
        self.handler(C0.ESC + '[<'
                  + (((button & 3) === 3 ? button & ~3 : button) - 32)
                  + ';'
                  + pos.x
                  + ';'
                  + pos.y
                  + ((button & 3) === 3 ? 'm' : 'M'));
        return;
      }

      const data: number[] = [];

      encode(data, button);
      encode(data, pos.x);
      encode(data, pos.y);

      self.handler(C0.ESC + '[M' + String.fromCharCode.apply(String, data));
    }

    function getButton(ev: MouseEvent): number {
      let button;
      let shift;
      let meta;
      let ctrl;
      let mod;

      // two low bits:
      // 0 = left
      // 1 = middle
      // 2 = right
      // 3 = release
      // wheel up/down:
      // 1, and 2 - with 64 added
      switch ((<any>ev).overrideType || ev.type) {
        case 'mousedown':
          button = ev.button !== null && ev.button !== undefined
            ? +ev.button
          : ev.which !== null && ev.which !== undefined
            ? ev.which - 1
          : null;

          if (Browser.isMSIE) {
            button = button === 1 ? 0 : button === 4 ? 1 : button;
          }
          break;
        case 'mouseup':
          button = 3;
          break;
        case 'DOMMouseScroll':
          button = ev.detail < 0
            ? 64
          : 65;
          break;
        case 'wheel':
          button = (<WheelEvent>ev).deltaY < 0
            ? 64
          : 65;
          break;
      }

      // next three bits are the modifiers:
      // 4 = shift, 8 = meta, 16 = control
      shift = ev.shiftKey ? 4 : 0;
      meta = ev.metaKey ? 8 : 0;
      ctrl = ev.ctrlKey ? 16 : 0;
      mod = shift | meta | ctrl;

      // no mods
      if (self.vt200Mouse) {
        // ctrl only
        mod &= ctrl;
      } else if (!self.normalMouse) {
        mod = 0;
      }

      // increment to SP
      button = (32 + (mod << 2)) + button;

      return button;
    }

    this.register(addDisposableDomListener(el, 'mousedown', (ev: MouseEvent) => {

      // Prevent the focus on the textarea from getting lost
      // and make sure we get focused on mousedown
      ev.preventDefault();
      this.focus();

      // Don't send the mouse button to the pty if mouse events are disabled or
      // if the selection manager is having selection forced (ie. a modifier is
      // held).
      if (!this.mouseEvents || this.selectionManager.shouldForceSelection(ev)) {
        return;
      }

      // send the button
      sendButton(ev);

      // fix for odd bug
      // if (this.vt200Mouse && !this.normalMouse) {
      if (this.vt200Mouse) {
        (<any>ev).overrideType = 'mouseup';
        sendButton(ev);
        return this.cancel(ev);
      }

      // TODO: All mouse handling should be pulled into its own file.

      // bind events
      let moveHandler: (event: MouseEvent) => void;
      if (this.normalMouse) {
        moveHandler = (event: MouseEvent) => {
          // Do nothing if normal mouse mode is on. This can happen if the mouse is held down when the
          // terminal exits normalMouse mode.
          if (!this.normalMouse) {
            return;
          }
          sendMove(event);
        };
        // TODO: these event listeners should be managed by the disposable, the Terminal reference may
        // be kept aroud if Terminal.dispose is fired when the mouse is down
        this._document.addEventListener('mousemove', moveHandler);
      }

      // x10 compatibility mode can't send button releases
      const handler = (ev: MouseEvent) => {
        if (this.normalMouse && !this.x10Mouse) {
          sendButton(ev);
        }
        if (moveHandler) {
          // Even though this should only be attached when this.normalMouse is true, holding the
          // mouse button down when normalMouse changes can happen. Just always try to remove it.
          this._document.removeEventListener('mousemove', moveHandler);
          moveHandler = null;
        }
        this._document.removeEventListener('mouseup', handler);
        return this.cancel(ev);
      };
      this._document.addEventListener('mouseup', handler);

      return this.cancel(ev);
    }));

    // if (this.normalMouse) {
    //  on(this.document, 'mousemove', sendMove);
    // }

    this.register(addDisposableDomListener(el, 'wheel', (ev: WheelEvent) => {
      if (!this.mouseEvents) {
        // Convert wheel events into up/down events when the buffer does not have scrollback, this
        // enables scrolling in apps hosted in the alt buffer such as vim or tmux.
        if (!this.buffer.hasScrollback) {
          const amount = this.viewport.getLinesScrolled(ev);

          // Do nothing if there's no vertical scroll
          if (amount === 0) {
            return;
          }

          // Construct and send sequences
          const sequence = C0.ESC + (this.applicationCursor ? 'O' : '[') + ( ev.deltaY < 0 ? 'A' : 'B');
          let data = '';
          for (let i = 0; i < Math.abs(amount); i++) {
            data += sequence;
          }
          this.handler(data);
        }
        return;
      }
      if (this.x10Mouse || this._vt300Mouse || this._decLocator) return;
      sendButton(ev);
      ev.preventDefault();
    }));

    // allow wheel scrolling in
    // the shell for example
    this.register(addDisposableDomListener(el, 'wheel', (ev: WheelEvent) => {
      if (this.mouseEvents) return;
      this.viewport.onWheel(ev);
      return this.cancel(ev);
    }));

    this.register(addDisposableDomListener(el, 'touchstart', (ev: TouchEvent) => {
      if (this.mouseEvents) return;
      this.viewport.onTouchStart(ev);
      return this.cancel(ev);
    }));

    this.register(addDisposableDomListener(el, 'touchmove', (ev: TouchEvent) => {
      if (this.mouseEvents) return;
      this.viewport.onTouchMove(ev);
      return this.cancel(ev);
    }));
  }

  /**
   * Tells the renderer to refresh terminal content between two rows (inclusive) at the next
   * opportunity.
   * @param start The row to start from (between 0 and this.rows - 1).
   * @param end The row to end at (between start and this.rows - 1).
   */
  public refresh(start: number, end: number): void {
    if (this.renderer) {
      this.renderer.refreshRows(start, end);
    }
  }

  /**
   * Queues linkification for the specified rows.
   * @param start The row to start from (between 0 and this.rows - 1).
   * @param end The row to end at (between start and this.rows - 1).
   */
  private _queueLinkification(start: number, end: number): void {
    if (this.linkifier) {
      this.linkifier.linkifyRows(start, end);
    }
  }

  /**
   * Change the cursor style for different selection modes
   */
  public updateCursorStyle(ev: KeyboardEvent): void {
    if (this.selectionManager && this.selectionManager.shouldColumnSelect(ev)) {
      this.element.classList.add('column-select');
    } else {
      this.element.classList.remove('column-select');
    }
  }

  /**
   * Display the cursor element
   */
  public showCursor(): void {
    if (!this.cursorState) {
      this.cursorState = 1;
      this.refresh(this.buffer.y, this.buffer.y);
    }
  }

  /**
   * Scroll the terminal down 1 row, creating a blank line.
   * @param isWrapped Whether the new line is wrapped from the previous line.
   */
  public scroll(isWrapped: boolean = false): void {
    let newLine: IBufferLine;
    const useRecycling = this.options.experimentalBufferLineImpl !== 'JsArray';
    if (useRecycling) {
      newLine = this._blankLine;
      if (!newLine || newLine.length !== this.cols || newLine.get(0)[CHAR_DATA_ATTR_INDEX] !== this.eraseAttr()) {
        newLine = this.buffer.getBlankLine(this.eraseAttr(), isWrapped);
        this._blankLine = newLine;
      }
      newLine.isWrapped = isWrapped;
    } else {
      newLine = this.buffer.getBlankLine(this.eraseAttr(), isWrapped);
    }

    const topRow = this.buffer.ybase + this.buffer.scrollTop;
    const bottomRow = this.buffer.ybase + this.buffer.scrollBottom;

    if (this.buffer.scrollTop === 0) {
      // Determine whether the buffer is going to be trimmed after insertion.
      const willBufferBeTrimmed = this.buffer.lines.isFull;

      // Insert the line using the fastest method
      if (bottomRow === this.buffer.lines.length - 1) {
        if (useRecycling) {
          if (willBufferBeTrimmed) {
            this.buffer.lines.recycle().copyFrom(newLine);
          } else {
            this.buffer.lines.push(newLine.clone());
          }
        } else {
          this.buffer.lines.push(newLine);
        }
      } else {
        this.buffer.lines.splice(bottomRow + 1, 0, (useRecycling) ? newLine.clone() : newLine);
      }

      // Only adjust ybase and ydisp when the buffer is not trimmed
      if (!willBufferBeTrimmed) {
        this.buffer.ybase++;
        // Only scroll the ydisp with ybase if the user has not scrolled up
        if (!this._userScrolling) {
          this.buffer.ydisp++;
        }
      } else {
        // When the buffer is full and the user has scrolled up, keep the text
        // stable unless ydisp is right at the top
        if (this._userScrolling) {
          this.buffer.ydisp = Math.max(this.buffer.ydisp - 1, 0);
        }
      }
    } else {
      // scrollTop is non-zero which means no line will be going to the
      // scrollback, instead we can just shift them in-place.
      const scrollRegionHeight = bottomRow - topRow + 1/*as it's zero-based*/;
      this.buffer.lines.shiftElements(topRow + 1, scrollRegionHeight - 1, -1);
      this.buffer.lines.set(bottomRow, (useRecycling) ? newLine.clone() : newLine);
    }

    // Move the viewport to the bottom of the buffer unless the user is
    // scrolling.
    if (!this._userScrolling) {
      this.buffer.ydisp = this.buffer.ybase;
    }

    // Flag rows that need updating
    this.updateRange(this.buffer.scrollTop);
    this.updateRange(this.buffer.scrollBottom);

    /**
     * This event is emitted whenever the terminal is scrolled.
     * The one parameter passed is the new y display position.
     *
     * @event scroll
     */
    this.emit('scroll', this.buffer.ydisp);
  }

  /**
   * Scroll the display of the terminal
   * @param disp The number of lines to scroll down (negative scroll up).
   * @param suppressScrollEvent Don't emit the scroll event as scrollLines. This is used
   * to avoid unwanted events being handled by the viewport when the event was triggered from the
   * viewport originally.
   */
  public scrollLines(disp: number, suppressScrollEvent?: boolean): void {
    if (disp < 0) {
      if (this.buffer.ydisp === 0) {
        return;
      }
      this._userScrolling = true;
    } else if (disp + this.buffer.ydisp >= this.buffer.ybase) {
      this._userScrolling = false;
    }

    const oldYdisp = this.buffer.ydisp;
    this.buffer.ydisp = Math.max(Math.min(this.buffer.ydisp + disp, this.buffer.ybase), 0);

    // No change occurred, don't trigger scroll/refresh
    if (oldYdisp === this.buffer.ydisp) {
      return;
    }

    if (!suppressScrollEvent) {
      this.emit('scroll', this.buffer.ydisp);
    }

    this.refresh(0, this.rows - 1);
  }

  /**
   * Scroll the display of the terminal by a number of pages.
   * @param pageCount The number of pages to scroll (negative scrolls up).
   */
  public scrollPages(pageCount: number): void {
    this.scrollLines(pageCount * (this.rows - 1));
  }

  /**
   * Scrolls the display of the terminal to the top.
   */
  public scrollToTop(): void {
    this.scrollLines(-this.buffer.ydisp);
  }

  /**
   * Scrolls the display of the terminal to the bottom.
   */
  public scrollToBottom(): void {
    this.scrollLines(this.buffer.ybase - this.buffer.ydisp);
  }

  public scrollToLine(line: number): void {
    const scrollAmount = line - this.buffer.ydisp;
    if (scrollAmount !== 0) {
      this.scrollLines(scrollAmount);
    }
  }

  /**
   * Writes text to the terminal.
   * @param data The text to write to the terminal.
   */
  public write(data: string): void {
    // Ensure the terminal isn't disposed
    if (this._isDisposed) {
      return;
    }

    // Ignore falsy data values (including the empty string)
    if (!data) {
      return;
    }

    this.writeBuffer.push(data);

    // Send XOFF to pause the pty process if the write buffer becomes too large so
    // xterm.js can catch up before more data is sent. This is necessary in order
    // to keep signals such as ^C responsive.
    if (this.options.useFlowControl && !this._xoffSentToCatchUp && this.writeBuffer.length >= WRITE_BUFFER_PAUSE_THRESHOLD) {
      // XOFF - stop pty pipe
      // XON will be triggered by emulator before processing data chunk
      this.handler(C0.DC3);
      this._xoffSentToCatchUp = true;
    }

    if (!this._writeInProgress && this.writeBuffer.length > 0) {
      // Kick off a write which will write all data in sequence recursively
      this._writeInProgress = true;
      // Kick off an async innerWrite so more writes can come in while processing data
      setTimeout(() => {
        this._innerWrite();
      });
    }
  }

  protected _innerWrite(): void {
    // Ensure the terminal isn't disposed
    if (this._isDisposed) {
      this.writeBuffer = [];
    }

    const writeBatch = this.writeBuffer.splice(0, WRITE_BATCH_SIZE);
    while (writeBatch.length > 0) {
      const data = writeBatch.shift();

      // If XOFF was sent in order to catch up with the pty process, resume it if
      // the writeBuffer is empty to allow more data to come in.
      if (this._xoffSentToCatchUp && writeBatch.length === 0 && this.writeBuffer.length === 0) {
        this.handler(C0.DC1);
        this._xoffSentToCatchUp = false;
      }

      this._refreshStart = this.buffer.y;
      this._refreshEnd = this.buffer.y;

      // HACK: Set the parser state based on it's state at the time of return.
      // This works around the bug #662 which saw the parser state reset in the
      // middle of parsing escape sequence in two chunks. For some reason the
      // state of the parser resets to 0 after exiting parser.parse. This change
      // just sets the state back based on the correct return statement.

      this._inputHandler.parse(data);

      this.updateRange(this.buffer.y);
      this.refresh(this._refreshStart, this._refreshEnd);
    }
    if (this.writeBuffer.length > 0) {
      // Allow renderer to catch up before processing the next batch
      setTimeout(() => this._innerWrite(), 0);
    } else {
      this._writeInProgress = false;
    }
  }

  /**
   * Writes text to the terminal, followed by a break line character (\n).
   * @param data The text to write to the terminal.
   */
  public writeln(data: string): void {
    this.write(data + '\r\n');
  }

  /**
   * Attaches a custom key event handler which is run before keys are processed,
   * giving consumers of xterm.js ultimate control as to what keys should be
   * processed by the terminal and what keys should not.
   * @param customKeyEventHandler The custom KeyboardEvent handler to attach.
   * This is a function that takes a KeyboardEvent, allowing consumers to stop
   * propogation and/or prevent the default action. The function returns whether
   * the event should be processed by xterm.js.
   */
  public attachCustomKeyEventHandler(customKeyEventHandler: CustomKeyEventHandler): void {
    this._customKeyEventHandler = customKeyEventHandler;
  }

  /**
   * Registers a link matcher, allowing custom link patterns to be matched and
   * handled.
   * @param regex The regular expression to search for, specifically
   * this searches the textContent of the rows. You will want to use \s to match
   * a space ' ' character for example.
   * @param handler The callback when the link is called.
   * @param options Options for the link matcher.
   * @return The ID of the new matcher, this can be used to deregister.
   */
  public registerLinkMatcher(regex: RegExp, handler: LinkMatcherHandler, options?: ILinkMatcherOptions): number {
    const matcherId = this.linkifier.registerLinkMatcher(regex, handler, options);
    this.refresh(0, this.rows - 1);
    return matcherId;
  }

  /**
   * Deregisters a link matcher if it has been registered.
   * @param matcherId The link matcher's ID (returned after register)
   */
  public deregisterLinkMatcher(matcherId: number): void {
    if (this.linkifier.deregisterLinkMatcher(matcherId)) {
      this.refresh(0, this.rows - 1);
    }
  }

  public registerCharacterJoiner(handler: CharacterJoinerHandler): number {
    const joinerId = this.renderer.registerCharacterJoiner(handler);
    this.refresh(0, this.rows - 1);
    return joinerId;
  }

  public deregisterCharacterJoiner(joinerId: number): void {
    if (this.renderer.deregisterCharacterJoiner(joinerId)) {
      this.refresh(0, this.rows - 1);
    }
  }

  public get markers(): IMarker[] {
    return this.buffer.markers;
  }

  public addMarker(cursorYOffset: number): IMarker {
    // Disallow markers on the alt buffer
    if (this.buffer !== this.buffers.normal) {
      return;
    }

    return this.buffer.addMarker(this.buffer.ybase + this.buffer.y + cursorYOffset);
  }

  /**
   * Gets whether the terminal has an active selection.
   */
  public hasSelection(): boolean {
    return this.selectionManager ? this.selectionManager.hasSelection : false;
  }

  /**
   * Gets the terminal's current selection, this is useful for implementing copy
   * behavior outside of xterm.js.
   */
  public getSelection(): string {
    return this.selectionManager ? this.selectionManager.selectionText : '';
  }

  /**
   * Clears the current terminal selection.
   */
  public clearSelection(): void {
    if (this.selectionManager) {
      this.selectionManager.clearSelection();
    }
  }

  /**
   * Selects all text within the terminal.
   */
  public selectAll(): void {
    if (this.selectionManager) {
      this.selectionManager.selectAll();
    }
  }

  public selectLines(start: number, end: number): void {
    if (this.selectionManager) {
      this.selectionManager.selectLines(start, end);
    }
  }

  /**
   * Handle a keydown event
   * Key Resources:
   *   - https://developer.mozilla.org/en-US/docs/DOM/KeyboardEvent
   * @param ev The keydown event to be handled.
   */
  protected _keyDown(event: KeyboardEvent): boolean {
    if (this._customKeyEventHandler && this._customKeyEventHandler(event) === false) {
      return false;
    }

    if (!this._compositionHelper.keydown(event)) {
      if (this.buffer.ybase !== this.buffer.ydisp) {
        this.scrollToBottom();
      }
      return false;
    }

    const result = evaluateKeyboardEvent(event, this.applicationCursor, this.browser.isMac, this.options.macOptionIsMeta);

    this.updateCursorStyle(event);

    // if (result.key === C0.DC3) { // XOFF
    //   this._writeStopped = true;
    // } else if (result.key === C0.DC1) { // XON
    //   this._writeStopped = false;
    // }

    if (result.type === KeyboardResultType.PAGE_DOWN || result.type === KeyboardResultType.PAGE_UP) {
      const scrollCount = this.rows - 1;
      this.scrollLines(result.type === KeyboardResultType.PAGE_UP ? -scrollCount : scrollCount);
      return this.cancel(event, true);
    }

    if (result.type === KeyboardResultType.SELECT_ALL) {
      this.selectAll();
    }

    if (this._isThirdLevelShift(this.browser, event)) {
      return true;
    }

    if (result.cancel) {
      // The event is canceled at the end already, is this necessary?
      this.cancel(event, true);
    }

    if (!result.key) {
      return true;
    }

    this.emit('keydown', event);
    this.emit('key', result.key, event);
    this.showCursor();
    this.handler(result.key);

    return this.cancel(event, true);
  }

  private _isThirdLevelShift(browser: IBrowser, ev: IKeyboardEvent): boolean {
    const thirdLevelKey =
        (browser.isMac && !this.options.macOptionIsMeta && ev.altKey && !ev.ctrlKey && !ev.metaKey) ||
        (browser.isMSWindows && ev.altKey && ev.ctrlKey && !ev.metaKey);

    if (ev.type === 'keypress') {
      return thirdLevelKey;
    }

    // Don't invoke for arrows, pageDown, home, backspace, etc. (on non-keypress events)
    return thirdLevelKey && (!ev.keyCode || ev.keyCode > 47);
  }

  /**
   * Set the G level of the terminal
   * @param g
   */
  public setgLevel(g: number): void {
    this.glevel = g;
    this.charset = this.charsets[g];
  }

  /**
   * Set the charset for the given G level of the terminal
   * @param g
   * @param charset
   */
  public setgCharset(g: number, charset: ICharset): void {
    this.charsets[g] = charset;
    if (this.glevel === g) {
      this.charset = charset;
    }
  }

  protected _keyUp(ev: KeyboardEvent): void {
    this.updateCursorStyle(ev);
  }

  /**
   * Handle a keypress event.
   * Key Resources:
   *   - https://developer.mozilla.org/en-US/docs/DOM/KeyboardEvent
   * @param ev The keypress event to be handled.
   */
  protected _keyPress(ev: KeyboardEvent): boolean {
    let key;

    if (this._customKeyEventHandler && this._customKeyEventHandler(ev) === false) {
      return false;
    }

    this.cancel(ev);

    if (ev.charCode) {
      key = ev.charCode;
    } else if (ev.which === null || ev.which === undefined) {
      key = ev.keyCode;
    } else if (ev.which !== 0 && ev.charCode !== 0) {
      key = ev.which;
    } else {
      return false;
    }

    if (!key || (
      (ev.altKey || ev.ctrlKey || ev.metaKey) && !this._isThirdLevelShift(this.browser, ev)
    )) {
      return false;
    }

    key = String.fromCharCode(key);

    this.emit('keypress', key, ev);
    this.emit('key', key, ev);
    this.showCursor();
    this.handler(key);

    return true;
  }

  /**
   * Ring the bell.
   * Note: We could do sweet things with webaudio here
   */
  public bell(): void {
    this.emit('bell');
    if (this._soundBell()) {
      this.soundManager.playBellSound();
    }

    if (this._visualBell()) {
      this.element.classList.add('visual-bell-active');
      clearTimeout(this._visualBellTimer);
      this._visualBellTimer = window.setTimeout(() => {
        this.element.classList.remove('visual-bell-active');
      }, 200);
    }
  }

  /**
   * Log the current state to the console.
   */
  public log(text: string, data?: any): void {
    if (!this.options.debug) return;
    if (!this._context.console || !this._context.console.log) return;
    this._context.console.log(text, data);
  }

  /**
   * Log the current state as error to the console.
   */
  public error(text: string, data?: any): void {
    if (!this.options.debug) return;
    if (!this._context.console || !this._context.console.error) return;
    this._context.console.error(text, data);
  }

  /**
   * Resizes the terminal.
   *
   * @param x The number of columns to resize to.
   * @param y The number of rows to resize to.
   */
  public resize(x: number, y: number): void {
    if (isNaN(x) || isNaN(y)) {
      return;
    }

    if (x === this.cols && y === this.rows) {
      // Check if we still need to measure the char size (fixes #785).
      if (this.charMeasure && (!this.charMeasure.width || !this.charMeasure.height)) {
        this.charMeasure.measure(this.options);
      }
      return;
    }

    if (x < 1) x = 1;
    if (y < 1) y = 1;

    this.buffers.resize(x, y);

    this.cols = x;
    this.rows = y;
    this.buffers.setupTabStops(this.cols);

    if (this.charMeasure) {
      this.charMeasure.measure(this.options);
    }

    this.refresh(0, this.rows - 1);
    this.emit('resize', {cols: x, rows: y});
  }

  /**
   * Updates the range of rows to refresh
   * @param y The number of rows to refresh next.
   */
  public updateRange(y: number): void {
    if (y < this._refreshStart) this._refreshStart = y;
    if (y > this._refreshEnd) this._refreshEnd = y;
    // if (y > this.refreshEnd) {
    //   this.refreshEnd = y;
    //   if (y > this.rows - 1) {
    //     this.refreshEnd = this.rows - 1;
    //   }
    // }
  }

  /**
   * Set the range of refreshing to the maximum value
   */
  public maxRange(): void {
    this._refreshStart = 0;
    this._refreshEnd = this.rows - 1;
  }

  /**
   * Clear the entire buffer, making the prompt line the new first line.
   */
  public clear(): void {
    if (this.buffer.ybase === 0 && this.buffer.y === 0) {
      // Don't clear if it's already clear
      return;
    }
    this.buffer.lines.set(0, this.buffer.lines.get(this.buffer.ybase + this.buffer.y));
    this.buffer.lines.length = 1;
    this.buffer.ydisp = 0;
    this.buffer.ybase = 0;
    this.buffer.y = 0;
    for (let i = 1; i < this.rows; i++) {
      this.buffer.lines.push(this.buffer.getBlankLine(DEFAULT_ATTR));
    }
    this.refresh(0, this.rows - 1);
    this.emit('scroll', this.buffer.ydisp);
  }

  /**
   * If cur return the back color xterm feature attribute. Else return default attribute.
   * @param cur
   */
  public ch(cur?: boolean): CharData {
    if (cur) {
      return [this.eraseAttr(), NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
    }
    return [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE];
  }

  /**
   * Evaluate if the current terminal is the given argument.
   * @param term The terminal name to evaluate
   */
  public is(term: string): boolean {
    return (this.options.termName + '').indexOf(term) === 0;
  }

  /**
   * Emit the 'data' event and populate the given data.
   * @param data The data to populate in the event.
   */
  public handler(data: string): void {
    // Prevents all events to pty process if stdin is disabled
    if (this.options.disableStdin) {
      return;
    }

    // Clear the selection if the selection manager is available and has an active selection
    if (this.selectionManager && this.selectionManager.hasSelection) {
      this.selectionManager.clearSelection();
    }

    // Input is being sent to the terminal, the terminal should focus the prompt.
    if (this.buffer.ybase !== this.buffer.ydisp) {
      this.scrollToBottom();
    }
    this.emit('data', data);
  }

  /**
   * Emit the 'title' event and populate the given title.
   * @param title The title to populate in the event.
   */
  public handleTitle(title: string): void {
    /**
     * This event is emitted when the title of the terminal is changed
     * from inside the terminal. The parameter is the new title.
     *
     * @event title
     */
    this.emit('title', title);
  }

  /**
   * ESC
   */

  /**
   * ESC D Index (IND is 0x84).
   */
  public index(): void {
    this.buffer.y++;
    if (this.buffer.y > this.buffer.scrollBottom) {
      this.buffer.y--;
      this.scroll();
    }
    // If the end of the line is hit, prevent this action from wrapping around to the next line.
    if (this.buffer.x >= this.cols) {
      this.buffer.x--;
    }
  }

  /**
   * ESC M Reverse Index (RI is 0x8d).
   *
   * Move the cursor up one row, inserting a new blank line if necessary.
   */
  public reverseIndex(): void {
    if (this.buffer.y === this.buffer.scrollTop) {
      // possibly move the code below to term.reverseScroll();
      // test: echo -ne '\e[1;1H\e[44m\eM\e[0m'
      // blankLine(true) is xterm/linux behavior
      const scrollRegionHeight = this.buffer.scrollBottom - this.buffer.scrollTop;
      this.buffer.lines.shiftElements(this.buffer.y + this.buffer.ybase, scrollRegionHeight, 1);
      this.buffer.lines.set(this.buffer.y + this.buffer.ybase, this.buffer.getBlankLine(this.eraseAttr()));
      this.updateRange(this.buffer.scrollTop);
      this.updateRange(this.buffer.scrollBottom);
    } else {
      this.buffer.y--;
    }
  }

  /**
   * ESC c Full Reset (RIS).
   */
  public reset(): void {
    this.options.rows = this.rows;
    this.options.cols = this.cols;
    const customKeyEventHandler = this._customKeyEventHandler;
    const inputHandler = this._inputHandler;
    const cursorState = this.cursorState;
    this._setup();
    this._customKeyEventHandler = customKeyEventHandler;
    this._inputHandler = inputHandler;
    this.cursorState = cursorState;
    this.refresh(0, this.rows - 1);
    if (this.viewport) {
      this.viewport.syncScrollArea();
    }
  }


  /**
   * ESC H Tab Set (HTS is 0x88).
   */
  public tabSet(): void {
    this.buffer.tabs[this.buffer.x] = true;
  }

  // TODO: Remove cancel function and cancelEvents option
  public cancel(ev: Event, force?: boolean): boolean {
    if (!this.options.cancelEvents && !force) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    return false;
  }

  // TODO: Remove when true color is implemented
  public matchColor(r1: number, g1: number, b1: number): number {
    const hash = (r1 << 16) | (g1 << 8) | b1;

    if (matchColorCache[hash] !== null && matchColorCache[hash] !== undefined) {
      return matchColorCache[hash];
    }

    let ldiff = Infinity;
    let li = -1;
    let i = 0;
    let c: number;
    let r2: number;
    let g2: number;
    let b2: number;
    let diff: number;

    for (; i < DEFAULT_ANSI_COLORS.length; i++) {
      c = DEFAULT_ANSI_COLORS[i].rgba;
      r2 = c >>> 24;
      g2 = c >>> 16 & 0xFF;
      b2 = c >>> 8 & 0xFF;
      // assume that alpha is 0xFF

      diff = matchColorDistance(r1, g1, b1, r2, g2, b2);

      if (diff === 0) {
        li = i;
        break;
      }

      if (diff < ldiff) {
        ldiff = diff;
        li = i;
      }
    }

    return matchColorCache[hash] = li;
  }

  private _visualBell(): boolean {
    return false;
    // return this.options.bellStyle === 'visual' ||
    //     this.options.bellStyle === 'both';
  }

  private _soundBell(): boolean {
    return this.options.bellStyle === 'sound';
    // return this.options.bellStyle === 'sound' ||
    //     this.options.bellStyle === 'both';
  }
}

/**
 * Helpers
 */

function wasModifierKeyOnlyEvent(ev: KeyboardEvent): boolean {
  return ev.keyCode === 16 || // Shift
    ev.keyCode === 17 || // Ctrl
    ev.keyCode === 18; // Alt
}

/**
 * TODO:
 * The below color-related code can be removed when true color is implemented.
 * It's only purpose is to match true color requests with the closest matching
 * ANSI color code.
 */

const matchColorCache: {[colorRGBHash: number]: number} = {};

// http://stackoverflow.com/questions/1633828
function matchColorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.pow(30 * (r1 - r2), 2)
    + Math.pow(59 * (g1 - g2), 2)
    + Math.pow(11 * (b1 - b2), 2);
}
