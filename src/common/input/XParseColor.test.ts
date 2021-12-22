/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { parseColor, toRgbString } from 'common/input/XParseColor';

describe('XParseColor', () => {
  describe('parseColor', () => {
    it('rgb:<r>/<g>/<b> scheme in 4/8/12/16 bit', () => {
      // 4 bit
      assert.deepEqual(parseColor('rgb:0/0/0'), [0, 0, 0]);
      assert.deepEqual(parseColor('rgb:f/f/f'), [255, 255, 255]);
      assert.deepEqual(parseColor('rgb:1/2/3'), [17, 34, 51]);
      // 8 bit
      assert.deepEqual(parseColor('rgb:00/00/00'), [0, 0, 0]);
      assert.deepEqual(parseColor('rgb:ff/ff/ff'), [255, 255, 255]);
      assert.deepEqual(parseColor('rgb:11/22/33'), [17, 34, 51]);
      // 12 bit
      assert.deepEqual(parseColor('rgb:000/000/000'), [0, 0, 0]);
      assert.deepEqual(parseColor('rgb:fff/fff/fff'), [255, 255, 255]);
      assert.deepEqual(parseColor('rgb:111/222/333'), [17, 34, 51]);
      // 16 bit
      assert.deepEqual(parseColor('rgb:0000/0000/0000'), [0, 0, 0]);
      assert.deepEqual(parseColor('rgb:ffff/ffff/ffff'), [255, 255, 255]);
      assert.deepEqual(parseColor('rgb:1111/2222/3333'), [17, 34, 51]);
    });
    it('#RGB scheme in 4/8/12/16 bit', () => {
      // 4 bit
      assert.deepEqual(parseColor('#000'), [0, 0, 0]);
      assert.deepEqual(parseColor('#fff'), [240, 240, 240]);
      assert.deepEqual(parseColor('#123'), [16, 32, 48]);
      // 8 bit
      assert.deepEqual(parseColor('#000000'), [0, 0, 0]);
      assert.deepEqual(parseColor('#ffffff'), [255, 255, 255]);
      assert.deepEqual(parseColor('#112233'), [17, 34, 51]);
      // 12 bit
      assert.deepEqual(parseColor('#000000000'), [0, 0, 0]);
      assert.deepEqual(parseColor('#fffffffff'), [255, 255, 255]);
      assert.deepEqual(parseColor('#111222333'), [17, 34, 51]);
      // 16 bit
      assert.deepEqual(parseColor('#000000000000'), [0, 0, 0]);
      assert.deepEqual(parseColor('#ffffffffffff'), [255, 255, 255]);
      assert.deepEqual(parseColor('#111122223333'), [17, 34, 51]);
    });
    it('supports upper case', () => {
      assert.deepEqual(parseColor('RGB:0/A/F'), [0, 170, 255]);
      assert.deepEqual(parseColor('#FFF'), [240, 240, 240]);
    });
    it('does not parse illegal combinations', () => {
      // shifting bit width
      assert.equal(parseColor('rgb:0/11/222'), undefined);
      // unsupported scheme
      assert.equal(parseColor('rgbi:00/11/22'), undefined);
      // broken # specifier
      assert.equal(parseColor('#aabbbcc'), undefined);
      // out of range
      assert.equal(parseColor('#aabbgg'), undefined);
      assert.equal(parseColor('rgb:aa/bb/gg'), undefined);
    });
  });
  describe('toXColorRgb', () => {
    it('rgb:<r>/<g>/<b> scheme in 4/8/12/16 bit', () => {
      // 4 bit
      assert.equal(toRgbString(parseColor('rgb:0/0/0')!, 4), 'rgb:0/0/0');
      assert.equal(toRgbString(parseColor('rgb:f/f/f')!, 4), 'rgb:f/f/f');
      assert.equal(toRgbString(parseColor('rgb:1/2/3')!, 4), 'rgb:1/2/3');
      // 8 bit
      assert.equal(toRgbString(parseColor('rgb:00/00/00')!, 8), 'rgb:00/00/00');
      assert.equal(toRgbString(parseColor('rgb:ff/ff/ff')!, 8), 'rgb:ff/ff/ff');
      assert.equal(toRgbString(parseColor('rgb:11/22/33')!, 8), 'rgb:11/22/33');
      // 12 bit
      assert.equal(toRgbString(parseColor('rgb:000/000/000')!, 12), 'rgb:000/000/000');
      assert.equal(toRgbString(parseColor('rgb:fff/fff/fff')!, 12), 'rgb:fff/fff/fff');
      assert.equal(toRgbString(parseColor('rgb:111/222/333')!, 12), 'rgb:111/222/333');
      // 16 bit
      assert.equal(toRgbString(parseColor('rgb:0000/0000/0000')!, 16), 'rgb:0000/0000/0000');
      assert.equal(toRgbString(parseColor('rgb:ffff/ffff/ffff')!, 16), 'rgb:ffff/ffff/ffff');
      assert.equal(toRgbString(parseColor('rgb:1111/2222/3333')!, 16), 'rgb:1111/2222/3333');
    });
    it('defaults to 16 bit output', () => {
      assert.equal(toRgbString(parseColor('rgb:1/2/3')!), 'rgb:1111/2222/3333');
      assert.equal(toRgbString(parseColor('rgb:11/22/33')!), 'rgb:1111/2222/3333');
      assert.equal(toRgbString(parseColor('rgb:111/222/333')!), 'rgb:1111/2222/3333');
      assert.equal(toRgbString(parseColor('rgb:123/123/123')!), 'rgb:1212/1212/1212');
    });
    it('reduces colors to 8 bit resolution', () => {
      assert.equal(toRgbString(parseColor('rgb:123/123/123')!, 12), 'rgb:121/121/121');
      assert.equal(toRgbString(parseColor('rgb:1234/1234/1234')!, 16), 'rgb:1212/1212/1212');
    });
  });
});
