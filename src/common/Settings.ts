/**
 * Base type for any settings option.
 * Only meant for primitive types T = string | number | boolean.
 * 
 * TODO: make this actually useful with a good abstraction for different option needs
 */
interface IOption<T> {
  init: T;
  // whether this option is directly writeable (always false if getter/setter is defined)
  writeable?: boolean;
  // optional getter/setter of this value
  // needs some clever mapping in Settings which internal cheap access later on
  getter?: () => T;
  setter?: (v: T) => void;
}

// dummy needed to separate type from generic object type
// NOTE: This must not contain an index declaration or DeepRealisation will fail.
interface IOptionCollection { }

/**
 * Create a realisation type from an IOptionCollection with these characteristics:
 *    - properties are casted: IOption<T> ==> T
 *    - all properties are made optional
 *    - unknown properties are rejected
 * 
 * This type is useful to create a settings object which contains only
 * certain properties for setting overwrites.
 */
type DeepRealisation<T> = T extends IOption<number> ? number
  : T extends IOption<boolean> ? boolean
  : T extends IOption<string> ? string
  : T extends IOptionCollection ? { [K in keyof T]?: DeepRealisation<T[K]> } : never;


/**
 * Test examples.
 */

// interfaces - always derive option collections from IOptionCollection
interface ITerminalOptions extends IOptionCollection {
  cols: IOption<number>;
  rows: IOption<number>;
  parser: IParserOptions;
}

interface IParserOptions extends IOptionCollection {
  x: IOption<boolean>;
  y: IOption<string>;
  windowOptions: IWindowOptions;
}

interface IWindowOptions extends IOptionCollection {
  resizeWin: IOption<boolean>;
}

// initial definitions with defaults
// can be defined all in once
const ALL_IN_ONCE: ITerminalOptions = {
  cols: {init: 80},
  rows: {init: 25},
  parser: {
      x: {init: true},
      y: {init: 'hello'},
      windowOptions: {
          resizeWin: {init: false}
        }
  }
};


// or spread across separate definitions
const W_DEFAULT: IWindowOptions = {
  resizeWin: {init: false}
};

const P_DEFAULT: IParserOptions = {
  x: {init: true},
  y: {init: 'yo'},
  windowOptions: W_DEFAULT
};

// and joined later on
const T_DEFAULT: ITerminalOptions = {
  cols: {init: 80},
  rows: {init: 25},
  parser: P_DEFAULT
}


/**
 * Test realisation type
 */

// some settings shall be changed
// Note: all values are correctly inferred from the definition above
const customizeValues: DeepRealisation<ITerminalOptions> = {
  cols: 12,
  rows: 88,
  parser: {
    x: false,
    y: 'yo',
    windowOptions: {
      resizeWin: true,
    }
  }
};



/**
 * Settings class...TODO
 * 
 * This is the final deal with these characteristics:
 * - recursive Settings for IOptionCollections
 * - object is stable - will never change identity
 * - mutability only for primitves string | number | boolean
 * - allow bootstrap of settings from definitions with optional overwrites:
 *    `new Settings(definition: SomeIOptionCollection, overwrites: DeepRealisation<SomeIOptionCollection>)`
 * - allow partial settings updates
 *    `settings.xy = z`
 *    `settings.parser = {y: 'yo', windowOptions: {resizeWin: false}}`
 * - set/getOption for old style access
 */
class Settings {

}
