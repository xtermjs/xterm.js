/**
 * @license MIT
 */
import jsdom = require('jsdom');
import { assert } from 'chai';
import { ITerminal, ICircularList } from './Interfaces';
import { CharMeasure } from './utils/CharMeasure';
import { CircularList } from './utils/CircularList';
import { SelectionManager } from './SelectionManager';
import { SelectionModel } from './SelectionModel';
import { BufferSet } from './BufferSet';
import { MockTerminal } from './utils/TestUtils';

class TestSelectionManager extends SelectionManager {
  constructor(
    terminal: ITerminal,
    buffer: ICircularList<[number, string, number][]>,
    rowContainer: HTMLElement,
    charMeasure: CharMeasure
  ) {
    super(terminal, buffer, rowContainer, charMeasure);
  }

  public get model(): SelectionModel { return this._model; }

  public selectLineAt(line: number): void { this._selectLineAt(line); }
  public selectWordAt(coords: [number, number]): void { this._selectWordAt(coords); }

  // Disable DOM interaction
  public enable(): void {}
  public disable(): void {}
  public refresh(): void {}
}

describe('SelectionManager', () => {
  let dom: jsdom.JSDOM;
  let window: Window;
  let document: Document;

  let terminal: ITerminal;
  let bufferLines: ICircularList<[number, string, number][]>;
  let rowContainer: HTMLElement;
  let selectionManager: TestSelectionManager;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    window = dom.window;
    document = window.document;
    rowContainer = document.createElement('div');
    terminal = new MockTerminal();
    terminal.cols = 80;
    terminal.rows = 2;
    terminal.scrollback = 100;
    terminal.buffers = new BufferSet(terminal);
    terminal.buffer = terminal.buffers.active;
    bufferLines = terminal.buffer.lines;
    selectionManager = new TestSelectionManager(terminal, bufferLines, rowContainer, null);
  });

  function stringToRow(text: string): [number, string, number][] {
    let result: [number, string, number][] = [];
    for (let i = 0; i < text.length; i++) {
      result.push([0, text.charAt(i), 1]);
    }
    return result;
  }

  describe('_selectWordAt', () => {
    it('should expand selection for normal width chars', () => {
      bufferLines.set(0, stringToRow('foo bar'));
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
      bufferLines.set(0, stringToRow('a   b'));
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
      bufferLines.set(0, [
        [null, '中', 2],
        [null, '', 0],
        [null, '文', 2],
        [null, '', 0],
        [null, ' ', 1],
        [null, 'a', 1],
        [null, '中', 2],
        [null, '', 0],
        [null, '文', 2],
        [null, '', 0],
        [null, 'b', 1],
        [null, ' ', 1],
        [null, 'f', 1],
        [null, 'o', 1],
        [null, 'o', 1]
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
      bufferLines.set(0, stringToRow('(cd)[ef]{gh}\'ij"'));
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
  });

  describe('_selectLineAt', () => {
    it('should select the entire line', () => {
      bufferLines.set(0, stringToRow('foo bar'));
      selectionManager.selectLineAt(0);
      assert.equal(selectionManager.selectionText, 'foo bar', 'The selected text is correct');
      assert.deepEqual(selectionManager.model.finalSelectionStart, [0, 0]);
      assert.deepEqual(selectionManager.model.finalSelectionEnd, [terminal.cols, 0], 'The actual selection spans the entire column');
    });
  });

  describe('selectAll', () => {
    it('should select the entire buffer, beyond the viewport', () => {
      bufferLines.length = 5;
      bufferLines.set(0, stringToRow('1'));
      bufferLines.set(1, stringToRow('2'));
      bufferLines.set(2, stringToRow('3'));
      bufferLines.set(3, stringToRow('4'));
      bufferLines.set(4, stringToRow('5'));
      selectionManager.selectAll();
      terminal.buffer.ybase = bufferLines.length - terminal.rows;
      assert.equal(selectionManager.selectionText, '1\n2\n3\n4\n5');
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
});
