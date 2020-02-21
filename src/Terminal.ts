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

import { IInputHandlingTerminal, ICompositionHelper, ITerminalOptions, ITerminal, IBrowser, CustomKeyEventHandler } from './Types';
import { IRenderer, CharacterJoinerHandler } from 'browser/renderer/Types';
import { CompositionHelper } from 'browser/input/CompositionHelper';
import { Viewport } from 'browser/Viewport';
import { rightClickHandler, moveTextAreaUnderMouseCursor, handlePasteEvent, copyHandler, paste } from 'browser/Clipboard';
import { C0 } from 'common/data/EscapeSequences';
import { InputHandler } from './InputHandler';
import { Renderer } from 'browser/renderer/Renderer';
import { Linkifier } from 'browser/Linkifier';
import { SelectionService } from 'browser/services/SelectionService';
import * as Browser from 'common/Platform';
import { addDisposableDomListener } from 'browser/Lifecycle';
import * as Strings from 'browser/LocalizableStrings';
import { SoundService } from 'browser/services/SoundService';
import { MouseZoneManager } from 'browser/MouseZoneManager';
import { AccessibilityManager } from './AccessibilityManager';
import { ITheme, IMarker, IDisposable, ISelectionPosition } from 'xterm';
import { DomRenderer } from 'browser/renderer/dom/DomRenderer';
import { IKeyboardEvent, KeyboardResultType, IBufferLine, IAttributeData, CoreMouseEventType, CoreMouseButton, CoreMouseAction } from 'common/Types';
import { evaluateKeyboardEvent } from 'common/input/Keyboard';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { updateWindowsModeWrappedState } from 'common/WindowsMode';
import { ColorManager } from 'browser/ColorManager';
import { RenderService } from 'browser/services/RenderService';
import { IOptionsService, IBufferService, ICoreMouseService, ICoreService, ILogService, IDirtyRowService, IInstantiationService, ICharsetService, IUnicodeService } from 'common/services/Services';
import { OptionsService } from 'common/services/OptionsService';
import { ICharSizeService, IRenderService, IMouseService, ISelectionService, ISoundService, ICoreBrowserService } from 'browser/services/Services';
import { CharSizeService } from 'browser/services/CharSizeService';
import { BufferService, MINIMUM_COLS, MINIMUM_ROWS } from 'common/services/BufferService';
import { Disposable } from 'common/Lifecycle';
import { IBufferSet, IBuffer } from 'common/buffer/Types';
import { MouseService } from 'browser/services/MouseService';
import { IParams, IFunctionIdentifier } from 'common/parser/Types';
import { CoreService } from 'common/services/CoreService';
import { LogService } from 'common/services/LogService';
import { ILinkifier, IMouseZoneManager, LinkMatcherHandler, ILinkMatcherOptions, IViewport } from 'browser/Types';
import { DirtyRowService } from 'common/services/DirtyRowService';
import { InstantiationService } from 'common/services/InstantiationService';
import { CoreMouseService } from 'common/services/CoreMouseService';
import { WriteBuffer } from 'common/input/WriteBuffer';
import { CoreBrowserService } from 'browser/services/CoreBrowserService';
import { UnicodeService } from 'common/services/UnicodeService';
import { CharsetService } from 'common/services/CharsetService';

// Let it work inside Node.js for automated testing purposes.
const document = (typeof window !== 'undefined') ? window.document : null;


export class Terminal extends Disposable implements ITerminal, IDisposable, IInputHandlingTerminal {
  public textarea: HTMLTextAreaElement;
  public element: HTMLElement;
  public screenElement: HTMLElement;

  private _document: Document;
  private _viewportScrollArea: HTMLElement;
  private _viewportElement: HTMLElement;
  private _helperContainer: HTMLElement;
  private _compositionView: HTMLElement;

  private _visualBellTimer: number;

  public browser: IBrowser = <any>Browser;

  // TODO: We should remove options once components adopt optionsService
  public get options(): ITerminalOptions { return this.optionsService.options; }

  private _customKeyEventHandler: CustomKeyEventHandler;

  // common services
  private _bufferService: IBufferService;
  private _coreService: ICoreService;
  private _charsetService: ICharsetService;
  private _coreMouseService: ICoreMouseService;
  private _dirtyRowService: IDirtyRowService;
  private _instantiationService: IInstantiationService;
  private _logService: ILogService;
  public optionsService: IOptionsService;
  public unicodeService: IUnicodeService;

  // browser services
  private _charSizeService: ICharSizeService;
  private _mouseService: IMouseService;
  private _renderService: IRenderService;
  private _selectionService: ISelectionService;
  private _soundService: ISoundService;

  // modes
  public insertMode: boolean;
  public bracketedPasteMode: boolean;

  // mouse properties
  public mouseEvents: CoreMouseEventType = CoreMouseEventType.NONE;
  public sendFocus: boolean;

  // write buffer
  private _writeBuffer: WriteBuffer;

  // Store if user went browsing history in scrollback
  private _userScrolling: boolean;

  /**
   * Records whether the keydown event has already been handled and triggered a data event, if so
   * the keypress event should not trigger a data event but should still print to the textarea so
   * screen readers will announce it.
   */
  private _keyDownHandled: boolean = false;

  private _inputHandler: InputHandler;
  public linkifier: ILinkifier;
  public viewport: IViewport;
  private _compositionHelper: ICompositionHelper;
  private _mouseZoneManager: IMouseZoneManager;
  private _accessibilityManager: AccessibilityManager;
  private _colorManager: ColorManager;
  private _theme: ITheme;
  private _windowsMode: IDisposable | undefined;

  // bufferline to clone/copy from for new blank lines
  private _blankLine: IBufferLine = null;

  public get cols(): number { return this._bufferService.cols; }
  public get rows(): number { return this._bufferService.rows; }

  private _onCursorMove = new EventEmitter<void>();
  public get onCursorMove(): IEvent<void> { return this._onCursorMove.event; }
  private _onData = new EventEmitter<string>();
  public get onData(): IEvent<string> { return this._onData.event; }
  private _onBinary = new EventEmitter<string>();
  public get onBinary(): IEvent<string> { return this._onBinary.event; }
  private _onKey = new EventEmitter<{ key: string, domEvent: KeyboardEvent }>();
  public get onKey(): IEvent<{ key: string, domEvent: KeyboardEvent }> { return this._onKey.event; }
  private _onLineFeed = new EventEmitter<void>();
  public get onLineFeed(): IEvent<void> { return this._onLineFeed.event; }
  private _onRender = new EventEmitter<{ start: number, end: number }>();
  public get onRender(): IEvent<{ start: number, end: number }> { return this._onRender.event; }
  private _onResize = new EventEmitter<{ cols: number, rows: number }>();
  public get onResize(): IEvent<{ cols: number, rows: number }> { return this._onResize.event; }
  private _onScroll = new EventEmitter<number>();
  public get onScroll(): IEvent<number> { return this._onScroll.event; }
  private _onSelectionChange = new EventEmitter<void>();
  public get onSelectionChange(): IEvent<void> { return this._onSelectionChange.event; }
  private _onTitleChange = new EventEmitter<string>();
  public get onTitleChange(): IEvent<string> { return this._onTitleChange.event; }

  private _onFocus = new EventEmitter<void>();
  public get onFocus(): IEvent<void> { return this._onFocus.event; }
  private _onBlur = new EventEmitter<void>();
  public get onBlur(): IEvent<void> { return this._onBlur.event; }
  public onA11yCharEmitter = new EventEmitter<string>();
  public get onA11yChar(): IEvent<string> { return this.onA11yCharEmitter.event; }
  public onA11yTabEmitter = new EventEmitter<number>();
  public get onA11yTab(): IEvent<number> { return this.onA11yTabEmitter.event; }

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

    // Setup and initialize common services
    this._instantiationService = new InstantiationService();
    this.optionsService = new OptionsService(options);
    this._instantiationService.setService(IOptionsService, this.optionsService);
    this._bufferService = this._instantiationService.createInstance(BufferService);
    this._instantiationService.setService(IBufferService, this._bufferService);
    this._logService = this._instantiationService.createInstance(LogService);
    this._instantiationService.setService(ILogService, this._logService);
    this._coreService = this._instantiationService.createInstance(CoreService, () => this.scrollToBottom());
    this._instantiationService.setService(ICoreService, this._coreService);
    this._coreService.onData(e => this._onData.fire(e));
    this._coreService.onBinary(e => this._onBinary.fire(e));
    this._coreMouseService = this._instantiationService.createInstance(CoreMouseService);
    this._instantiationService.setService(ICoreMouseService, this._coreMouseService);
    this._dirtyRowService = this._instantiationService.createInstance(DirtyRowService);
    this._instantiationService.setService(IDirtyRowService, this._dirtyRowService);
    this.unicodeService = this._instantiationService.createInstance(UnicodeService);
    this._instantiationService.setService(IUnicodeService, this.unicodeService);
    this._charsetService = this._instantiationService.createInstance(CharsetService);
    this._instantiationService.setService(ICharsetService, this._charsetService);

    this._setupOptionsListeners();
    this._setup();

    this._writeBuffer = new WriteBuffer(data => this._inputHandler.parse(data));
  }

  public dispose(): void {
    if (this._isDisposed) {
      return;
    }
    super.dispose();
    this._windowsMode?.dispose();
    this._windowsMode = undefined;
    this._renderService?.dispose();
    this._customKeyEventHandler = null;
    this.write = () => {};
    this.element?.parentNode?.removeChild(this.element);
  }

  private _setup(): void {
    this._customKeyEventHandler = null;

    // modes
    this.insertMode = false;
    this.bracketedPasteMode = false;

    this._userScrolling = false;

    if (this._inputHandler) {
      this._inputHandler.reset();
    } else {
      // Register input handler and refire/handle events
      this._inputHandler = new InputHandler(this, this._bufferService, this._charsetService, this._coreService, this._dirtyRowService, this._logService, this.optionsService, this._coreMouseService, this.unicodeService, this._instantiationService);
      this._inputHandler.onRequestBell(() => this.bell());
      this._inputHandler.onRequestRefreshRows((start, end) => this.refresh(start, end));
      this._inputHandler.onRequestReset(() => this.reset());
      this._inputHandler.onCursorMove(() => this._onCursorMove.fire());
      this._inputHandler.onLineFeed(() => this._onLineFeed.fire());
      this.register(this._inputHandler);
    }

    if (!this.linkifier) {
      this.linkifier = new Linkifier(this._bufferService, this._logService, this.optionsService, this.unicodeService);
    }

    if (this.options.windowsMode) {
      this._enableWindowsMode();
    }
  }

  private _enableWindowsMode(): void {
    if (!this._windowsMode) {
      const disposables: IDisposable[] = [];
      disposables.push(this.onLineFeed(updateWindowsModeWrappedState.bind(null, this._bufferService)));
      disposables.push(this.addCsiHandler({ final: 'H' }, () => {
        updateWindowsModeWrappedState(this._bufferService);
        return false;
      }));
      this._windowsMode = {
        dispose: () => {
          disposables.forEach(d => d.dispose());
        }
      };
    }
  }

  /**
   * Convenience property to active buffer.
   */
  public get buffer(): IBuffer {
    return this.buffers.active;
  }

  public get buffers(): IBufferSet {
    return this._bufferService.buffers;
  }

  /**
   * Focus the terminal. Delegates focus handling to the terminal's DOM element.
   */
  public focus(): void {
    if (this.textarea) {
      this.textarea.focus({ preventScroll: true });
    }
  }

  private _setupOptionsListeners(): void {
    // TODO: These listeners should be owned by individual components
    this.optionsService.onOptionChange(key => {
      switch (key) {
        case 'fontFamily':
        case 'fontSize':
          // When the font changes the size of the cells may change which requires a renderer clear
          this._renderService?.clear();
          this._charSizeService?.measure();
          break;
        case 'cursorBlink':
        case 'cursorStyle':
          // The DOM renderer needs a row refresh to update the cursor styles
          this.refresh(this.buffer.y, this.buffer.y);
          break;
        case 'drawBoldTextInBrightColors':
        case 'letterSpacing':
        case 'lineHeight':
        case 'fontWeight':
        case 'fontWeightBold':
        case 'minimumContrastRatio':
          // When the font changes the size of the cells may change which requires a renderer clear
          if (this._renderService) {
            this._renderService.clear();
            this._renderService.onResize(this.cols, this.rows);
            this.refresh(0, this.rows - 1);
          }
          break;
        case 'rendererType':
          if (this._renderService) {
            this._renderService.setRenderer(this._createRenderer());
            this._renderService.onResize(this.cols, this.rows);
          }
          break;
        case 'scrollback':
          this.buffers.resize(this.cols, this.rows);
          this.viewport?.syncScrollArea();
          break;
        case 'screenReaderMode':
          if (this.optionsService.options.screenReaderMode) {
            if (!this._accessibilityManager && this._renderService) {
              this._accessibilityManager = new AccessibilityManager(this, this._renderService);
            }
          } else {
            this._accessibilityManager?.dispose();
            this._accessibilityManager = null;
          }
          break;
        case 'tabStopWidth': this.buffers.setupTabStops(); break;
        case 'theme':
          this._setTheme(this.optionsService.options.theme);
          break;
        case 'windowsMode':
          if (this.optionsService.options.windowsMode) {
            this._enableWindowsMode();
          } else {
            this._windowsMode?.dispose();
            this._windowsMode = undefined;
          }
          break;
      }
    });
  }

  /**
   * Binds the desired focus behavior on a given terminal object.
   */
  private _onTextAreaFocus(ev: KeyboardEvent): void {
    if (this.sendFocus) {
      this._coreService.triggerDataEvent(C0.ESC + '[I');
    }
    this.updateCursorStyle(ev);
    this.element.classList.add('focus');
    this.showCursor();
    this._onFocus.fire();
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
      this._coreService.triggerDataEvent(C0.ESC + '[O');
    }
    this.element.classList.remove('focus');
    this._onBlur.fire();
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
      copyHandler(event, this._selectionService);
    }));
    const pasteHandlerWrapper = (event: ClipboardEvent) => handlePasteEvent(event, this.textarea, this.bracketedPasteMode, this._coreService);
    this.register(addDisposableDomListener(this.textarea, 'paste', pasteHandlerWrapper));
    this.register(addDisposableDomListener(this.element, 'paste', pasteHandlerWrapper));

    // Handle right click context menus
    if (Browser.isFirefox) {
      // Firefox doesn't appear to fire the contextmenu event on right click
      this.register(addDisposableDomListener(this.element, 'mousedown', (event: MouseEvent) => {
        if (event.button === 2) {
          rightClickHandler(event, this.textarea, this.screenElement, this._selectionService, this.options.rightClickSelectsWord);
        }
      }));
    } else {
      this.register(addDisposableDomListener(this.element, 'contextmenu', (event: MouseEvent) => {
        rightClickHandler(event, this.textarea, this.screenElement, this._selectionService, this.options.rightClickSelectsWord);
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
          moveTextAreaUnderMouseCursor(event, this.textarea, this.screenElement);
        }
      }));
    }
  }

  /**
   * Apply key handling to the terminal
   */
  private _bindKeys(): void {
    this.register(addDisposableDomListener(this.textarea, 'keyup', (ev: KeyboardEvent) => this._keyUp(ev), true));
    this.register(addDisposableDomListener(this.textarea, 'keydown', (ev: KeyboardEvent) => this._keyDown(ev), true));
    this.register(addDisposableDomListener(this.textarea, 'keypress', (ev: KeyboardEvent) => this._keyPress(ev), true));
    this.register(addDisposableDomListener(this.textarea, 'compositionstart', () => this._compositionHelper.compositionstart()));
    this.register(addDisposableDomListener(this.textarea, 'compositionupdate', (e: CompositionEvent) => this._compositionHelper.compositionupdate(e)));
    this.register(addDisposableDomListener(this.textarea, 'compositionend', () => this._compositionHelper.compositionend()));
    this.register(this.onRender(() => this._compositionHelper.updateCompositionElements()));
    this.register(this.onRender(e => this._queueLinkification(e.start, e.end)));
  }

  /**
   * Opens the terminal within an element.
   *
   * @param parent The element to create the terminal within.
   */
  public open(parent: HTMLElement): void {
    if (!parent) {
      throw new Error('Terminal requires a parent element.');
    }

    if (!document.body.contains(parent)) {
      this._logService.warn('Terminal.open was called on an element that was not attached to the DOM');
    }

    this._document = parent.ownerDocument;

    // Create main element container
    this.element = this._document.createElement('div');
    this.element.dir = 'ltr';   // xterm.css assumes LTR
    this.element.classList.add('terminal');
    this.element.classList.add('xterm');
    this.element.setAttribute('tabindex', '0');
    parent.appendChild(this.element);

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

    this.textarea = document.createElement('textarea');
    this.textarea.classList.add('xterm-helper-textarea');
    this.textarea.setAttribute('aria-label', Strings.promptLabel);
    this.textarea.setAttribute('aria-multiline', 'false');
    this.textarea.setAttribute('autocorrect', 'off');
    this.textarea.setAttribute('autocapitalize', 'off');
    this.textarea.setAttribute('spellcheck', 'false');
    this.textarea.tabIndex = 0;
    this.register(addDisposableDomListener(this.textarea, 'focus', (ev: KeyboardEvent) => this._onTextAreaFocus(ev)));
    this.register(addDisposableDomListener(this.textarea, 'blur', () => this._onTextAreaBlur()));
    this._helperContainer.appendChild(this.textarea);

    const coreBrowserService = this._instantiationService.createInstance(CoreBrowserService, this.textarea);
    this._instantiationService.setService(ICoreBrowserService, coreBrowserService);

    this._charSizeService = this._instantiationService.createInstance(CharSizeService, this._document, this._helperContainer);
    this._instantiationService.setService(ICharSizeService, this._charSizeService);

    this._compositionView = document.createElement('div');
    this._compositionView.classList.add('composition-view');
    this._compositionHelper = this._instantiationService.createInstance(CompositionHelper, this.textarea, this._compositionView);
    this._helperContainer.appendChild(this._compositionView);

    // Performance: Add viewport and helper elements from the fragment
    this.element.appendChild(fragment);

    this._theme = this.options.theme || this._theme;
    this.options.theme = undefined;
    this._colorManager = new ColorManager(document, this.options.allowTransparency);
    this.optionsService.onOptionChange(e => this._colorManager.onOptionsChange(e));
    this._colorManager.setTheme(this._theme);

    const renderer = this._createRenderer();
    this._renderService = this._instantiationService.createInstance(RenderService, renderer, this.rows, this.screenElement);
    this._instantiationService.setService(IRenderService, this._renderService);
    this._renderService.onRender(e => this._onRender.fire(e));
    this.onResize(e => this._renderService.resize(e.cols, e.rows));

    this._soundService = this._instantiationService.createInstance(SoundService);
    this._instantiationService.setService(ISoundService, this._soundService);
    this._mouseService = this._instantiationService.createInstance(MouseService);
    this._instantiationService.setService(IMouseService, this._mouseService);

    this.viewport = this._instantiationService.createInstance(Viewport,
      (amount: number, suppressEvent: boolean) => this.scrollLines(amount, suppressEvent),
      this._viewportElement,
      this._viewportScrollArea
    );
    this.viewport.onThemeChange(this._colorManager.colors);
    this.register(this.viewport);

    this.register(this.onCursorMove(() => this._renderService.onCursorMove()));
    this.register(this.onResize(() => this._renderService.onResize(this.cols, this.rows)));
    this.register(this.onBlur(() => this._renderService.onBlur()));
    this.register(this.onFocus(() => this._renderService.onFocus()));
    this.register(this._renderService.onDimensionsChange(() => this.viewport.syncScrollArea()));

    this._selectionService = this._instantiationService.createInstance(SelectionService,
      (amount: number, suppressEvent: boolean) => this.scrollLines(amount, suppressEvent),
      this.element,
      this.screenElement);
    this._instantiationService.setService(ISelectionService, this._selectionService);
    this.register(this._selectionService.onSelectionChange(() => this._onSelectionChange.fire()));
    this.register(this._selectionService.onRedrawRequest(e => this._renderService.onSelectionChanged(e.start, e.end, e.columnSelectMode)));
    this.register(this._selectionService.onLinuxMouseSelection(text => {
      // If there's a new selection, put it into the textarea, focus and select it
      // in order to register it as a selection on the OS. This event is fired
      // only on Linux to enable middle click to paste selection.
      this.textarea.value = text;
      this.textarea.focus();
      this.textarea.select();
    }));
    this.register(this.onScroll(() => {
      this.viewport.syncScrollArea();
      this._selectionService.refresh();
    }));
    this.register(addDisposableDomListener(this._viewportElement, 'scroll', () => this._selectionService.refresh()));

    this._mouseZoneManager = this._instantiationService.createInstance(MouseZoneManager, this.element, this.screenElement);
    this.register(this._mouseZoneManager);
    this.register(this.onScroll(() => this._mouseZoneManager.clearAll()));
    this.linkifier.attachToDom(this.element, this._mouseZoneManager);

    // This event listener must be registered aftre MouseZoneManager is created
    this.register(addDisposableDomListener(this.element, 'mousedown', (e: MouseEvent) => this._selectionService.onMouseDown(e)));

    // apply mouse event classes set by escape codes before terminal was attached
    if (this.mouseEvents) {
      this._selectionService.disable();
      this.element.classList.add('enable-mouse-events');
    } else {
      this._selectionService.enable();
    }

    if (this.options.screenReaderMode) {
      // Note that this must be done *after* the renderer is created in order to
      // ensure the correct order of the dprchange event
      this._accessibilityManager = new AccessibilityManager(this, this._renderService);
    }

    // Measure the character size
    this._charSizeService.measure();

    // Setup loop that draws to screen
    this.refresh(0, this.rows - 1);

    // Initialize global actions that need to be taken on the document.
    this._initGlobal();

    // Listen for mouse events and translate
    // them into terminal mouse protocols.
    this.bindMouse();
  }

  private _createRenderer(): IRenderer {
    switch (this.options.rendererType) {
      case 'canvas': return this._instantiationService.createInstance(Renderer, this._colorManager.colors, this.screenElement, this.linkifier);
      case 'dom': return this._instantiationService.createInstance(DomRenderer, this._colorManager.colors, this.element, this.screenElement, this._viewportElement, this.linkifier);
      default: throw new Error(`Unrecognized rendererType "${this.options.rendererType}"`);
    }
  }

  /**
   * Sets the theme on the renderer. The renderer must have been initialized.
   * @param theme The theme to set.
   */
  private _setTheme(theme: ITheme): void {
    this._theme = theme;
    this._colorManager?.setTheme(theme);
    this._renderService?.setColors(this._colorManager.colors);
    this.viewport?.onThemeChange(this._colorManager.colors);
  }

  /**
   * Bind certain mouse events to the terminal.
   * By default only 3 button + wheel up/down is ativated. For higher buttons
   * no mouse report will be created. Typically the standard actions will be active.
   *
   * There are several reasons not to enable support for higher buttons/wheel:
   * - Button 4 and 5 are typically used for history back and forward navigation,
   *   there is no straight forward way to supress/intercept those standard actions.
   * - Support for higher buttons does not work in some platform/browser combinations.
   * - Left/right wheel was not tested.
   * - Emulators vary in mouse button support, typically only 3 buttons and
   *   wheel up/down work reliable.
   *
   * TODO: Move mouse event code into its own file.
   */
  public bindMouse(): void {
    const self = this;
    const el = this.element;

    // send event to CoreMouseService
    function sendEvent(ev: MouseEvent | WheelEvent): boolean {
      let pos;

      // get mouse coordinates
      pos = self._mouseService.getRawByteCoords(ev, self.screenElement, self.cols, self.rows);
      if (!pos) {
        return false;
      }

      let but: CoreMouseButton;
      let action: CoreMouseAction;
      switch ((<any>ev).overrideType || ev.type) {
        case 'mousemove':
          action = CoreMouseAction.MOVE;
          if (ev.buttons === undefined) {
            // buttons is not supported on macOS, try to get a value from button instead
            but = CoreMouseButton.NONE;
            if (ev.button !== undefined) {
              but = ev.button < 3 ? ev.button : CoreMouseButton.NONE;
            }
          } else {
            // according to MDN buttons only reports up to button 5 (AUX2)
            but = ev.buttons & 1 ? CoreMouseButton.LEFT :
                  ev.buttons & 4 ? CoreMouseButton.MIDDLE :
                  ev.buttons & 2 ? CoreMouseButton.RIGHT :
                  CoreMouseButton.NONE; // fallback to NONE
          }
          break;
        case 'mouseup':
          action = CoreMouseAction.UP;
          but = ev.button < 3 ? ev.button : CoreMouseButton.NONE;
          break;
        case 'mousedown':
          action = CoreMouseAction.DOWN;
          but = ev.button < 3 ? ev.button : CoreMouseButton.NONE;
          break;
        case 'wheel':
          // only UP/DOWN wheel events are respected
          if ((ev as WheelEvent).deltaY !== 0) {
            action = (ev as WheelEvent).deltaY < 0 ? CoreMouseAction.UP : CoreMouseAction.DOWN;
          }
          but = CoreMouseButton.WHEEL;
          break;
        default:
          // dont handle other event types by accident
          return false;
      }

      // exit if we cannot determine valid button/action values
      // do nothing for higher buttons than wheel
      if (action === undefined || but === undefined || but > CoreMouseButton.WHEEL) {
        return false;
      }

      return self._coreMouseService.triggerMouseEvent({
        col: pos.x - 33, // FIXME: why -33 here?
        row: pos.y - 33,
        button: but,
        action,
        ctrl: ev.ctrlKey,
        alt: ev.altKey,
        shift: ev.shiftKey
      });
    }

    /**
     * Event listener state handling.
     * We listen to the onProtocolChange event of CoreMouseService and put
     * requested listeners in `requestedEvents`. With this the listeners
     * have all bits to do the event listener juggling.
     * Note: 'mousedown' currently is "always on" and not managed
     * by onProtocolChange.
     */
    const requestedEvents: {[key: string]: ((ev: Event) => void) | null} = {
      mouseup: null,
      wheel: null,
      mousedrag: null,
      mousemove: null
    };
    const eventListeners: {[key: string]: (ev: Event) => void} = {
      mouseup: (ev: MouseEvent) => {
        sendEvent(ev);
        if (!ev.buttons) {
          // if no other button is held remove global handlers
          this._document.removeEventListener('mouseup', requestedEvents.mouseup);
          if (requestedEvents.mousedrag) {
            this._document.removeEventListener('mousemove', requestedEvents.mousedrag);
          }
        }
        return this.cancel(ev);
      },
      wheel: (ev: WheelEvent) => {
        sendEvent(ev);
        ev.preventDefault();
        return this.cancel(ev);
      },
      mousedrag: (ev: MouseEvent) => {
        // deal only with move while a button is held
        if (ev.buttons) {
          sendEvent(ev);
        }
      },
      mousemove: (ev: MouseEvent) => {
        // deal only with move without any button
        if (!ev.buttons) {
          sendEvent(ev);
        }
      }
    };
    this._coreMouseService.onProtocolChange(events => {
      // apply global changes on events
      this.mouseEvents = events;
      if (events) {
        if (this.optionsService.options.logLevel === 'debug') {
          this._logService.debug('Binding to mouse events:', this._coreMouseService.explainEvents(events));
        }
        this.element.classList.add('enable-mouse-events');
        this._selectionService.disable();
      } else {
        this._logService.debug('Unbinding from mouse events.');
        this.element.classList.remove('enable-mouse-events');
        this._selectionService.enable();
      }

      // add/remove handlers from requestedEvents

      if (!(events & CoreMouseEventType.MOVE)) {
        el.removeEventListener('mousemove', requestedEvents.mousemove);
        requestedEvents.mousemove = null;
      } else if (!requestedEvents.mousemove) {
        el.addEventListener('mousemove', eventListeners.mousemove);
        requestedEvents.mousemove = eventListeners.mousemove;
      }

      if (!(events & CoreMouseEventType.WHEEL)) {
        el.removeEventListener('wheel', requestedEvents.wheel);
        requestedEvents.wheel = null;
      } else if (!requestedEvents.wheel) {
        el.addEventListener('wheel', eventListeners.wheel);
        requestedEvents.wheel = eventListeners.wheel;
      }

      if (!(events & CoreMouseEventType.UP)) {
        this._document.removeEventListener('mouseup', requestedEvents.mouseup);
        requestedEvents.mouseup = null;
      } else if (!requestedEvents.mouseup) {
        requestedEvents.mouseup = eventListeners.mouseup;
      }

      if (!(events & CoreMouseEventType.DRAG)) {
        this._document.removeEventListener('mousemove', requestedEvents.mousedrag);
        requestedEvents.mousedrag = null;
      } else if (!requestedEvents.mousedrag) {
        requestedEvents.mousedrag = eventListeners.mousedrag;
      }
    });
    // force initial onProtocolChange so we dont miss early mouse requests
    this._coreMouseService.activeProtocol = this._coreMouseService.activeProtocol;

    /**
     * "Always on" event listeners.
     */
    this.register(addDisposableDomListener(el, 'mousedown', (ev: MouseEvent) => {
      ev.preventDefault();
      this.focus();

      // Don't send the mouse button to the pty if mouse events are disabled or
      // if the selection manager is having selection forced (ie. a modifier is
      // held).
      if (!this.mouseEvents || this._selectionService.shouldForceSelection(ev)) {
        return;
      }

      sendEvent(ev);

      // Register additional global handlers which should keep reporting outside
      // of the terminal element.
      // Note: Other emulators also do this for 'mousedown' while a button
      // is held, we currently limit 'mousedown' to the terminal only.
      if (requestedEvents.mouseup) {
        this._document.addEventListener('mouseup', requestedEvents.mouseup);
      }
      if (requestedEvents.mousedrag) {
        this._document.addEventListener('mousemove', requestedEvents.mousedrag);
      }

      return this.cancel(ev);
    }));

    this.register(addDisposableDomListener(el, 'wheel', (ev: WheelEvent) => {
      if (!requestedEvents.wheel) {
        // Convert wheel events into up/down events when the buffer does not have scrollback, this
        // enables scrolling in apps hosted in the alt buffer such as vim or tmux.
        if (!this.buffer.hasScrollback) {
          const amount = this.viewport.getLinesScrolled(ev);

          // Do nothing if there's no vertical scroll
          if (amount === 0) {
            return;
          }

          // Construct and send sequences
          const sequence = C0.ESC + (this._coreService.decPrivateModes.applicationCursorKeys ? 'O' : '[') + ( ev.deltaY < 0 ? 'A' : 'B');
          let data = '';
          for (let i = 0; i < Math.abs(amount); i++) {
            data += sequence;
          }
          this._coreService.triggerDataEvent(data, true);
        }
        return;
      }
    }));

    // allow wheel scrolling in
    // the shell for example
    this.register(addDisposableDomListener(el, 'wheel', (ev: WheelEvent) => {
      if (requestedEvents.wheel) return;
      if (!this.viewport.onWheel(ev)) {
        return this.cancel(ev);
      }
    }));

    this.register(addDisposableDomListener(el, 'touchstart', (ev: TouchEvent) => {
      if (this.mouseEvents) return;
      this.viewport.onTouchStart(ev);
      return this.cancel(ev);
    }));

    this.register(addDisposableDomListener(el, 'touchmove', (ev: TouchEvent) => {
      if (this.mouseEvents) return;
      if (!this.viewport.onTouchMove(ev)) {
        return this.cancel(ev);
      }
    }));
  }


  /**
   * Tells the renderer to refresh terminal content between two rows (inclusive) at the next
   * opportunity.
   * @param start The row to start from (between 0 and this.rows - 1).
   * @param end The row to end at (between start and this.rows - 1).
   */
  public refresh(start: number, end: number): void {
    this._renderService?.refreshRows(start, end);
  }

  /**
   * Queues linkification for the specified rows.
   * @param start The row to start from (between 0 and this.rows - 1).
   * @param end The row to end at (between start and this.rows - 1).
   */
  private _queueLinkification(start: number, end: number): void {
    this.linkifier?.linkifyRows(start, end);
  }

  /**
   * Change the cursor style for different selection modes
   */
  public updateCursorStyle(ev: KeyboardEvent): void {
    if (this._selectionService && this._selectionService.shouldColumnSelect(ev)) {
      this.element.classList.add('column-select');
    } else {
      this.element.classList.remove('column-select');
    }
  }

  /**
   * Display the cursor element
   */
  public showCursor(): void {
    if (!this._coreService.isCursorInitialized) {
      this._coreService.isCursorInitialized = true;
      this.refresh(this.buffer.y, this.buffer.y);
    }
  }

  /**
   * Scroll the terminal down 1 row, creating a blank line.
   * @param isWrapped Whether the new line is wrapped from the previous line.
   */
  public scroll(eraseAttr: IAttributeData, isWrapped: boolean = false): void {
    let newLine: IBufferLine;
    newLine = this._blankLine;
    if (!newLine || newLine.length !== this.cols || newLine.getFg(0) !== eraseAttr.fg || newLine.getBg(0) !== eraseAttr.bg) {
      newLine = this.buffer.getBlankLine(eraseAttr, isWrapped);
      this._blankLine = newLine;
    }
    newLine.isWrapped = isWrapped;

    const topRow = this.buffer.ybase + this.buffer.scrollTop;
    const bottomRow = this.buffer.ybase + this.buffer.scrollBottom;

    if (this.buffer.scrollTop === 0) {
      // Determine whether the buffer is going to be trimmed after insertion.
      const willBufferBeTrimmed = this.buffer.lines.isFull;

      // Insert the line using the fastest method
      if (bottomRow === this.buffer.lines.length - 1) {
        if (willBufferBeTrimmed) {
          this.buffer.lines.recycle().copyFrom(newLine);
        } else {
          this.buffer.lines.push(newLine.clone());
        }
      } else {
        this.buffer.lines.splice(bottomRow + 1, 0, newLine.clone());
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
      this.buffer.lines.set(bottomRow, newLine.clone());
    }

    // Move the viewport to the bottom of the buffer unless the user is
    // scrolling.
    if (!this._userScrolling) {
      this.buffer.ydisp = this.buffer.ybase;
    }

    // Flag rows that need updating
    this._dirtyRowService.markRangeDirty(this.buffer.scrollTop, this.buffer.scrollBottom);

    this._onScroll.fire(this.buffer.ydisp);
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
      this._onScroll.fire(this.buffer.ydisp);
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

  public paste(data: string): void {
    paste(data, this.textarea, this.bracketedPasteMode, this._coreService);
  }

  /**
   * Attaches a custom key event handler which is run before keys are processed,
   * giving consumers of xterm.js ultimate control as to what keys should be
   * processed by the terminal and what keys should not.
   * @param customKeyEventHandler The custom KeyboardEvent handler to attach.
   * This is a function that takes a KeyboardEvent, allowing consumers to stop
   * propagation and/or prevent the default action. The function returns whether
   * the event should be processed by xterm.js.
   */
  public attachCustomKeyEventHandler(customKeyEventHandler: CustomKeyEventHandler): void {
    this._customKeyEventHandler = customKeyEventHandler;
  }

  /** Add handler for ESC escape sequence. See xterm.d.ts for details. */
  public addEscHandler(id: IFunctionIdentifier, callback: () => boolean): IDisposable {
    return this._inputHandler.addEscHandler(id, callback);
  }

  /** Add handler for DCS escape sequence. See xterm.d.ts for details. */
  public addDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean): IDisposable {
    return this._inputHandler.addDcsHandler(id, callback);
  }

  /** Add handler for CSI escape sequence. See xterm.d.ts for details. */
  public addCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean): IDisposable {
    return this._inputHandler.addCsiHandler(id, callback);
  }
  /** Add handler for OSC escape sequence. See xterm.d.ts for details. */
  public addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable {
    return this._inputHandler.addOscHandler(ident, callback);
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
    const joinerId = this._renderService.registerCharacterJoiner(handler);
    this.refresh(0, this.rows - 1);
    return joinerId;
  }

  public deregisterCharacterJoiner(joinerId: number): void {
    if (this._renderService.deregisterCharacterJoiner(joinerId)) {
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
    return this._selectionService ? this._selectionService.hasSelection : false;
  }

  /**
   * Selects text within the terminal.
   * @param column The column the selection starts at..
   * @param row The row the selection starts at.
   * @param length The length of the selection.
   */
  public select(column: number, row: number, length: number): void {
    this._selectionService.setSelection(column, row, length);
  }

  /**
   * Gets the terminal's current selection, this is useful for implementing copy
   * behavior outside of xterm.js.
   */
  public getSelection(): string {
    return this._selectionService ? this._selectionService.selectionText : '';
  }

  public getSelectionPosition(): ISelectionPosition | undefined {
    if (!this._selectionService.hasSelection) {
      return undefined;
    }

    return {
      startColumn: this._selectionService.selectionStart[0],
      startRow: this._selectionService.selectionStart[1],
      endColumn: this._selectionService.selectionEnd[0],
      endRow: this._selectionService.selectionEnd[1]
    };
  }

  /**
   * Clears the current terminal selection.
   */
  public clearSelection(): void {
    this._selectionService?.clearSelection();
  }

  /**
   * Selects all text within the terminal.
   */
  public selectAll(): void {
    this._selectionService?.selectAll();
  }

  public selectLines(start: number, end: number): void {
    this._selectionService?.selectLines(start, end);
  }

  /**
   * Handle a keydown event
   * Key Resources:
   *   - https://developer.mozilla.org/en-US/docs/DOM/KeyboardEvent
   * @param ev The keydown event to be handled.
   */
  protected _keyDown(event: KeyboardEvent): boolean {
    this._keyDownHandled = false;

    if (this._customKeyEventHandler && this._customKeyEventHandler(event) === false) {
      return false;
    }

    if (!this._compositionHelper.keydown(event)) {
      if (this.buffer.ybase !== this.buffer.ydisp) {
        this.scrollToBottom();
      }
      return false;
    }

    const result = evaluateKeyboardEvent(event, this._coreService.decPrivateModes.applicationCursorKeys, this.browser.isMac, this.options.macOptionIsMeta);

    this.updateCursorStyle(event);

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

    // If ctrl+c or enter is being sent, clear out the textarea. This is done so that screen readers
    // will announce deleted characters. This will not work 100% of the time but it should cover
    // most scenarios.
    if (result.key === C0.ETX || result.key === C0.CR) {
      this.textarea.value = '';
    }

    this._onKey.fire({ key: result.key, domEvent: event });
    this.showCursor();
    this._coreService.triggerDataEvent(result.key, true);

    // Cancel events when not in screen reader mode so events don't get bubbled up and handled by
    // other listeners. When screen reader mode is enabled, this could cause issues if the event
    // is handled at a higher level, this is a compromise in order to echo keys to the screen
    // reader.
    if (!this.optionsService.options.screenReaderMode) {
      return this.cancel(event, true);
    }

    this._keyDownHandled = true;
  }

  private _isThirdLevelShift(browser: IBrowser, ev: IKeyboardEvent): boolean {
    const thirdLevelKey =
        (browser.isMac && !this.options.macOptionIsMeta && ev.altKey && !ev.ctrlKey && !ev.metaKey) ||
        (browser.isWindows && ev.altKey && ev.ctrlKey && !ev.metaKey);

    if (ev.type === 'keypress') {
      return thirdLevelKey;
    }

    // Don't invoke for arrows, pageDown, home, backspace, etc. (on non-keypress events)
    return thirdLevelKey && (!ev.keyCode || ev.keyCode > 47);
  }

  protected _keyUp(ev: KeyboardEvent): void {
    if (this._customKeyEventHandler && this._customKeyEventHandler(ev) === false) {
      return;
    }

    if (!wasModifierKeyOnlyEvent(ev)) {
      this.focus();
    }

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

    if (this._keyDownHandled) {
      return false;
    }

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

    this._onKey.fire({ key, domEvent: ev });
    this.showCursor();
    this._coreService.triggerDataEvent(key, true);

    return true;
  }

  /**
   * Ring the bell.
   * Note: We could do sweet things with webaudio here
   */
  public bell(): void {
    if (this._soundBell()) {
      this._soundService.playBellSound();
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
      if (this._charSizeService && !this._charSizeService.hasValidSize) {
        this._charSizeService.measure();
      }
      return;
    }

    if (x < MINIMUM_COLS) x = MINIMUM_COLS;
    if (y < MINIMUM_ROWS) y = MINIMUM_ROWS;

    this.buffers.resize(x, y);

    this._bufferService.resize(x, y);
    this.buffers.setupTabStops(this.cols);

    this._charSizeService?.measure();

    // Sync the scroll area to make sure scroll events don't fire and scroll the viewport to an
    // invalid location
    this.viewport?.syncScrollArea(true);

    this.refresh(0, this.rows - 1);
    this._onResize.fire({ cols: x, rows: y });
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
      this.buffer.lines.push(this.buffer.getBlankLine(DEFAULT_ATTR_DATA));
    }
    this.refresh(0, this.rows - 1);
    this._onScroll.fire(this.buffer.ydisp);
  }

  /**
   * Evaluate if the current terminal is the given argument.
   * @param term The terminal name to evaluate
   */
  public is(term: string): boolean {
    return (this.options.termName + '').indexOf(term) === 0;
  }

  /**
   * Emit the data event and populate the given data.
   * @param data The data to populate in the event.
   */
  // public handler(data: string): void {
  //   // Prevents all events to pty process if stdin is disabled
  //   if (this.options.disableStdin) {
  //     return;
  //   }

  //   // Clear the selection if the selection manager is available and has an active selection
  //   if (this.selectionService && this.selectionService.hasSelection) {
  //     this.selectionService.clearSelection();
  //   }

  //   // Input is being sent to the terminal, the terminal should focus the prompt.
  //   if (this.buffer.ybase !== this.buffer.ydisp) {
  //     this.scrollToBottom();
  //   }
  //   this._onData.fire(data);
  // }

  /**
   * Emit the 'title' event and populate the given title.
   * @param title The title to populate in the event.
   */
  public handleTitle(title: string): void {
    this._onTitleChange.fire(title);
  }

  /**
   * Reset terminal.
   * Note: Calling this directly from JS is synchronous but does not clear
   * input buffers and does not reset the parser, thus the terminal will
   * continue to apply pending input data.
   * If you need in band reset (synchronous with input data) consider
   * using DECSTR (soft reset, CSI ! p) or RIS instead (hard reset, ESC c).
   */
  public reset(): void {
    /**
     * Since _setup handles a full terminal creation, we have to carry forward
     * a few things that should not reset.
     */
    this.options.rows = this.rows;
    this.options.cols = this.cols;
    const customKeyEventHandler = this._customKeyEventHandler;
    const userScrolling = this._userScrolling;

    this._setup();
    this._bufferService.reset();
    this._charsetService.reset();
    this._coreService.reset();
    this._coreMouseService.reset();
    this._selectionService?.reset();

    // reattach
    this._customKeyEventHandler = customKeyEventHandler;
    this._userScrolling = userScrolling;

    // do a full screen refresh
    this.refresh(0, this.rows - 1);
    this.viewport?.syncScrollArea();
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

  public write(data: string | Uint8Array, callback?: () => void): void {
    this._writeBuffer.write(data, callback);
  }

  public writeSync(data: string | Uint8Array): void {
    this._writeBuffer.writeSync(data);
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
