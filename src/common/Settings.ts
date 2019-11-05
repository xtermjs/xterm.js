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

  constructor(definition: T, initials?: InitialOptions<T>) {
    const def = definition as IndexedOptionCollection<T>;
    for (const optionName in definition) {
      const option = def[optionName];
      const init = initials as AddIndex<InitialOptions<T>, number | string | boolean | object>;
      if (option.hasOwnProperty('init')) {
        // IOption
        const op = option as IOption<AllowedOptionTypes, boolean>;
        const v = init && init[optionName] !== undefined ? init[optionName] : op.init;
        Object.defineProperty(this, optionName, {
          value: v,
          writable: !op.readonly,
          enumerable: true
        });
      } else {
        // IOptionCollection
        const op = option as any;
        const subSettings: Settings<T[K], keyof T[K]> = new Settings(op, init ? init[optionName] : undefined);
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
interface ITerminalOptions extends IOptionCollection {
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
const ALL_IN_ONCE: ITerminalOptions = {
  cols: {init: 80, readonly: true},
  rows: {init: 25, readonly: false},
  parser: {
      x: {init: true, readonly: false},
      y: {init: 'red', readonly: true},
      windowOptions: {
          resizeWin: {init: false, readonly: false}
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
const T_DEFAULT: ITerminalOptions = {
  cols: {init: 80, readonly: true},
  rows: {init: 25, readonly: false},
  parser: P_DEFAULT
};


// some settings shall be changed on init
// Note: all values are correctly inferred from the definition above
const customizedInitialValues: InitialOptions<ITerminalOptions> = {
  cols: 12,
  rows: 88,
  parser: {
    x: false,
    y: 'blue',
    windowOptions: {
      resizeWin: true
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
