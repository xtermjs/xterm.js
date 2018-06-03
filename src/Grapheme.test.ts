/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { graphemeType } from './Grapheme';
import * as chai from 'chai';

const TYPES  = {
  Other: 0,
  L: 1,
  V: 2,
  T: 3,
  LV: 4,
  LVT: 5,
  CR: 6,
  LF: 7,
  ZWJ: 8,
  Prepend: 9,
  Control: 10,
  Extend: 11,
  SpacingMark: 12,
  E_Base: 13,
  Glue_After_Zwj: 14,
  E_Modifier: 15,
  E_Base_GAZ: 16,
  Regional_Indicator: 17
};

const URL = 'https://www.unicode.org/Public/10.0.0/ucd/auxiliary/GraphemeBreakProperty.txt';
const GRAPHEME_REX = /^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*([A-Za-z_]+)/gm;

let CODEPOINTS = null;

function parseDefinitions(data: string): {[key: number]: number} {
  const codepoints = Object.create(null);
  let match = null;
  while (match = GRAPHEME_REX.exec(data)) {
    const start = parseInt(match[1], 16);
    const end = parseInt(match[2], 16) || start;
    for (let i = start; i < end + 1; ++i) codepoints[i] = match[3];
  }
  return codepoints;
}

function loadUnicodeData(done: Function): void {
  require('https').get(URL, (resp): any => {
    let data = '';
    resp.on('data', (chunk): void => {
      data += chunk;
    });
    resp.on('end', () => {
      CODEPOINTS = parseDefinitions(data);
      done();
    });
  }).on('error', (err) => {
    throw Error('error fetching unicode data');
  });
}

describe('grapheme cluster', function (): void {
  before(function(done: Function): void {
    this.timeout(5000);
    loadUnicodeData(done);
  });
  describe('graphemeType', function(): void {
    it('BMP (0)', function(): void {
      if (!CODEPOINTS) return;
      for (let cp = 0; cp < 65536; ++cp) {
        chai.expect(graphemeType(cp)).equals(TYPES[CODEPOINTS[cp]] || 0);
      }
    });
    it('SMP (1)', function(): void {
      if (!CODEPOINTS) return;
      for (let cp = 65536; cp < 2 * 65536; ++cp) {
        chai.expect(graphemeType(cp)).equals(TYPES[CODEPOINTS[cp]] || 0);
      }
    });
    it('SSP (14)', function(): void {
      if (!CODEPOINTS) return;
      for (let cp = 14 * 65536; cp < 15 * 65536; ++cp) {
        chai.expect(graphemeType(cp)).equals(TYPES[CODEPOINTS[cp]] || 0);
      }
    });
  });
});
