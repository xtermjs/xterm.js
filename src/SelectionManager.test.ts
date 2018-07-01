/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { CharMeasure } from './ui/CharMeasure';
import { SelectionManager, SelectionMode } from './SelectionManager';
import { SelectionModel } from './SelectionModel';
import { BufferSet } from './BufferSet';
import { LineData, CharData, ITerminal, IBuffer } from './Types';
import { MockTerminal } from './utils/TestUtils.test';

class TestMockTerminal extends MockTerminal {
  emit(event: string, data: any): void {}
}

class TestSelectionManager extends SelectionManager {
  constructor(
    terminal: ITerminal,
    charMeasure: CharMeasure
  ) {
    super(terminal, charMeasure);
  }

  public get model(): SelectionModel { return this._model; }

  public set selectionMode(mode: SelectionMode) { this._activeSelectionMode = mode; }

  public selectLineAt(line: number): void { this._selectLineAt(line); }
  public selectWordAt(coords: [number, number]): void { this._selectWordAt(coords, true); }

  // Disable DOM interaction
  public enable(): void {}
  public disable(): void {}
  public refresh(): void {}
}

describe('SelectionManager', () => {
  let terminal: ITerminal;
  let buffer: IBuffer;
  let selectionManager: TestSelectionManager;

  beforeEach(() => {
    terminal = new TestMockTerminal();
    terminal.cols = 80;
    terminal.rows = 2;
    terminal.options.scrollback = 100;
    terminal.buffers = new BufferSet(terminal);
    terminal.buffer = terminal.buffers.active;
    buffer = terminal.buffer;
    selectionManager = new TestSelectionManager(terminal, null);
  });

  function stringToRow(text: string): LineData {
    const result: LineData = [];
    for (let i = 0; i < text.length; i++) {
      result.push([0, text.charAt(i), 1, text.charCodeAt(i)]);
    }
    return result;
  }

  function stringArrayToRow(chars: string[]): LineData {
    return chars.map(c => <CharData>[0, c, 1, c.charCodeAt(0)]);
  }

  describe('_selectWordAt', () => {
    it('should expand selection for normal width chars', () => {
      buffer.lines.set(0, stringToRow('foo bar'));
      selectionManager.selectWordAt([0, 0]);
      assert.equal(selectionManager.selectionText, 'foo');
      selectionManager.selectWordAt([1, 0]);
      assert.equal(selectionManager.selectionText, 'foo');
      selectionManager.selectWordAt([2, 0]);
      assert.equal(selectionManager.selectionText, 'foo');
      selectionManager.selectWordAt([3, 0]);
      assert.equal(selectionManager.selectionText, ' ');
      selectionManager.selectWordAt([4, 0]);
      assert.equal(selectionManager.selectionText, 'bar');
      selectionManager.selectWordAt([5, 0]);
      assert.equal(selectionManager.selectionText, 'bar');
      selectionManager.selectWordAt([6, 0]);
      assert.equal(selectionManager.selectionText, 'bar');
    });
    it('should expand selection for whitespace', () => {
      buffer.lines.set(0, stringToRow('a   b'));
      selectionManager.selectWordAt([0, 0]);
      assert.equal(selectionManager.selectionText, 'a');
      selectionManager.selectWordAt([1, 0]);
      assert.equal(selectionManager.selectionText, '   ');
      selectionManager.selectWordAt([2, 0]);
      assert.equal(selectionManager.selectionText, '   ');
      selectionManager.selectWordAt([3, 0]);
      assert.equal(selectionManager.selectionText, '   ');
      selectionManager.selectWordAt([4, 0]);
      assert.equal(selectionManager.selectionText, 'b');
    });
    it('should expand selection for wide characters', () => {
      // Wide characters use a special format
      buffer.lines.set(0, [
        [null, '中', 2, '中'.charCodeAt(0)],
        [null, '', 0, null],
        [null, '文', 2, '文'.charCodeAt(0)],
        [null, '', 0, null],
        [null, ' ', 1, ' '.charCodeAt(0)],
        [null, 'a', 1, 'a'.charCodeAt(0)],
        [null, '中', 2, '中'.charCodeAt(0)],
        [null, '', 0, null],
        [null, '文', 2, '文'.charCodeAt(0)],
        [null, '', 0, ''.charCodeAt(0)],
        [null, 'b', 1, 'b'.charCodeAt(0)],
        [null, ' ', 1, ' '.charCodeAt(0)],
        [null, 'f', 1, 'f'.charCodeAt(0)],
        [null, 'o', 1, 'o'.charCodeAt(0)],
        [null, 'o', 1, 'o'.charCodeAt(0)]
      ]);
      // Ensure wide characters take up 2 columns
      selectionManager.selectWordAt([0, 0]);
      assert.equal(selectionManager.selectionText, '中文');
      selectionManager.selectWordAt([1, 0]);
      assert.equal(selectionManager.selectionText, '中文');
      selectionManager.selectWordAt([2, 0]);
      assert.equal(selectionManager.selectionText, '中文');
      selectionManager.selectWordAt([3, 0]);
      assert.equal(selectionManager.selectionText, '中文');
      selectionManager.selectWordAt([4, 0]);
      assert.equal(selectionManager.selectionText, ' ');
      // Ensure wide characters work when wrapped in normal width characters
      selectionManager.selectWordAt([5, 0]);
      assert.equal(selectionManager.selectionText, 'a中文b');
      selectionManager.selectWordAt([6, 0]);
      assert.equal(selectionManager.selectionText, 'a中文b');
      selectionManager.selectWordAt([7, 0]);
      assert.equal(selectionManager.selectionText, 'a中文b');
      selectionManager.selectWordAt([8, 0]);
      assert.equal(selectionManager.selectionText, 'a中文b');
      selectionManager.selectWordAt([9, 0]);
      assert.equal(selectionManager.selectionText, 'a中文b');
      selectionManager.selectWordAt([10, 0]);
      assert.equal(selectionManager.selectionText, 'a中文b');
      selectionManager.selectWordAt([11, 0]);
      assert.equal(selectionManager.selectionText, ' ');
      // Ensure normal width characters work fine in a line containing wide characters
      selectionManager.selectWordAt([12, 0]);
      assert.equal(selectionManager.selectionText, 'foo');
      selectionManager.selectWordAt([13, 0]);
      assert.equal(selectionManager.selectionText, 'foo');
      selectionManager.selectWordAt([14, 0]);
      assert.equal(selectionManager.selectionText, 'foo');
    });
    it('should select up to non-path characters that are commonly adjacent to paths', () => {
      buffer.lines.set(0, stringToRow('(cd)[ef]{gh}\'ij"'));
      selectionManager.selectWordAt([0, 0]);
      assert.equal(selectionManager.selectionText, '(cd');
      selectionManager.selectWordAt([1, 0]);
      assert.equal(selectionManager.selectionText, 'cd');
      selectionManager.selectWordAt([2, 0]);
      assert.equal(selectionManager.selectionText, 'cd');
      selectionManager.selectWordAt([3, 0]);
      assert.equal(selectionManager.selectionText, 'cd)');
      selectionManager.selectWordAt([4, 0]);
      assert.equal(selectionManager.selectionText, '[ef');
      selectionManager.selectWordAt([5, 0]);
      assert.equal(selectionManager.selectionText, 'ef');
      selectionManager.selectWordAt([6, 0]);
      assert.equal(selectionManager.selectionText, 'ef');
      selectionManager.selectWordAt([7, 0]);
      assert.equal(selectionManager.selectionText, 'ef]');
      selectionManager.selectWordAt([8, 0]);
      assert.equal(selectionManager.selectionText, '{gh');
      selectionManager.selectWordAt([9, 0]);
      assert.equal(selectionManager.selectionText, 'gh');
      selectionManager.selectWordAt([10, 0]);
      assert.equal(selectionManager.selectionText, 'gh');
      selectionManager.selectWordAt([11, 0]);
      assert.equal(selectionManager.selectionText, 'gh}');
      selectionManager.selectWordAt([12, 0]);
      assert.equal(selectionManager.selectionText, '\'ij');
      selectionManager.selectWordAt([13, 0]);
      assert.equal(selectionManager.selectionText, 'ij');
      selectionManager.selectWordAt([14, 0]);
      assert.equal(selectionManager.selectionText, 'ij');
      selectionManager.selectWordAt([15, 0]);
      assert.equal(selectionManager.selectionText, 'ij"');
    });
    describe('emoji', () => {
      it('should treat a single emoji as a word when wrapped in spaces', () => {
        buffer.lines.set(0, stringToRow(' ⚽ a')); // The a is here to prevent the space being trimmed in selectionText
        selectionManager.selectWordAt([0, 0]);
        assert.equal(selectionManager.selectionText, ' ');
        selectionManager.selectWordAt([1, 0]);
        assert.equal(selectionManager.selectionText, '⚽');
        selectionManager.selectWordAt([2, 0]);
        assert.equal(selectionManager.selectionText, ' ');
      });
      it('should treat multiple emojis as a word when wrapped in spaces', () => {
        buffer.lines.set(0, stringToRow(' ⚽⚽ a')); // The a is here to prevent the space being trimmed in selectionText
        selectionManager.selectWordAt([0, 0]);
        assert.equal(selectionManager.selectionText, ' ');
        selectionManager.selectWordAt([1, 0]);
        assert.equal(selectionManager.selectionText, '⚽⚽');
        selectionManager.selectWordAt([2, 0]);
        assert.equal(selectionManager.selectionText, '⚽⚽');
        selectionManager.selectWordAt([3, 0]);
        assert.equal(selectionManager.selectionText, ' ');
      });
      it('should treat emojis using the zero-width-joiner as a single word', () => {
        // Note that the first 3 emojis include the invisible ZWJ char
        buffer.lines.set(0, stringArrayToRow([
          ' ', '👨‍', '👩‍', '👧‍', '👦', ' ', 'a'
        ])); // The a is here to prevent the space being trimmed in selectionText
        selectionManager.selectWordAt([0, 0]);
        assert.equal(selectionManager.selectionText, ' ');
        // ZWJ emojis do not combine in the terminal so the family emoji used here consumed 4 cells
        // The selection text should retain ZWJ chars despite not combining on the terminal
        selectionManager.selectWordAt([1, 0]);
        assert.equal(selectionManager.selectionText, '👨‍👩‍👧‍👦');
        selectionManager.selectWordAt([2, 0]);
        assert.equal(selectionManager.selectionText, '👨‍👩‍👧‍👦');
        selectionManager.selectWordAt([3, 0]);
        assert.equal(selectionManager.selectionText, '👨‍👩‍👧‍👦');
        selectionManager.selectWordAt([4, 0]);
        assert.equal(selectionManager.selectionText, '👨‍👩‍👧‍👦');
        selectionManager.selectWordAt([5, 0]);
        assert.equal(selectionManager.selectionText, ' ');
      });
      it('should treat emojis and characters joined together as a word', () => {
        buffer.lines.set(0, stringToRow(' ⚽ab cd⚽ ef⚽gh')); // The a is here to prevent the space being trimmed in selectionText
        selectionManager.selectWordAt([0, 0]);
        assert.equal(selectionManager.selectionText, ' ');
        selectionManager.selectWordAt([1, 0]);
        assert.equal(selectionManager.selectionText, '⚽ab');
        selectionManager.selectWordAt([2, 0]);
        assert.equal(selectionManager.selectionText, '⚽ab');
        selectionManager.selectWordAt([3, 0]);
        assert.equal(selectionManager.selectionText, '⚽ab');
        selectionManager.selectWordAt([4, 0]);
        assert.equal(selectionManager.selectionText, ' ');
        selectionManager.selectWordAt([5, 0]);
        assert.equal(selectionManager.selectionText, 'cd⚽');
        selectionManager.selectWordAt([6, 0]);
        assert.equal(selectionManager.selectionText, 'cd⚽');
        selectionManager.selectWordAt([7, 0]);
        assert.equal(selectionManager.selectionText, 'cd⚽');
        selectionManager.selectWordAt([8, 0]);
        assert.equal(selectionManager.selectionText, ' ');
        selectionManager.selectWordAt([9, 0]);
        assert.equal(selectionManager.selectionText, 'ef⚽gh');
        selectionManager.selectWordAt([10, 0]);
        assert.equal(selectionManager.selectionText, 'ef⚽gh');
        selectionManager.selectWordAt([11, 0]);
        assert.equal(selectionManager.selectionText, 'ef⚽gh');
        selectionManager.selectWordAt([12, 0]);
        assert.equal(selectionManager.selectionText, 'ef⚽gh');
        selectionManager.selectWordAt([13, 0]);
        assert.equal(selectionManager.selectionText, 'ef⚽gh');
      });
      it('should treat complex emojis and characters joined together as a word', () => {
        // This emoji is the flag for England and is made up of: 1F3F4 E0067 E0062 E0065 E006E E0067 E007F
        buffer.lines.set(0, stringArrayToRow([
          ' ', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'a', 'b', ' ', 'c', 'd', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ' ', 'e', 'f', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'g', 'h', ' ', 'a'
        ])); // The a is here to prevent the space being trimmed in selectionText
        selectionManager.selectWordAt([0, 0]);
        assert.equal(selectionManager.selectionText, ' ');
        selectionManager.selectWordAt([1, 0]);
        assert.equal(selectionManager.selectionText, '🏴󠁧󠁢󠁥󠁮󠁧󠁿ab');
        selectionManager.selectWordAt([2, 0]);
        assert.equal(selectionManager.selectionText, '🏴󠁧󠁢󠁥󠁮󠁧󠁿ab');
        selectionManager.selectWordAt([3, 0]);
        assert.equal(selectionManager.selectionText, '🏴󠁧󠁢󠁥󠁮󠁧󠁿ab');
        selectionManager.selectWordAt([4, 0]);
        assert.equal(selectionManager.selectionText, ' ');
        selectionManager.selectWordAt([5, 0]);
        assert.equal(selectionManager.selectionText, 'cd🏴󠁧󠁢󠁥󠁮󠁧󠁿');
        selectionManager.selectWordAt([6, 0]);
        assert.equal(selectionManager.selectionText, 'cd🏴󠁧󠁢󠁥󠁮󠁧󠁿');
        selectionManager.selectWordAt([7, 0]);
        assert.equal(selectionManager.selectionText, 'cd🏴󠁧󠁢󠁥󠁮󠁧󠁿');
        selectionManager.selectWordAt([8, 0]);
        assert.equal(selectionManager.selectionText, ' ');
        selectionManager.selectWordAt([9, 0]);
        assert.equal(selectionManager.selectionText, 'ef🏴󠁧󠁢󠁥󠁮󠁧󠁿gh');
        selectionManager.selectWordAt([10, 0]);
        assert.equal(selectionManager.selectionText, 'ef🏴󠁧󠁢󠁥󠁮󠁧󠁿gh');
        selectionManager.selectWordAt([11, 0]);
        assert.equal(selectionManager.selectionText, 'ef🏴󠁧󠁢󠁥󠁮󠁧󠁿gh');
        selectionManager.selectWordAt([12, 0]);
        assert.equal(selectionManager.selectionText, 'ef🏴󠁧󠁢󠁥󠁮󠁧󠁿gh');
        selectionManager.selectWordAt([13, 0]);
        assert.equal(selectionManager.selectionText, 'ef🏴󠁧󠁢󠁥󠁮󠁧󠁿gh');
      });
    });
  });

  describe('_selectLineAt', () => {
    it('should select the entire line', () => {
      buffer.lines.set(0, stringToRow('foo bar'));
      selectionManager.selectLineAt(0);
      assert.equal(selectionManager.selectionText, 'foo bar', 'The selected text is correct');
      assert.deepEqual(selectionManager.model.finalSelectionStart, [0, 0]);
      assert.deepEqual(selectionManager.model.finalSelectionEnd, [terminal.cols, 0], 'The actual selection spans the entire column');
    });
    it('should select the entire wrapped line', () => {
      buffer.lines.set(0, stringToRow('foo'));
      const line2 = stringToRow('bar');
      (<any>line2).isWrapped = true;
      buffer.lines.set(1, line2);
      selectionManager.selectLineAt(0);
      assert.equal(selectionManager.selectionText, 'foobar', 'The selected text is correct');
      assert.deepEqual(selectionManager.model.finalSelectionStart, [0, 0]);
      assert.deepEqual(selectionManager.model.finalSelectionEnd, [terminal.cols, 1], 'The actual selection spans the entire column');
    });
  });

  describe('selectAll', () => {
    it('should select the entire buffer, beyond the viewport', () => {
      buffer.lines.length = 5;
      buffer.lines.set(0, stringToRow('1'));
      buffer.lines.set(1, stringToRow('2'));
      buffer.lines.set(2, stringToRow('3'));
      buffer.lines.set(3, stringToRow('4'));
      buffer.lines.set(4, stringToRow('5'));
      selectionManager.selectAll();
      terminal.buffer.ybase = buffer.lines.length - terminal.rows;
      assert.equal(selectionManager.selectionText, '1\n2\n3\n4\n5');
    });
  });

  describe('selectLines', () => {
    it('should select a single line', () => {
      buffer.lines.length = 3;
      buffer.lines.set(0, stringToRow('1'));
      buffer.lines.set(1, stringToRow('2'));
      buffer.lines.set(2, stringToRow('3'));
      selectionManager.selectLines(1, 1);
      assert.deepEqual(selectionManager.model.finalSelectionStart, [0, 1]);
      assert.deepEqual(selectionManager.model.finalSelectionEnd, [terminal.cols, 1]);
    });
    it('should select multiple lines', () => {
      buffer.lines.length = 5;
      buffer.lines.set(0, stringToRow('1'));
      buffer.lines.set(1, stringToRow('2'));
      buffer.lines.set(2, stringToRow('3'));
      buffer.lines.set(3, stringToRow('4'));
      buffer.lines.set(4, stringToRow('5'));
      selectionManager.selectLines(1, 3);
      assert.deepEqual(selectionManager.model.finalSelectionStart, [0, 1]);
      assert.deepEqual(selectionManager.model.finalSelectionEnd, [terminal.cols, 3]);
    });
    it('should select the to the start when requesting a negative row', () => {
      buffer.lines.length = 2;
      buffer.lines.set(0, stringToRow('1'));
      buffer.lines.set(1, stringToRow('2'));
      selectionManager.selectLines(-1, 0);
      assert.deepEqual(selectionManager.model.finalSelectionStart, [0, 0]);
      assert.deepEqual(selectionManager.model.finalSelectionEnd, [terminal.cols, 0]);
    });
    it('should select the to the end when requesting beyond the final row', () => {
      buffer.lines.length = 2;
      buffer.lines.set(0, stringToRow('1'));
      buffer.lines.set(1, stringToRow('2'));
      selectionManager.selectLines(1, 2);
      assert.deepEqual(selectionManager.model.finalSelectionStart, [0, 1]);
      assert.deepEqual(selectionManager.model.finalSelectionEnd, [terminal.cols, 1]);
    });
  });

  describe('hasSelection', () => {
    it('should return whether there is a selection', () => {
      selectionManager.model.selectionStart = [0, 0];
      selectionManager.model.selectionStartLength = 0;
      assert.equal(selectionManager.hasSelection, false);
      selectionManager.model.selectionEnd = [0, 0];
      assert.equal(selectionManager.hasSelection, false);
      selectionManager.model.selectionEnd = [1, 0];
      assert.equal(selectionManager.hasSelection, true);
      selectionManager.model.selectionEnd = [0, 1];
      assert.equal(selectionManager.hasSelection, true);
      selectionManager.model.selectionEnd = [1, 1];
      assert.equal(selectionManager.hasSelection, true);
    });
  });

  describe('column selection', () => {
    it('should select a column of text', () => {
      buffer.lines.length = 3;
      buffer.lines.set(0, stringToRow('abcdefghij'));
      buffer.lines.set(1, stringToRow('klmnopqrst'));
      buffer.lines.set(2, stringToRow('uvwxyz'));

      selectionManager.selectionMode = SelectionMode.COLUMN;
      selectionManager.model.selectionStart = [2, 0];
      selectionManager.model.selectionEnd = [4, 2];

      assert.equal(selectionManager.selectionText, 'cd\nmn\nwx');
    });

    it('should select a column of text without chopping up double width characters', () => {
      buffer.lines.length = 3;
      buffer.lines.set(0, stringToRow('a'));
      buffer.lines.set(1, stringToRow('語'));
      buffer.lines.set(2, stringToRow('b'));

      selectionManager.selectionMode = SelectionMode.COLUMN;
      selectionManager.model.selectionStart = [0, 0];
      selectionManager.model.selectionEnd = [1, 2];

      assert.equal(selectionManager.selectionText, 'a\n語\nb');
    });

    it('should select a column of text with single character emojis', () => {
      buffer.lines.length = 3;
      buffer.lines.set(0, stringToRow('a'));
      buffer.lines.set(1, stringToRow('☃'));
      buffer.lines.set(2, stringToRow('c'));

      selectionManager.selectionMode = SelectionMode.COLUMN;
      selectionManager.model.selectionStart = [0, 0];
      selectionManager.model.selectionEnd = [1, 2];

      assert.equal(selectionManager.selectionText, 'a\n☃\nc');
    });

    it('should select a column of text with double character emojis', () => {
      // TODO the case this is testing works for me in the demo webapp,
      // but doing it programmatically fails.
      buffer.lines.length = 3;
      buffer.lines.set(0, stringToRow('a '));
      buffer.lines.set(1, stringArrayToRow(['😁', ' ']));
      buffer.lines.set(2, stringToRow('c '));

      selectionManager.selectionMode = SelectionMode.COLUMN;
      selectionManager.model.selectionStart = [0, 0];
      selectionManager.model.selectionEnd = [1, 2];

      assert.equal(selectionManager.selectionText, 'a\n😁\nc');
    });
  });
});

