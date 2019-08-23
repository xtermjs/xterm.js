/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { Params } from 'common/parser/Params';
import { ParamsArray } from 'common/parser/Types';

class TestParams extends Params {
  public get subParams(): Int32Array {
    return this._subParams;
  }
  public get subParamsLength(): number {
    return this._subParamsLength;
  }
}

/** `Params` parser shim */
function parse(params: Params, s: string | string[]): void {
  params.reset();
  params.addParam(0);
  if (typeof s === 'string') {
    s = [s];
  }
  for (const chunk of s) {
    for (let i = 0; i < chunk.length; ++i) {
      let code = chunk.charCodeAt(i);
      do {
        switch (code) {
          case 0x3b:
            params.addParam(0);
            break;
          case 0x3a:
            params.addSubParam(-1);
            break;
          default:  // 0x30 - 0x39
            params.addDigit(code - 48);
        }
      } while (++i < s.length && (code = chunk.charCodeAt(i)) > 0x2f && code < 0x3c);
      i--;
    }
  }
}


describe('Params', () => {
  it('should respect ctor args', () => {
    const params = new TestParams(12, 23);
    assert.equal(params.params.length, 12);
    assert.equal(params.subParams.length, 23);
    assert.deepEqual(params.toArray(), []);
  });
  it('addParam', () => {
    const params = new TestParams();
    params.addParam(1);
    assert.equal(params.length, 1);
    assert.deepEqual(Array.prototype.slice.call(params.params, 0, params.length), [1]);
    assert.deepEqual(params.toArray(), [1]);
    params.addParam(23);
    assert.equal(params.length, 2);
    assert.deepEqual(Array.prototype.slice.call(params.params, 0, params.length), [1, 23]);
    assert.deepEqual(params.toArray(), [1, 23]);
    assert.equal(params.subParamsLength, 0);
  });
  it('addSubParam', () => {
    const params = new TestParams();
    params.addParam(1);
    params.addSubParam(2);
    params.addSubParam(3);
    assert.equal(params.length, 1);
    assert.equal(params.subParamsLength, 2);
    assert.deepEqual(params.toArray(), [1, [2, 3]]);
    params.addParam(12345);
    params.addSubParam(-1);
    assert.equal(params.length, 2);
    assert.equal(params.subParamsLength, 3);
    assert.deepEqual(params.toArray(), [1, [2, 3], 12345, [-1]]);
  });
  it('should not add sub params without previous param', () => {
    const params = new TestParams();
    params.addSubParam(2);
    params.addSubParam(3);
    assert.equal(params.length, 0);
    assert.equal(params.subParamsLength, 0);
    assert.deepEqual(params.toArray(), []);
    params.addParam(1);
    params.addSubParam(2);
    params.addSubParam(3);
    assert.equal(params.length, 1);
    assert.equal(params.subParamsLength, 2);
    assert.deepEqual(params.toArray(), [1, [2, 3]]);
  });
  it('reset', () => {
    const params = new TestParams();
    params.addParam(1);
    params.addSubParam(2);
    params.addSubParam(3);
    params.addParam(12345);
    params.addSubParam(-1);
    params.reset();
    assert.equal(params.length, 0);
    assert.equal(params.subParamsLength, 0);
    assert.deepEqual(params.toArray(), []);
    params.addParam(1);
    params.addSubParam(2);
    params.addSubParam(3);
    params.addParam(12345);
    params.addSubParam(-1);
    assert.equal(params.length, 2);
    assert.equal(params.subParamsLength, 3);
    assert.deepEqual(params.toArray(), [1, [2, 3], 12345, [-1]]);
  });
  it('Params.fromArray --> toArray', () => {
    let data: ParamsArray = [];
    assert.deepEqual(Params.fromArray(data).toArray(), data);
    data = [1, [2, 3], 12345, [-1]];
    assert.deepEqual(Params.fromArray(data).toArray(), data);
    data = [38, 2, 50, 100, 150];
    assert.deepEqual(Params.fromArray(data).toArray(), data);
    data = [38, 2, 50, 100, [150]];
    assert.deepEqual(Params.fromArray(data).toArray(), data);
    data = [38, [2, 50, 100, 150]];
    assert.deepEqual(Params.fromArray(data).toArray(), data);
    // strip empty sub params
    data = [38, [2, 50, 100, 150], 5, [], 6];
    assert.deepEqual(Params.fromArray(data).toArray(), [38, [2, 50, 100, 150], 5, 6]);
  });
  it('clone', () => {
    const params = Params.fromArray([38, [2, 50, 100, 150], 5, [], 6, 1, [2, 3], 12345, [-1]]);
    assert.deepEqual(params.clone(), params);
  });
  it('hasSubParams / getSubParams', () => {
    const params = Params.fromArray([38, [2, 50, 100, 150], 5, [], 6]);
    assert.equal(params.hasSubParams(0), true);
    assert.deepEqual(params.getSubParams(0), new Int32Array([2, 50, 100, 150]));
    assert.equal(params.hasSubParams(1), false);
    assert.deepEqual(params.getSubParams(1), null);
    assert.equal(params.hasSubParams(2), false);
    assert.deepEqual(params.getSubParams(2), null);
  });
  it('getSubParamsAll', () => {
    const params = Params.fromArray([1, [2, 3], 7, 12345, [-1]]);
    assert.deepEqual(params.getSubParamsAll(), {0: new Int32Array([2, 3]), 2: new Int32Array([-1])});
  });
  describe('parse tests', () => {
    it('param defaults to 0 (ZDM - zero default mode)', () => {
      const params = new Params();
      parse(params, '');
      assert.deepEqual(params.toArray(), [0]);
    });
    it('sub param defaults to -1', () => {
      const params = new Params();
      parse(params, ':');
      assert.deepEqual(params.toArray(), [0, [-1]]);
    });
    it('should correctly reset on new sequence', () => {
      const params = new Params();
      parse(params, '1;2;3');
      assert.deepEqual(params.toArray(), [1, 2, 3]);
      parse(params, '4');
      assert.deepEqual(params.toArray(), [4]);
      parse(params, '4::123:5;6;7');
      assert.deepEqual(params.toArray(), [4, [-1, 123, 5], 6, 7]);
      parse(params, '');
      assert.deepEqual(params.toArray(), [0]);
    });
    it('should handle length restrictions correctly', () => {
      // restrict to 3 params and 3 sub params
      const params = new Params(3, 3);
      parse(params, '1;2;3');
      assert.deepEqual(params.toArray(), [1, 2, 3]);
      parse(params, '4');
      assert.deepEqual(params.toArray(), [4]);
      parse(params, '4::123:5;6;7');
      assert.deepEqual(params.toArray(), [4, [-1, 123, 5], 6, 7]);
      parse(params, '');
      assert.deepEqual(params.toArray(), [0]);
      // overlong params
      parse(params, '1;2;3;4;5;6;7');
      assert.deepEqual(params.toArray(), [1, 2, 3]);
      // overlong sub params
      parse(params, '4;38:2::50:100:150;48:5:22');
      assert.deepEqual(params.toArray(), [4, 38, [2, -1, 50], 48]);
    });
    it('typical sequences', () => {
      const params = new Params();
      // SGR with semicolon syntax
      parse(params, '0;4;38;2;50;100;150;48;5;22');
      assert.deepEqual(params.toArray(), [0, 4, 38, 2, 50, 100, 150, 48, 5, 22]);
      // SGR mixed style (partly wrong)
      parse(params, '0;4;38;2;50:100:150;48;5:22');
      assert.deepEqual(params.toArray(), [0, 4, 38, 2, 50, [100, 150], 48, 5, [22]]);
      // SGR colon style
      parse(params, '0;4;38:2::50:100:150;48:5:22');
      assert.deepEqual(params.toArray(), [0, 4, 38, [2, -1, 50, 100, 150], 48, [5, 22]]);
    });
  });
  describe('should not overflow to negative', () => {
    it('reject params lesser -1', () => {
      const params = new Params();
      params.addParam(-1);
      assert.throws(() => params.addParam(-2), 'values lesser than -1 are not allowed');
    });
    it('reject subparams lesser -1', () => {
      const params = new Params();
      params.addParam(-1);
      params.addSubParam(-1);
      assert.throws(() => params.addSubParam(-2), 'values lesser than -1 are not allowed');
      assert.deepEqual(params.toArray(), [-1, [-1]]);
    });
    it('clamp parsed params', () => {
      const params = new Params();
      parse(params, '2147483648');
      assert.deepEqual(params.toArray(), [0x7FFFFFFF]);
    });
    it('clamp parsed subparams', () => {
      const params = new Params();
      parse(params, ':2147483648');
      assert.deepEqual(params.toArray(), [0, [0x7FFFFFFF]]);
    });
  });
  describe('issue 2389', () => {
    it('should cancel subdigits if beyond params limit', () => {
      const params = new Params();
      parse(params, ';;;;;;;;;10;;;;;;;;;;20;;;;;;;;;;30;31;32;33;34;35::::::::');
      assert.deepEqual(params.toArray(), [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 10,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 20,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 30, 31, 32]);
    });
    it('should carry forward isSub state', () => {
      const params = new Params();
      parse(params, ['1:22:33', '44']);
      assert.deepEqual(params.toArray(), [1, [22, 3344]]);
    });
  });
});
