/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';

import parse from './parse';

// TODO: integrate tests from http://test.csswg.org/suites/css-fonts-4_dev/nightly-unstable/
describe('parse', () => {
  it('parses individual families', () => {
    assert.deepEqual(parse('monospace'), ['monospace']);
  });

  it('parses multiple families', () => {
    assert.deepEqual(parse('Arial, Verdana, serif'), ['Arial', 'Verdana', 'serif']);
  });

  it('parses quoted families', () => {
    assert.deepEqual(parse('"Times New Roman", serif'), ['Times New Roman', 'serif']);
  });

  it('parses single quoted families', () => {
    assert.deepEqual(parse('\'Times New Roman\', serif'), ['Times New Roman', 'serif']);
  });

  it('parses families with spaces in their names', () => {
    assert.deepEqual(parse('Times New Roman, serif'), ['Times New Roman', 'serif']);
  });

  it('collapses multiple spaces together in identifiers', () => {
    assert.deepEqual(parse('Times   New Roman, serif'), ['Times New Roman', 'serif']);
  });

  it('does not collapse multiple spaces together in quoted strings', () => {
    assert.deepEqual(parse('"Times   New Roman", serif'), ['Times   New Roman', 'serif']);
  });

  it('handles escaped characters in strings', () => {
    assert.deepEqual(parse('"quote \\" slash \\\\ slashquote \\\\\\"", serif'), ['quote " slash \\ slashquote \\"', 'serif']);
  });

  it('fails if a family has an unterminated string', () => {
    assert.throws(() => parse('"Unterminated, serif'));
  });

  it('handles unicode escape sequences', () => {
    assert.deepEqual(parse('"space\\20 between", serif'), ['space between', 'serif']);
  });

  it('swallows only the first space after a unicode escape', () => {
    assert.deepEqual(parse('"two-space\\20  between", serif'), ['two-space  between', 'serif']);
  });

  it('automatically ends the unicode escape after six digits', () => {
    assert.deepEqual(parse('space\\000020between, serif'), ['space between', 'serif']);
  });

  it('handles unicode escapes at the end of the family', () => {
    assert.deepEqual(parse('endswithbrace \\7b, serif'), ['endswithbrace {', 'serif']);
  });

  it('handles unicode escapes at the end of the input', () => {
    assert.deepEqual(parse('endswithbrace \\7b'), ['endswithbrace {']);
  });

  it('handles other escaped characters in identifiers', () => {
    assert.deepEqual(parse('has\\,comma'), ['has,comma']);
  });

  it('swallows escaped newlines in strings', () => {
    assert.deepEqual(parse('"multi \\\nline", serif'), ['multi line', 'serif']);
  });
});
