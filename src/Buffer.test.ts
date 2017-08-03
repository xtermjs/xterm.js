/**
 * @license MIT
 */
import { assert } from 'chai';
import { ITerminal } from './Interfaces';
import { Buffer } from './Buffer';
import { CircularList } from './utils/CircularList';

describe('Buffer', () => {
  let terminal: ITerminal;
  let buffer: Buffer;

  beforeEach(() => {
    terminal = <any>{
      cols: 80,
      rows: 24,
      scrollback: 1000,
      blankLine: function() {}
    };
    buffer = new Buffer(terminal);
  });

  describe('constructor', () => {
    it('should create a CircularList with max length equal to scrollback, for its lines', () => {
      assert.instanceOf(buffer.lines, CircularList);
      assert.equal(buffer.lines.maxLength, terminal.scrollback);
    });
    it('should set the Buffer\'s scrollBottom value equal to the terminal\'s rows -1', () => {
      assert.equal(buffer.scrollBottom, terminal.rows - 1);
    });
  });
});
