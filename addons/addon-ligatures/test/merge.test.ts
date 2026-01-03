/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';

const mergeTrees = require('../out-esbuild/fontLigatures/merge').default;

interface LookupResult {
  contextRange: [number, number];
  index: number;
  subIndex: number;
  length: number;
  substitutions: number[];
}

function lookup(substitutionGlyph: number, index?: number, subIndex?: number): LookupResult {
  return {
    contextRange: [0, 1],
    index: index || 0,
    subIndex: subIndex || 0,
    length: 1,
    substitutions: [substitutionGlyph]
  };
}

describe('addon-ligatures - merge', () => {
  describe('mergeTrees', () => {
    it('combines disjoint trees', () => {
      const result = mergeTrees([
        {
          individual: {
            '1': { lookup: lookup(1) }
          },
          range: []
        },
        {
          individual: {},
          range: [{
            entry: { lookup: lookup(2) },
            range: [2, 4]
          }]
        },
        {
          individual: {
            '5': { lookup: lookup(3) }
          },
          range: []
        },
        {
          individual: {},
          range: [{
            entry: { lookup: lookup(4) },
            range: [8, 10]
          }]
        }
      ]);

      assert.deepEqual(result, {
        individual: {
          '1': { lookup: lookup(1) },
          '5': { lookup: lookup(3) }
        },
        range: [{
          entry: { lookup: lookup(2) },
          range: [2, 4]
        }, {
          entry: { lookup: lookup(4) },
          range: [8, 10]
        }]
      });
    });

    it('merges matching individual glyphs', () => {
      const result = mergeTrees([
        {
          individual: {
            '1': { lookup: lookup(1, 1) }
          },
          range: []
        },
        {
          individual: {
            '1': { lookup: lookup(2, 0) }
          },
          range: []
        },
        {
          individual: {
            '1': { lookup: lookup(3, 2) }
          },
          range: []
        }
      ]);

      assert.deepEqual(result, {
        individual: {
          '1': { lookup: lookup(2, 0) }
        },
        range: []
      });
    });

    it('merges range glyphs overlapping individual glyphs', () => {
      const result = mergeTrees([
        {
          individual: {
            '1': { lookup: lookup(1, 0) }
          },
          range: []
        },
        {
          individual: {},
          range: [{
            entry: { lookup: lookup(2, 1) },
            range: [0, 4]
          }]
        }
      ]);

      assert.deepEqual(result, {
        individual: {
          '0': { lookup: lookup(2, 1) },
          '1': { lookup: lookup(1, 0) }
        },
        range: [{
          entry: { lookup: lookup(2, 1) },
          range: [2, 4]
        }]
      });
    });

    it('merges individual glyphs overlapping range glyphs', () => {
      const result = mergeTrees([
        {
          individual: {},
          range: [{
            entry: { lookup: lookup(2, 1) },
            range: [0, 4]
          }]
        },
        {
          individual: {
            '1': { lookup: lookup(1, 0) }
          },
          range: []
        }
      ]);

      assert.deepEqual(result, {
        individual: {
          '0': { lookup: lookup(2, 1) },
          '1': { lookup: lookup(1, 0) }
        },
        range: [{
          entry: { lookup: lookup(2, 1) },
          range: [2, 4]
        }]
      });
    });

    it('merges multiple overlapping ranges', () => {
      const result = mergeTrees([
        {
          individual: {},
          range: [{
            entry: { lookup: lookup(1, 2) },
            range: [0, 3]
          }, {
            entry: { lookup: lookup(2, 1) },
            range: [6, 12]
          }, {
            entry: { lookup: lookup(5, 3) },
            range: [15, 20]
          }, {
            entry: { lookup: lookup(7, 4) },
            range: [20, 22]
          }]
        },
        {
          individual: {},
          range: [{
            entry: { lookup: lookup(3, 0) },
            range: [2, 8]
          }, {
            entry: { lookup: lookup(4, 0) },
            range: [10, 13]
          }, {
            entry: { lookup: lookup(6, 0) },
            range: [16, 21]
          }]
        }
      ]);

      assert.deepEqual(result, {
        individual: {
          '2': { lookup: lookup(3, 0) },
          '12': { lookup: lookup(4, 0) },
          '15': { lookup: lookup(5, 3) },
          '20': { lookup: lookup(6, 0) },
          '21': { lookup: lookup(7, 4) }
        },
        range: [{
          entry: { lookup: lookup(1, 2) },
          range: [0, 2]
        }, {
          entry: { lookup: lookup(3, 0) },
          range: [6, 8]
        }, {
          entry: { lookup: lookup(3, 0) },
          range: [3, 6]
        }, {
          entry: { lookup: lookup(2, 1) },
          range: [8, 10]
        }, {
          entry: { lookup: lookup(4, 0) },
          range: [10, 12]
        }, {
          entry: { lookup: lookup(6, 0) },
          range: [16, 20]
        }]
      });
    });
  });
});