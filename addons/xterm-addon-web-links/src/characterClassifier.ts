/**
 * A fast character classifier that uses a compact array for ASCII values.
 */
export class CharacterClassifier<T extends number> {
	/**
	 * Maintain a compact (fully initialized ASCII map for quickly classifying ASCII characters - used more often in code).
	 */
  private _asciiMap: Uint8Array;

	/**
	 * The entire map (sparse array).
	 */
  private _map: Map<number, number>;

  private _defaultValue: number;

  constructor(_defaultValue: T) {
    let defaultValue = toUint8(_defaultValue);

    this._defaultValue = defaultValue;
    this._asciiMap = CharacterClassifier._createAsciiMap(defaultValue);
    this._map = new Map<number, number>();
  }

  private static _createAsciiMap(defaultValue: number): Uint8Array {
    let asciiMap: Uint8Array = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      asciiMap[i] = defaultValue;
    }
    return asciiMap;
  }

  public set(charCode: number, _value: T): void {
    let value = toUint8(_value);

    if (charCode >= 0 && charCode < 256) {
      this._asciiMap[charCode] = value;
    } else {
      this._map.set(charCode, value);
    }
  }

  public get(charCode: number): T {
    if (charCode >= 0 && charCode < 256) {
      return <T>this._asciiMap[charCode];
    } else {
      return <T>(this._map.get(charCode) || this._defaultValue);
    }
  }
}

const enum Boolean {
  False = 0,
  True = 1
}

export class CharacterSet {

  private readonly _actual: CharacterClassifier<Boolean>;

  constructor() {
    this._actual = new CharacterClassifier<Boolean>(Boolean.False);
  }

  public add(charCode: number): void {
    this._actual.set(charCode, Boolean.True);
  }

  public has(charCode: number): boolean {
    return (this._actual.get(charCode) === Boolean.True);
  }
}

export const enum Constants {
	/**
	 * MAX SMI (SMall Integer) as defined in v8.
	 * one bit is lost for boxing/unboxing flag.
	 * one bit is lost for sign flag.
	 * See https://thibaultlaurens.github.io/javascript/2013/04/29/how-the-v8-engine-works/#tagged-values
	 */
  MAX_SAFE_SMALL_INTEGER = 1 << 30,

	/**
	 * MIN SMI (SMall Integer) as defined in v8.
	 * one bit is lost for boxing/unboxing flag.
	 * one bit is lost for sign flag.
	 * See https://thibaultlaurens.github.io/javascript/2013/04/29/how-the-v8-engine-works/#tagged-values
	 */
  MIN_SAFE_SMALL_INTEGER = -(1 << 30),

	/**
	 * Max unsigned integer that fits on 8 bits.
	 */
  MAX_UINT_8 = 255, // 2^8 - 1

	/**
	 * Max unsigned integer that fits on 16 bits.
	 */
  MAX_UINT_16 = 65535, // 2^16 - 1

	/**
	 * Max unsigned integer that fits on 32 bits.
	 */
  MAX_UINT_32 = 4294967295, // 2^32 - 1

  UNICODE_SUPPLEMENTARY_PLANE_BEGIN = 0x010000
}

export function toUint8(v: number): number {
  if (v < 0) {
    return 0;
  }
  if (v > Constants.MAX_UINT_8) {
    return Constants.MAX_UINT_8;
  }
  return v | 0;
}
