/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { graphemeType, canBreak, BreakState, GraphemeTypes } from './Grapheme';
import * as chai from 'chai';

const _TYPES  = {
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
        chai.expect(graphemeType(cp)).equals(_TYPES[CODEPOINTS[cp]] || 0);
      }
    });
    it('SMP (1)', function(): void {
      if (!CODEPOINTS) return;
      for (let cp = 65536; cp < 2 * 65536; ++cp) {
        chai.expect(graphemeType(cp)).equals(_TYPES[CODEPOINTS[cp]] || 0);
      }
    });
    it('SSP (14)', function(): void {
      if (!CODEPOINTS) return;
      for (let cp = 14 * 65536; cp < 15 * 65536; ++cp) {
        chai.expect(graphemeType(cp)).equals(_TYPES[CODEPOINTS[cp]] || 0);
      }
    });
  });
  describe('break rules', function(): void {
    it('GB 3', function(): void {
      chai.expect(canBreak(GraphemeTypes.LF, GraphemeTypes.CR)).equals(BreakState.FALSE);
    });
    it('GB 4', function(): void { // TODO: test all states
      const types = [GraphemeTypes.CONTROL, GraphemeTypes.CR, GraphemeTypes.LF];
      for (let pos in types) {
        chai.expect(canBreak(GraphemeTypes.OTHER, types[pos])).equals(BreakState.TRUE);
      }
    });
    it('GB 5', function(): void { // TODO: test all states
      const types = [GraphemeTypes.CONTROL, GraphemeTypes.CR, GraphemeTypes.LF];
      for (let pos in types) {
        chai.expect(canBreak(types[pos], GraphemeTypes.OTHER)).equals(BreakState.TRUE);
      }
    });
    it('GB 6', function(): void {
      const types = [GraphemeTypes.L, GraphemeTypes.V, GraphemeTypes.LV, GraphemeTypes.LVT];
      for (let pos in types) {
        chai.expect(canBreak(types[pos], GraphemeTypes.L)).equals(BreakState.FALSE);
      }
    });
    it('GB 7', function(): void {
      chai.expect(canBreak(GraphemeTypes.V, GraphemeTypes.LV)).equals(BreakState.FALSE);
      chai.expect(canBreak(GraphemeTypes.T, GraphemeTypes.LV)).equals(BreakState.FALSE);
      chai.expect(canBreak(GraphemeTypes.V, GraphemeTypes.V)).equals(BreakState.FALSE);
      chai.expect(canBreak(GraphemeTypes.T, GraphemeTypes.V)).equals(BreakState.FALSE);
    });
    it('GB 8', function(): void {
      chai.expect(canBreak(GraphemeTypes.T, GraphemeTypes.LVT)).equals(BreakState.FALSE);
      chai.expect(canBreak(GraphemeTypes.T, GraphemeTypes.T)).equals(BreakState.FALSE);
    });
    it('GB 9', function(): void {
      chai.expect(canBreak(GraphemeTypes.EXTEND, GraphemeTypes.OTHER)).equals(BreakState.FALSE);
      chai.expect(canBreak(GraphemeTypes.ZWJ, GraphemeTypes.OTHER)).equals(BreakState.FALSE);
      chai.expect(canBreak(GraphemeTypes.EXTEND, GraphemeTypes.E_BASE)).equals(BreakState.EMOJI_EXTEND);
      chai.expect(canBreak(GraphemeTypes.ZWJ, GraphemeTypes.E_BASE)).equals(BreakState.EMOJI_EXTEND);  // wrong here?
      chai.expect(canBreak(GraphemeTypes.EXTEND, GraphemeTypes.E_BASE_GAZ)).equals(BreakState.EMOJI_EXTEND);
      chai.expect(canBreak(GraphemeTypes.ZWJ, GraphemeTypes.E_BASE_GAZ)).equals(BreakState.EMOJI_EXTEND);  // wrong here?
    });
    it('GB 9a', function(): void {
      chai.expect(canBreak(GraphemeTypes.SPACINGMARK, GraphemeTypes.OTHER)).equals(BreakState.FALSE);
    });
    it('GB 9b', function(): void {
      chai.expect(canBreak(GraphemeTypes.OTHER, GraphemeTypes.PREPEND)).equals(BreakState.FALSE);
    });
    it('GB 10', function(): void {
      chai.expect(canBreak(GraphemeTypes.E_MODIFIER, GraphemeTypes.E_BASE)).equals(BreakState.FALSE);
      chai.expect(canBreak(GraphemeTypes.E_MODIFIER, GraphemeTypes.E_BASE_GAZ)).equals(BreakState.FALSE);
      chai.expect(canBreak(GraphemeTypes.E_MODIFIER, BreakState.EMOJI_EXTEND)).equals(BreakState.FALSE);
    });
    it('GB 11', function(): void {
      chai.expect(canBreak(GraphemeTypes.GLUE_AFTER_ZWJ, GraphemeTypes.ZWJ)).equals(BreakState.FALSE);
      chai.expect(canBreak(GraphemeTypes.E_BASE_GAZ, GraphemeTypes.ZWJ)).equals(BreakState.FALSE);
    });
    it('GB 12 & 13', function(): void {
      chai.expect(canBreak(GraphemeTypes.REGIONAL_INDICATOR, GraphemeTypes.REGIONAL_INDICATOR)).equals(BreakState.REGIONAL_SECOND);
      chai.expect(canBreak(GraphemeTypes.REGIONAL_INDICATOR, BreakState.REGIONAL_SECOND)).equals(BreakState.TRUE);
    });
  });
});
