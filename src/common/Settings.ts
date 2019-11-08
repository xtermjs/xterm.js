import { isMac } from './Platform';

/**
 * Some helpers for mapped types.
 */
// return partial type X satisfying type condition Y
type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;

// filter option vs. option(writeable/readonly) vs. collection type
type IsOption<T> = T extends IOption<any, boolean> ? T : never;
type IsWriteable<T> = T extends IOption<any, true> ? never: T;
type IsReadonly<T> = T extends IOption<any, true> ? T: never;
type IsCollection<T> = T extends IOption<any, boolean> ? never : T;

// writeable option keys from collection
type GetWriteableOptionKeys<T extends IOptionCollection> = {
  [P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { [Q in P]: IsWriteable<IsOption<T[P]>> }, P>
}[keyof T];

// readonly option keys from collection
type GetReadonlyOptionKeys<T extends IOptionCollection> = {
  [P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { [Q in P]: IsReadonly<IsOption<T[P]>> }, P>
}[keyof T];

// collection keys from collection
type GetCollectionKeys<T extends IOptionCollection> = {
  [P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { [Q in P]: IsCollection<T[P]> }, P>
}[keyof T];

// prettify intersection type
type Prettify<T> = T extends object ? {[K in keyof T]: T[K]} : T;

// add index
type AddIndex<T, U> = T & {[key: string]: U};


/**
 * IOption is limited to these primitive types.
 */
type AllowedOptionTypes = string | number | boolean;

/**
 * Base type for any settings option.
 * Used to create an option entry in an IOptionCollection.
 */
interface IOption<T extends AllowedOptionTypes, U extends boolean = false> {
  /** default value after initialization */
  init: T;
  /** whether this option is readonly during runtime */
  readonly: U;
  /** TODO: get/set */
  getter?: () => T;
  setter?: (v: T) => void;
  /** filter function to be applied when retrieving an option from settings */
  fromSettings?: (v: T) => T;
  /** filter function to be applied when setting an option in settings */
  toSettings?: (v: T) => T;
}

/**
 * Collection type for IOptions.
 * Used to create a settings definition that are turned into a settings object
 * by a later `settingsFactory` call.
 * For proper type inference always extend option collections from this interface.
 * The collection may not contain other entries than IOption<T, U> or other
 * IOptionCollection as sub groups.
 */
interface IOptionCollection { }
type IndexedOptionCollection<T extends IOptionCollection> = AddIndex<T, IOption<AllowedOptionTypes, boolean> | IOptionCollection>;


/**
 * InitialOptions<T>
 * Contains all options as writeable/optional to allow partial initialization
 * with custom values.
 */
type InitialOptions<T> = T extends IOption<infer O, boolean> ? O
  : T extends IOptionCollection ? { [K in keyof T]?: InitialOptions<T[K]> }
  : never;

/**
 * ISettings<T> - interface of the settings object
 * Contains all options including readonly properties.
 * Used as read interface of `Settings`.
 */
type ISettings<T> = T extends IOption<infer O, boolean> ? O
  : T extends IOptionCollection ?
    Prettify<{ readonly [K in keyof Pick<T, GetReadonlyOptionKeys<T>>]: ISettings<T[K]>; }
     & { -readonly [K in keyof Pick<T, GetCollectionKeys<T> | GetWriteableOptionKeys<T>>]: ISettings<T[K]>; }
     & ISettingsBase<T>>
  : never;

/**
 * WriteableOptions<T>
 * Contains all writeable options as optional to allow partial assignments during runtime.
 * Used as write interface of `Settings`.
 */
type WriteableOptions<T> = T extends IOption<infer O, boolean> ? O
: T extends IOptionCollection ? {
    -readonly [K in keyof Pick<T, GetCollectionKeys<T> | GetWriteableOptionKeys<T>>]?: WriteableOptions<T[K]>;
  }
: never;

interface ISettingsBase<T extends IOptionCollection> {
  asWriteable: WriteableOptions<T>;
  resetToDefault(): void;
  resetToInitial(): void;
  definition: IndexedOptionCollection<T>;
  initial: AddIndex<InitialOptions<T>, number | string | boolean | object>;
}

/**
 * Settings class
 *
 * Class for maintaining global settings.
 * Note: Do not use the ctor directly, instead use `createSettings`
 * for correct type inference.
 *
 * Characteristics:
 * - recursive for nested IOptionCollections
 * - stable, will never change identity
 * - mutability only on IOption level
 * - read interface by default
 * - write interface with `asWriteable`
 *
 * TODO:
 * - shim for old style access with getOption / setOption
 * - customizable getter / setter / toSettings / fromSettings
 */


class Settings<T extends IOptionCollection, K extends keyof T> {
  [key: string]: Settings<T[K], keyof T[K]> | number | string | boolean | object;
  public definition: IndexedOptionCollection<T>;
  public initial: AddIndex<InitialOptions<T>, number | string | boolean | object>;

  constructor(definition: T, initials?: InitialOptions<T>) {
    this.definition = definition as IndexedOptionCollection<T>;
    Object.defineProperty(this, 'definition', {enumerable: false});
    this.initial = initials as AddIndex<InitialOptions<T>, number | string | boolean | object>;
    Object.defineProperty(this, 'initial', {enumerable: false});
    for (const optionName in definition) {
      const option = this.definition[optionName];
      if (option.hasOwnProperty('init')) {
        // IOption
        const op = option as IOption<AllowedOptionTypes, boolean>;
        const v = this.initial && this.initial[optionName] !== undefined ? this.initial[optionName] : op.init;
        Object.defineProperty(this, optionName, {
          value: v,
          writable: !op.readonly,
          enumerable: true
        });
      } else {
        // IOptionCollection
        const op = option as any;
        const subSettings: Settings<T[K], keyof T[K]> = new Settings(op, this.initial ? this.initial[optionName] : undefined);
        Object.defineProperty(this, optionName, {
          enumerable: true,
          get(): Settings<T[K], keyof T[K]> {
            return subSettings;
          },
          set(values: WriteableOptions<T[K]>): void {
            const v = values as AddIndex<WriteableOptions<T[K]>, number | string | boolean | object>;
            for (const optionName in v) {
              // guard: only allow assignment of known values
              if (subSettings.hasOwnProperty(optionName)) {
                subSettings[optionName] = v[optionName];
              }
            }
          }
        });
      }
    }
  }
  // writeable options (setter only)
  set asWriteable(values: WriteableOptions<T>) {
    const v = values as AddIndex<WriteableOptions<T>, number | string | boolean | object>;
    for (const optionName in v) {
      // guard: only allow assignment of known values
      if (this.hasOwnProperty(optionName)) {
        this[optionName] = v[optionName];
      }
    }
  }
  public resetToDefault(): void {
    for (const optionName in this.definition) {
      const option = this.definition[optionName];
      if (option.hasOwnProperty('init')) {
        const op = option as IOption<any, boolean>;
        if (!op.readonly) {
          this[optionName] = op.init;
        }
      } else {
        (this[optionName] as Settings<T[K], keyof T[K]>).resetToDefault();
      }
    }
  }
  public resetToInitial(): void {
    for (const optionName in this.definition) {
      const option = this.definition[optionName];
      if (option.hasOwnProperty('init')) {
        const op = option as IOption<any, boolean>;
        if (!op.readonly) {
          this[optionName] = this.initial && this.initial[optionName] !== undefined ? this.initial[optionName] : op.init;
        }
      } else {
        (this[optionName] as Settings<T[K], keyof T[K]>).resetToInitial();
      }
    }
  }
}

/**
 * Create a settings object from a definition and optional initial values.
 * Use this factory function to ensure correct type inference.
 *
 * @param definition option definitions
 * @param initial initial values
 */
function createSettings<T extends IOptionCollection>(definition: T, initial?: InitialOptions<T>): ISettings<T> {
  return new Settings(definition, initial) as ISettings<T>;
}

/**
 * Test examples.
 */

// example settings interfaces
// NOTE: Always extend collections from IOptionCollection
interface ITerminalOptionsTest extends IOptionCollection {
  /** This should appear as help text for T.cols on all derived types T */
  cols: IOption<number, true>;
  rows: IOption<number>;
  parser: IParserOptions;
}

interface IParserOptions extends IOptionCollection {
  x: IOption<boolean>;
  y: IOption<'red' | 'green' | 'blue', true>;
  windowOptions: IWindowOptions;
}

interface IWindowOptions extends IOptionCollection {
  resizeWin: IOption<boolean>;
}

// initial definitions with defaults
// can be defined all in once
const ALL_IN_ONCE: ITerminalOptionsTest = {
  cols: {init: 1, readonly: true},
  rows: {init: 1, readonly: false},
  parser: {
      x: {init: true, readonly: false},
      y: {init: 'blue', readonly: true},
      windowOptions: {
          resizeWin: {init: true, readonly: false}
        }
  }
};


// or spread across separate definitions
const W_DEFAULT: IWindowOptions = {
  resizeWin: {init: false, readonly: false}
};

const P_DEFAULT: IParserOptions = {
  x: {init: true, readonly: false},
  y: {init: 'green', readonly: true},
  windowOptions: W_DEFAULT
};

// and joined later on
const T_DEFAULT: ITerminalOptionsTest = {
  cols: {init: 80, readonly: true},
  rows: {init: 25, readonly: false},
  parser: P_DEFAULT
};


// some settings shall be changed on init
// Note: all values are correctly inferred from the definition above
const customizedInitialValues: InitialOptions<ITerminalOptionsTest> = {
  cols: 10,
  rows: 10,
  parser: {
    x: false,
    y: 'red',
    windowOptions: {
      resizeWin: false
    }
  }
};


declare const console: any;


const settings = createSettings(ALL_IN_ONCE, customizedInitialValues);
console.log(settings);
settings.rows = 6;
// readonly properties cannot be assigned later on
// ss.cols = 7;

// identity check
const savedWindowOptions = settings.parser.windowOptions;
console.log(settings.parser, settings.parser.windowOptions);

// partial re-assignments through write interface
settings.parser.asWriteable = {x: true, windowOptions: {resizeWin: false}};
console.log(settings.parser, settings.parser.windowOptions);

// write interface cannot be read
console.log('read writeable:', settings.asWriteable);

// should always be true
console.log(savedWindowOptions === settings.parser.windowOptions);

// reset tests
console.log(JSON.stringify(settings));
settings.resetToDefault();
console.log(JSON.stringify(settings));
settings.resetToInitial();
console.log(JSON.stringify(settings));



interface ITerminalOptions extends IOptionCollection {
  /**
   * Whether background should support non-opaque color. It must be set before
   * executing the `Terminal.open()` method and can't be changed later without
   * executing it again. Note that enabling this can negatively impact
   * performance.
   */
  allowTransparency: IOption<boolean, false>;

  /**
   * A data uri of the sound to use for the bell when `bellStyle = 'sound'`.
   */
  bellSound: IOption<string, false>;

  /**
   * The type of the bell notification the terminal will use.
   */
  bellStyle: IOption<'none' | 'sound', false>;

  /**
   * When enabled the cursor will be set to the beginning of the next line
   * with every new line. This equivalent to sending '\r\n' for each '\n'.
   * Normally the termios settings of the underlying PTY deals with the
   * translation of '\n' to '\r\n' and this setting should not be used. If you
   * deal with data from a non-PTY related source, this settings might be
   * useful.
   */
  convertEol: IOption<boolean, false>;

  /**
   * The number of columns in the terminal.
   */
  cols: IOption<number, true>;

  /**
   * Whether the cursor blinks.
   */
  cursorBlink: IOption<boolean, false>;

  /**
   * The style of the cursor.
   */
  cursorStyle: IOption<'block' | 'underline' | 'bar', false>;

  /**
   * Whether input should be disabled.
   */
  disableStdin: IOption<boolean, false>;

  /**
   * Whether to draw bold text in bright colors. The default is true.
   */
  drawBoldTextInBrightColors: IOption<boolean, false>;

  /**
   * The modifier key hold to multiply scroll speed.
   */
  fastScrollModifier: IOption<'alt' | 'ctrl' | 'shift', false>;

  /**
   * The scroll speed multiplier used for fast scrolling.
   */
  fastScrollSensitivity: IOption<number, false>;

  /**
   * The font size used to render text.
   */
  fontSize: IOption<number, false>;

  /**
   * The font family used to render text.
   */
  fontFamily: IOption<string, false>;

  /**
   * The font weight used to render non-bold text.
   */
  fontWeight: IOption<'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900', false>;

  /**
   * The font weight used to render bold text.
   */
  fontWeightBold: IOption<'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900', false>;

  /**
   * The spacing in whole pixels between characters..
   */
  letterSpacing: IOption<number, false>;

  /**
   * The line height used to render text.
   */
  lineHeight: IOption<number, false>;

  /**
   * What log level to use, this will log for all levels below and including
   * what is set:
   *
   * 1. debug
   * 2. info (default)
   * 3. warn
   * 4. error
   * 5. off
   */
  logLevel: IOption<'debug' | 'info' | 'warn' | 'error' | 'off', false>;

  /**
   * Whether to treat option as the meta key.
   */
  macOptionIsMeta: IOption<boolean, false>;

  /**
   * Whether holding a modifier key will force normal selection behavior,
   * regardless of whether the terminal is in mouse events mode. This will
   * also prevent mouse events from being emitted by the terminal. For
   * example, this allows you to use xterm.js' regular selection inside tmux
   * with mouse mode enabled.
   */
  macOptionClickForcesSelection: IOption<boolean, false>;

  /**
   * The type of renderer to use, this allows using the fallback DOM renderer
   * when canvas is too slow for the environment. The following features do
   * not work when the DOM renderer is used:
   *
   * - Letter spacing
   * - Cursor blink
   */
  rendererType: IOption<'canvas' | 'dom', false>;

  /**
   * Whether to select the word under the cursor on right click, this is
   * standard behavior in a lot of macOS applications.
   */
  rightClickSelectsWord: IOption<boolean, false>;

  /**
   * The number of rows in the terminal.
   */
  rows: IOption<number, true>;

  /**
   * Whether screen reader support is enabled. When on this will expose
   * supporting elements in the DOM to support NVDA on Windows and VoiceOver
   * on macOS.
   */
  screenReaderMode: IOption<boolean, false>;

  /**
   * The amount of scrollback in the terminal. Scrollback is the amount of
   * rows that are retained when lines are scrolled beyond the initial
   * viewport.
   */
  scrollback: IOption<number, false>;

  /**
   * The scrolling speed multiplier used for adjusting normal scrolling speed.
   */
  scrollSensitivity: IOption<number, false>;

  /**
   * The size of tab stops in the terminal.
   */
  tabStopWidth: IOption<number, false>;

  /**
   * The color theme of the terminal.
   */
  theme: IThemeOptions;

  /**
   * Whether "Windows mode" is enabled. Because Windows backends winpty and
   * conpty operate by doing line wrapping on their side, xterm.js does not
   * have access to wrapped lines. When Windows mode is enabled the following
   * changes will be in effect:
   *
   * - Reflow is disabled.
   * - Lines are assumed to be wrapped if the last character of the line is
   *   not whitespace.
   */
  windowsMode: IOption<boolean, false>;

  /**
   * A string containing all characters that are considered word separated by the
   * double click to select work logic.
  */
  wordSeparator: IOption<string, false>;
}

interface IThemeOptions extends IOptionCollection {
  /** The default foreground color */
  foreground: IOption<string, false>;
  /** The default background color */
  background: IOption<string, false>;
  /** The cursor color */
  cursor: IOption<string, false>;
  /** The accent color of the cursor (fg color for a block cursor) */
  cursorAccent: IOption<string, false>;
  /** The selection background color (can be transparent) */
  selection: IOption<string, false>;
  /** ANSI black (eg. `\x1b[30m`) */
  black: IOption<string, false>;
  /** ANSI red (eg. `\x1b[31m`) */
  red: IOption<string, false>;
  /** ANSI green (eg. `\x1b[32m`) */
  green: IOption<string, false>;
  /** ANSI yellow (eg. `\x1b[33m`) */
  yellow: IOption<string, false>;
  /** ANSI blue (eg. `\x1b[34m`) */
  blue: IOption<string, false>;
  /** ANSI magenta (eg. `\x1b[35m`) */
  magenta: IOption<string, false>;
  /** ANSI cyan (eg. `\x1b[36m`) */
  cyan: IOption<string, false>;
  /** ANSI white (eg. `\x1b[37m`) */
  white: IOption<string, false>;
  /** ANSI bright black (eg. `\x1b[1;30m`) */
  brightBlack: IOption<string, false>;
  /** ANSI bright red (eg. `\x1b[1;31m`) */
  brightRed: IOption<string, false>;
  /** ANSI bright green (eg. `\x1b[1;32m`) */
  brightGreen: IOption<string, false>;
  /** ANSI bright yellow (eg. `\x1b[1;33m`) */
  brightYellow: IOption<string, false>;
  /** ANSI bright blue (eg. `\x1b[1;34m`) */
  brightBlue: IOption<string, false>;
  /** ANSI bright magenta (eg. `\x1b[1;35m`) */
  brightMagenta: IOption<string, false>;
  /** ANSI bright cyan (eg. `\x1b[1;36m`) */
  brightCyan: IOption<string, false>;
  /** ANSI bright white (eg. `\x1b[1;37m`) */
  brightWhite: IOption<string, false>;
}

// FIXME: use real default colors from ColorManager here
const DEFAULT_THEME_SETTINGS: IThemeOptions = {
  foreground: {init: '#ffffff', readonly: false},
  background: {init: '#000000', readonly: false},
  cursor: {init: '#ffffff', readonly: false},
  cursorAccent: {init: '#000000', readonly: false},
  selection: {init: 'rgba(255, 255, 255, 0.3)', readonly: false},
  black: {init: '#2e3436', readonly: false},
  red: {init: '#cc0000', readonly: false},
  green: {init: '#4e9a06', readonly: false},
  yellow: {init: '#c4a000', readonly: false},
  blue: {init: '#3465a4', readonly: false},
  magenta: {init: '#75507b', readonly: false},
  cyan: {init: '#06989a', readonly: false},
  white: {init: '#d3d7cf', readonly: false},
  brightBlack: {init: '#555753', readonly: false},
  brightRed: {init: '#ef2929', readonly: false},
  brightGreen: {init: '#8ae234', readonly: false},
  brightYellow: {init: '#fce94f', readonly: false},
  brightBlue: {init: '#729fcf', readonly: false},
  brightMagenta: {init: '#ad7fa8', readonly: false},
  brightCyan: {init: '#34e2e2', readonly: false},
  brightWhite: {init: '#eeeeec', readonly: false}
};

const DEFAULT_OPTIONS: ITerminalOptions = {
  allowTransparency: {init: false, readonly: false},
  bellSound: {init: '', readonly: false},
  bellStyle: {init: 'none', readonly: false},
  convertEol: {init: false, readonly: false},
  cols: {init: 80, readonly: true},
  cursorBlink: {init: false, readonly: false},
  cursorStyle: {init: 'block', readonly: false},
  disableStdin: {init: false, readonly: false},
  drawBoldTextInBrightColors: {init: true, readonly: false},
  fastScrollModifier: {init: 'alt', readonly: false},
  fastScrollSensitivity: {init: 5, readonly: false},
  fontFamily: {init: 'courier-new, courier, monospace', readonly: false},
  fontSize: {init: 15, readonly: false},
  fontWeight: {init: 'normal', readonly: false},
  fontWeightBold: {init: 'bold', readonly: false},
  letterSpacing: {init: 0, readonly: false},
  lineHeight: {init: 1.0, readonly: false},
  logLevel: {init: 'info', readonly: false},
  macOptionClickForcesSelection: {init: false, readonly: false},
  macOptionIsMeta: {init: false, readonly: false},
  rendererType: {init: 'canvas', readonly: false},
  rightClickSelectsWord: {init: isMac, readonly: false},
  rows: {init: 24, readonly: true},
  screenReaderMode: {init: false, readonly: false},
  scrollSensitivity: {init: 1, readonly: false},
  scrollback: {init: 1000, readonly: false},
  tabStopWidth: {init: 8, readonly: false},
  theme: DEFAULT_THEME_SETTINGS,
  windowsMode: {init: false, readonly: false},
  wordSeparator: {init: ' ()[]{}\',:;"', readonly: false}
};


/*
FIXME: leftover from OptionService - what to do about these?
export const DEFAULT_OPTIONS: ITerminalOptions = Object.freeze({
  termName: 'xterm',
  screenKeys: false,
  cancelEvents: false,
  useFlowControl: false,
});
*/

const termSettings = createSettings(DEFAULT_OPTIONS);
console.log(termSettings);
console.log(termSettings.theme);
