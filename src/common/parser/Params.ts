/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IParams } from 'common/parser/Types';

/**
 * Params storage class.
 * This type is used by the parser to acuumulate sequence parameters and sub parameters
 * and transmit them to the input handler actions.
 * Note: The params object for the handler actions is borrowed from the parser
 * and will be lost after the handler exits. Use either `toArray` or `clone` to get
 * a stable copy of the data.
 */
export class Params implements IParams {
  // params store and length
  public params: Int16Array;
  public length: number;

  // sub params store and length
  public subParams: Int16Array;
  public subParamsLength: number;

  // sub params offsets from param: param idx --> [start, end] offset
  private _subParamsIdx: Uint16Array;
  private _rejectDigits: boolean;
  private _rejectSubDigits: boolean;

  /**
   * Create a `Params` type from JS array representation.
   */
  public static fromArray(values: (number | number[])[]): Params {
    const params = new Params();
    if (!values.length) {
      return params;
    }
    // skip leading sub params
    for (let i = (values[0] instanceof Array) ? 1 : 0; i < values.length; ++i) {
      const value = values[i];
      if (value instanceof Array) {
        for (let k = 0; k < value.length; ++k) {
          params.addSubParam(value[k]);
        }
      } else {
        params.addParam(value);
      }
    }
    return params;
  }

  /**
   * @param maxLength max length of storable parameters
   * @param maxSubParamsLength max length of storable sub parameters
   */
  constructor(public maxLength: number = 32, public maxSubParamsLength: number = 32) {
    // precondition: subparams cannot be more than 256
    if (maxSubParamsLength > 256) {
      throw new Error('maxSubParamsLength must not be greater than 256');
    }
    this.params = new Int16Array(maxLength);
    this.length = 0;
    this.subParams = new Int16Array(maxSubParamsLength);
    this.subParamsLength = 0;
    this._subParamsIdx = new Uint16Array(maxLength);
    this._rejectDigits = false;
    this._rejectSubDigits = false;
  }

  /**
   * Clone object to its own copy.
   */
  public clone(): Params {
    const newParams = new Params(this.maxLength, this.maxSubParamsLength);
    newParams.params.set(this.params);
    newParams.length = this.length;
    newParams.subParams.set(this.subParams);
    newParams.subParamsLength = this.subParamsLength;
    newParams._subParamsIdx.set(this._subParamsIdx);
    return newParams;
  }

  /**
   * Get a JS array representation of the current parameters and sub parameters.
   * The array is structured as follows:
   *    sequence: "1;2:3:4;5::6"
   *    array   : [1, 2, [3, 4], 5, [-1, 6]]
   */
  public toArray(): (number | number[])[] {
    const res: (number | number[])[] = [];
    for (let i = 0; i < this.length; ++i) {
      res.push(this.params[i]);
      const start = this._subParamsIdx[i] >> 8;
      const end = this._subParamsIdx[i] & 0xFF;
      if (end - start > 0) {
        res.push(Array.prototype.slice.call(this.subParams, start, end));
      }
    }
    return res;
  }

  /**
   * Reset to initial empty state.
   */
  public reset(): void {
    this.length = 0;
    this.subParamsLength = 0;
    this._rejectDigits = false;
    this._rejectSubDigits = false;
  }

  /**
   * Add a parameter value.
   * `Params` only stores up to `maxLength` parameters, any later
   * parameter will be ignored.
   * Note: VT devices only stored up to 16 values, xterm seems to
   * store up to 30.
   */
  public addParam(value: number): void {
    if (this.length >= this.maxLength) {
      this._rejectDigits = true;
      return;
    }
    this._subParamsIdx[this.length] = this.subParamsLength << 8 | this.subParamsLength;
    this.params[this.length++] = value;
  }

  /**
   * Add a sub parameter value.
   * The sub parameter is automatically associated with the last parameter value.
   * If there is no parameter yet the sub parameter is ingored.
   * `Params` only stores up to `subParamsLength` sub parameters, any later
   * sub parameter will be ignored.
   */
  public addSubParam(value: number): void {
    if (!this.length || this.subParamsLength >= this.maxSubParamsLength) {
      this._rejectSubDigits = true;
      return;
    }
    this.subParams[this.subParamsLength++] = value;
    this._subParamsIdx[this.length - 1]++;
  }

  /**
   * Whether parameter at index `idx` has sub parameters.
   */
  public hasSubParams(idx: number): boolean {
    return ((this._subParamsIdx[idx] & 0xFF) - (this._subParamsIdx[idx] >> 8) > 0);
  }

  /**
   * Return sub parameters for parameter at index `idx`.
   * Note: The values are borrowed, thus you need to copy
   * the values if you need to hold them in nonlocal scope.
   */
  public getSubParams(idx: number): Int16Array | null {
    const start = this._subParamsIdx[idx] >> 8;
    const end = this._subParamsIdx[idx] & 0xFF;
    if (end - start > 0) {
      return this.subParams.subarray(start, end);
    }
    return null;
  }

  /**
   * Return all kown sub parameters as {idx: subparams} mapping.
   * Note: The values are not borrowed, thus it is safe to hold
   * them without copying.
   */
  public getSubParamsAll(): {[idx: number]: Int16Array} {
    const result: {[idx: number]: Int16Array} = {};
    for (let i = 0; i < this.length; ++i) {
      const start = this._subParamsIdx[i] >> 8;
      const end = this._subParamsIdx[i] & 0xFF;
      if (end - start > 0) {
        result[i] = this.subParams.slice(start, end);
      }
    }
    return result;
  }

  /**
   * Add a single digit value to current parameter.
   * This is used by the parser to account digits on a char by char basis.
   * Do not use this method directly, consider using `addParam` instead.
   */
  public addParamDigit(value: number): void {
    if (this._rejectDigits) {
      return;
    }
    this.params[this.length - 1] = this.params[this.length - 1] * 10 + value;
  }

  /**
   * Add a single digit value to current sub parameter.
   * This is used by the parser to account digits on a char by char basis.
   * Do not use this method directly, consider using `addSubParam` instead.
   */
  public addSubParamDigit(value: number): void {
    if (!this.subParamsLength || this._rejectDigits || this._rejectSubDigits) {
      return;
    }
    if (this.subParams[this.subParamsLength - 1] === -1) {
      this.subParams[this.subParamsLength - 1] = value;
    } else {
      this.subParams[this.subParamsLength - 1] = this.subParams[this.subParamsLength - 1] * 10 + value;
    }
  }
}
