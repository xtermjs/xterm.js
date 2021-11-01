/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { InputHandler } from 'common/InputHandler';
import { IBufferLine, IAttributeData, IAnsiColorChangeEvent } from 'common/Types';
import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { CellData } from 'common/buffer/CellData';
import { Attributes, UnderlineStyle } from 'common/buffer/Constants';
import { AttributeData } from 'common/buffer/AttributeData';
import { Params } from 'common/parser/Params';
import { MockCoreService, MockBufferService, MockDirtyRowService, MockOptionsService, MockLogService, MockCoreMouseService, MockCharsetService, MockUnicodeService } from 'common/TestUtils.test';
import { IBufferService, ICoreService } from 'common/services/Services';
import { DEFAULT_OPTIONS } from 'common/services/OptionsService';
import { clone } from 'common/Clone';
import { BufferService } from 'common/services/BufferService';
import { CoreService } from 'common/services/CoreService';
import { OscHandler } from 'common/parser/OscParser';

function getCursor(bufferService: IBufferService): number[] {
  return [
    bufferService.buffer.x,
    bufferService.buffer.y
  ];
}

function getLines(bufferService: IBufferService, limit: number = bufferService.rows): string[] {
  const res: string[] = [];
  for (let i = 0; i < limit; ++i) {
    const line = bufferService.buffer.lines.get(i);
    if (line) {
      res.push(line.translateToString(true));
    }
  }
  return res;
}

class TestInputHandler extends InputHandler {
  public get curAttrData(): IAttributeData { return (this as any)._curAttrData; }
  public get windowTitleStack(): string[] { return this._windowTitleStack; }
  public get iconNameStack(): string[] { return this._iconNameStack; }
  public parseAnsiColorChange(data: string): IAnsiColorChangeEvent | null { return this._parseAnsiColorChange(data); }

  /**
   * Promise based parse call to await the full resolve of given input data.
   * This is useful to test async handlers in inputhandler directly.
   */
  public async parseP(data: string | Uint8Array): Promise<void> {
    let result: Promise<boolean> | void;
    let prev: boolean | undefined;
    while (result = this.parse(data, prev)) {
      prev = await result;
    }
  }
}

describe('InputHandler', () => {
  let bufferService: IBufferService;
  let coreService: ICoreService;
  let optionsService: MockOptionsService;
  let inputHandler: TestInputHandler;

  beforeEach(() => {
    optionsService = new MockOptionsService();
    bufferService = new BufferService(optionsService);
    bufferService.resize(80, 30);
    coreService = new CoreService(() => { }, bufferService, new MockLogService(), optionsService);

    inputHandler = new TestInputHandler(bufferService, new MockCharsetService(), coreService, new MockDirtyRowService(), new MockLogService(), optionsService, new MockCoreMouseService(), new MockUnicodeService());
  });

  describe('SL/SR/DECIC/DECDC', () => {
    beforeEach(() => {
      bufferService.resize(5, 5);
      optionsService.options.scrollback = 1;
      bufferService.reset();
    });
    it('SL (scrollLeft)', async () => {
      await inputHandler.parseP('12345'.repeat(6));
      await inputHandler.parseP('\x1b[ @');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '2345', '2345', '2345', '2345', '2345']);
      await inputHandler.parseP('\x1b[0 @');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '345', '345', '345', '345', '345']);
      await inputHandler.parseP('\x1b[2 @');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '5', '5', '5', '5', '5']);
    });
    it('SR (scrollRight)', async () => {
      await inputHandler.parseP('12345'.repeat(6));
      await inputHandler.parseP('\x1b[ A');
      assert.deepEqual(getLines(bufferService, 6), ['12345', ' 1234', ' 1234', ' 1234', ' 1234', ' 1234']);
      await inputHandler.parseP('\x1b[0 A');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '  123', '  123', '  123', '  123', '  123']);
      await inputHandler.parseP('\x1b[2 A');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '    1', '    1', '    1', '    1', '    1']);
    });
    it('insertColumns (DECIC)', async () => {
      await inputHandler.parseP('12345'.repeat(6));
      await inputHandler.parseP('\x1b[3;3H');
      await inputHandler.parseP('\x1b[\'}');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '12 34', '12 34', '12 34', '12 34', '12 34']);
      bufferService.reset();
      await inputHandler.parseP('12345'.repeat(6));
      await inputHandler.parseP('\x1b[3;3H');
      await inputHandler.parseP('\x1b[1\'}');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '12 34', '12 34', '12 34', '12 34', '12 34']);
      bufferService.reset();
      await inputHandler.parseP('12345'.repeat(6));
      await inputHandler.parseP('\x1b[3;3H');
      await inputHandler.parseP('\x1b[2\'}');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '12  3', '12  3', '12  3', '12  3', '12  3']);
    });
    it('deleteColumns (DECDC)', async () => {
      await inputHandler.parseP('12345'.repeat(6));
      await inputHandler.parseP('\x1b[3;3H');
      await inputHandler.parseP('\x1b[\'~');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '1245', '1245', '1245', '1245', '1245']);
      bufferService.reset();
      await inputHandler.parseP('12345'.repeat(6));
      await inputHandler.parseP('\x1b[3;3H');
      await inputHandler.parseP('\x1b[1\'~');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '1245', '1245', '1245', '1245', '1245']);
      bufferService.reset();
      await inputHandler.parseP('12345'.repeat(6));
      await inputHandler.parseP('\x1b[3;3H');
      await inputHandler.parseP('\x1b[2\'~');
      assert.deepEqual(getLines(bufferService, 6), ['12345', '125', '125', '125', '125', '125']);
    });
  });

  describe('BS with reverseWraparound set/unset', () => {
    const ttyBS = '\x08 \x08';  // tty ICANON sends <BS SP BS> on pressing BS
    beforeEach(() => {
      bufferService.resize(5, 5);
      optionsService.options.scrollback = 1;
      bufferService.reset();
    });
    describe('reverseWraparound set', () => {
      it('should not reverse outside of scroll margins', async () => {
        // prepare buffer content
        await inputHandler.parseP('#####abcdefghijklmnopqrstuvwxy');
        assert.deepEqual(getLines(bufferService, 6), ['#####', 'abcde', 'fghij', 'klmno', 'pqrst', 'uvwxy']);
        assert.equal(bufferService.buffers.active.ydisp, 1);
        assert.equal(bufferService.buffers.active.x, 5);
        assert.equal(bufferService.buffers.active.y, 4);
        await inputHandler.parseP(ttyBS.repeat(100));
        assert.deepEqual(getLines(bufferService, 6), ['#####', 'abcde', 'fghij', 'klmno', 'pqrst', '    y']);

        await inputHandler.parseP('\x1b[?45h');
        await inputHandler.parseP('uvwxy');

        // set top/bottom to 1/3 (0-based)
        await inputHandler.parseP('\x1b[2;4r');
        // place cursor below scroll bottom
        bufferService.buffers.active.x = 5;
        bufferService.buffers.active.y = 4;
        await inputHandler.parseP(ttyBS.repeat(100));
        assert.deepEqual(getLines(bufferService, 6), ['#####', 'abcde', 'fghij', 'klmno', 'pqrst', '     ']);

        await inputHandler.parseP('uvwxy');
        // place cursor within scroll margins
        bufferService.buffers.active.x = 5;
        bufferService.buffers.active.y = 3;
        await inputHandler.parseP(ttyBS.repeat(100));
        assert.deepEqual(getLines(bufferService, 6), ['#####', 'abcde', '     ', '     ', '     ', 'uvwxy']);
        assert.equal(bufferService.buffers.active.x, 0);
        assert.equal(bufferService.buffers.active.y, bufferService.buffers.active.scrollTop);  // stops at 0, scrollTop

        await inputHandler.parseP('fghijklmnopqrst');
        // place cursor above scroll top
        bufferService.buffers.active.x = 5;
        bufferService.buffers.active.y = 0;
        await inputHandler.parseP(ttyBS.repeat(100));
        assert.deepEqual(getLines(bufferService, 6), ['#####', '     ', 'fghij', 'klmno', 'pqrst', 'uvwxy']);
      });
    });
  });

  it('save and restore cursor', () => {
    bufferService.buffer.x = 1;
    bufferService.buffer.y = 2;
    bufferService.buffer.ybase = 0;
    inputHandler.curAttrData.fg = 3;
    // Save cursor position
    inputHandler.saveCursor();
    assert.equal(bufferService.buffer.x, 1);
    assert.equal(bufferService.buffer.y, 2);
    assert.equal(inputHandler.curAttrData.fg, 3);
    // Change cursor position
    bufferService.buffer.x = 10;
    bufferService.buffer.y = 20;
    inputHandler.curAttrData.fg = 30;
    // Restore cursor position
    inputHandler.restoreCursor();
    assert.equal(bufferService.buffer.x, 1);
    assert.equal(bufferService.buffer.y, 2);
    assert.equal(inputHandler.curAttrData.fg, 3);
  });
  describe('setCursorStyle', () => {
    it('should call Terminal.setOption with correct params', () => {
      inputHandler.setCursorStyle(Params.fromArray([0]));
      assert.equal(optionsService.options['cursorStyle'], 'block');
      assert.equal(optionsService.options['cursorBlink'], true);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([1]));
      assert.equal(optionsService.options['cursorStyle'], 'block');
      assert.equal(optionsService.options['cursorBlink'], true);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([2]));
      assert.equal(optionsService.options['cursorStyle'], 'block');
      assert.equal(optionsService.options['cursorBlink'], false);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([3]));
      assert.equal(optionsService.options['cursorStyle'], 'underline');
      assert.equal(optionsService.options['cursorBlink'], true);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([4]));
      assert.equal(optionsService.options['cursorStyle'], 'underline');
      assert.equal(optionsService.options['cursorBlink'], false);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([5]));
      assert.equal(optionsService.options['cursorStyle'], 'bar');
      assert.equal(optionsService.options['cursorBlink'], true);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([6]));
      assert.equal(optionsService.options['cursorStyle'], 'bar');
      assert.equal(optionsService.options['cursorBlink'], false);
    });
  });
  describe('setMode', () => {
    it('should toggle bracketedPasteMode', () => {
      const coreService = new MockCoreService();
      const inputHandler = new TestInputHandler(new MockBufferService(80, 30), new MockCharsetService(), coreService, new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService());
      // Set bracketed paste mode
      inputHandler.setModePrivate(Params.fromArray([2004]));
      assert.equal(coreService.decPrivateModes.bracketedPasteMode, true);
      // Reset bracketed paste mode
      inputHandler.resetModePrivate(Params.fromArray([2004]));
      assert.equal(coreService.decPrivateModes.bracketedPasteMode, false);
    });
  });
  describe('regression tests', function (): void {
    function termContent(bufferService: IBufferService, trim: boolean): string[] {
      const result = [];
      for (let i = 0; i < bufferService.rows; ++i) result.push(bufferService.buffer.lines.get(i)!.translateToString(trim));
      return result;
    }

    it('insertChars', async () => {
      const bufferService = new MockBufferService(80, 30);
      const inputHandler = new TestInputHandler(
        bufferService,
        new MockCharsetService(),
        new MockCoreService(),
        new MockDirtyRowService(),
        new MockLogService(),
        new MockOptionsService(),
        new MockCoreMouseService(),
        new MockUnicodeService()
      );

      // insert some data in first and second line
      await inputHandler.parseP(Array(bufferService.cols - 9).join('a'));
      await inputHandler.parseP('1234567890');
      await inputHandler.parseP(Array(bufferService.cols - 9).join('a'));
      await inputHandler.parseP('1234567890');
      const line1: IBufferLine = bufferService.buffer.lines.get(0)!;
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + '1234567890');

      // insert one char from params = [0]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([0]));
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + ' 123456789');

      // insert one char from params = [1]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([1]));
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + '  12345678');

      // insert two chars from params = [2]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([2]));
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + '    123456');

      // insert 10 chars from params = [10]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([10]));
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + '          ');
      assert.equal(line1.translateToString(true), Array(bufferService.cols - 9).join('a'));
    });
    it('deleteChars', async () => {
      const bufferService = new MockBufferService(80, 30);
      const inputHandler = new TestInputHandler(
        bufferService,
        new MockCharsetService(),
        new MockCoreService(),
        new MockDirtyRowService(),
        new MockLogService(),
        new MockOptionsService(),
        new MockCoreMouseService(),
        new MockUnicodeService()
      );

      // insert some data in first and second line
      await inputHandler.parseP(Array(bufferService.cols - 9).join('a'));
      await inputHandler.parseP('1234567890');
      await inputHandler.parseP(Array(bufferService.cols - 9).join('a'));
      await inputHandler.parseP('1234567890');
      const line1: IBufferLine = bufferService.buffer.lines.get(0)!;
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + '1234567890');

      // delete one char from params = [0]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([0]));
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + '234567890 ');
      assert.equal(line1.translateToString(true), Array(bufferService.cols - 9).join('a') + '234567890');

      // insert one char from params = [1]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([1]));
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + '34567890  ');
      assert.equal(line1.translateToString(true), Array(bufferService.cols - 9).join('a') + '34567890');

      // insert two chars from params = [2]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([2]));
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + '567890    ');
      assert.equal(line1.translateToString(true), Array(bufferService.cols - 9).join('a') + '567890');


      // insert 10 chars from params = [10]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([10]));
      assert.equal(line1.translateToString(false), Array(bufferService.cols - 9).join('a') + '          ');
      assert.equal(line1.translateToString(true), Array(bufferService.cols - 9).join('a'));
    });
    it('eraseInLine', async () => {
      const bufferService = new MockBufferService(80, 30);
      const inputHandler = new TestInputHandler(
        bufferService,
        new MockCharsetService(),
        new MockCoreService(),
        new MockDirtyRowService(),
        new MockLogService(),
        new MockOptionsService(),
        new MockCoreMouseService(),
        new MockUnicodeService()
      );

      // fill 6 lines to test 3 different states
      await inputHandler.parseP(Array(bufferService.cols + 1).join('a'));
      await inputHandler.parseP(Array(bufferService.cols + 1).join('a'));
      await inputHandler.parseP(Array(bufferService.cols + 1).join('a'));

      // params[0] - right erase
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.eraseInLine(Params.fromArray([0]));
      assert.equal(bufferService.buffer.lines.get(0)!.translateToString(false), Array(71).join('a') + '          ');

      // params[1] - left erase
      bufferService.buffer.y = 1;
      bufferService.buffer.x = 70;
      inputHandler.eraseInLine(Params.fromArray([1]));
      assert.equal(bufferService.buffer.lines.get(1)!.translateToString(false), Array(71).join(' ') + ' aaaaaaaaa');

      // params[1] - left erase
      bufferService.buffer.y = 2;
      bufferService.buffer.x = 70;
      inputHandler.eraseInLine(Params.fromArray([2]));
      assert.equal(bufferService.buffer.lines.get(2)!.translateToString(false), Array(bufferService.cols + 1).join(' '));

    });
    it('eraseInLine reflow', async () => {
      const bufferService = new MockBufferService(80, 30);
      const inputHandler = new TestInputHandler(
        bufferService,
        new MockCharsetService(),
        new MockCoreService(),
        new MockDirtyRowService(),
        new MockLogService(),
        new MockOptionsService(),
        new MockCoreMouseService(),
        new MockUnicodeService()
      );

      const resetToBaseState = async (): Promise<void> => {
        // reset and add a wrapped line
        bufferService.buffer.y = 0;
        bufferService.buffer.x = 0;
        await inputHandler.parseP(Array(bufferService.cols + 1).join('a')); // line 0
        await inputHandler.parseP(Array(bufferService.cols + 10).join('a')); // line 1 and 2
        for (let i = 3; i < bufferService.rows; ++i) await inputHandler.parseP(Array(bufferService.cols + 1).join('a'));

        // confirm precondition that line 2 is wrapped
        assert.equal(bufferService.buffer.lines.get(2)!.isWrapped, true);
      };

      // params[0] - erase from the cursor through the end of the row.
      await resetToBaseState();
      bufferService.buffer.y = 2;
      bufferService.buffer.x = 40;
      inputHandler.eraseInLine(Params.fromArray([0]));
      assert.equal(bufferService.buffer.lines.get(2)!.isWrapped, true);
      bufferService.buffer.y = 2;
      bufferService.buffer.x = 0;
      inputHandler.eraseInLine(Params.fromArray([0]));
      assert.equal(bufferService.buffer.lines.get(2)!.isWrapped, false);

      // params[1] - erase from the beginning of the line through the cursor
      await resetToBaseState();
      bufferService.buffer.y = 2;
      bufferService.buffer.x = 40;
      inputHandler.eraseInLine(Params.fromArray([1]));
      assert.equal(bufferService.buffer.lines.get(2)!.isWrapped, true);

      // params[2] - erase complete line
      await resetToBaseState();
      bufferService.buffer.y = 2;
      bufferService.buffer.x = 40;
      inputHandler.eraseInLine(Params.fromArray([2]));
      assert.equal(bufferService.buffer.lines.get(2)!.isWrapped, false);
    });
    it('eraseInDisplay', async () => {
      const bufferService = new MockBufferService(80, 7);
      const inputHandler = new TestInputHandler(
        bufferService,
        new MockCharsetService(),
        new MockCoreService(),
        new MockDirtyRowService(),
        new MockLogService(),
        new MockOptionsService(),
        new MockCoreMouseService(),
        new MockUnicodeService()
      );

      // fill display with a's
      for (let i = 0; i < bufferService.rows; ++i) await inputHandler.parseP(Array(bufferService.cols + 1).join('a'));

      // params [0] - right and below erase
      bufferService.buffer.y = 5;
      bufferService.buffer.x = 40;
      inputHandler.eraseInDisplay(Params.fromArray([0]));
      assert.deepEqual(termContent(bufferService, false), [
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(40 + 1).join('a') + Array(bufferService.cols - 40 + 1).join(' '),
        Array(bufferService.cols + 1).join(' ')
      ]);
      assert.deepEqual(termContent(bufferService, true), [
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(40 + 1).join('a'),
        ''
      ]);

      // reset
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 0;
      for (let i = 0; i < bufferService.rows; ++i) await inputHandler.parseP(Array(bufferService.cols + 1).join('a'));

      // params [1] - left and above
      bufferService.buffer.y = 5;
      bufferService.buffer.x = 40;
      inputHandler.eraseInDisplay(Params.fromArray([1]));
      assert.deepEqual(termContent(bufferService, false), [
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(41 + 1).join(' ') + Array(bufferService.cols - 41 + 1).join('a'),
        Array(bufferService.cols + 1).join('a')
      ]);
      assert.deepEqual(termContent(bufferService, true), [
        '',
        '',
        '',
        '',
        '',
        Array(41 + 1).join(' ') + Array(bufferService.cols - 41 + 1).join('a'),
        Array(bufferService.cols + 1).join('a')
      ]);

      // reset
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 0;
      for (let i = 0; i < bufferService.rows; ++i) await inputHandler.parseP(Array(bufferService.cols + 1).join('a'));

      // params [2] - whole screen
      bufferService.buffer.y = 5;
      bufferService.buffer.x = 40;
      inputHandler.eraseInDisplay(Params.fromArray([2]));
      assert.deepEqual(termContent(bufferService, false), [
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' ')
      ]);
      assert.deepEqual(termContent(bufferService, true), [
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]);

      // reset and add a wrapped line
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 0;
      await inputHandler.parseP(Array(bufferService.cols + 1).join('a')); // line 0
      await inputHandler.parseP(Array(bufferService.cols + 10).join('a')); // line 1 and 2
      for (let i = 3; i < bufferService.rows; ++i) await inputHandler.parseP(Array(bufferService.cols + 1).join('a'));

      // params[1] left and above with wrap
      // confirm precondition that line 2 is wrapped
      assert.equal(bufferService.buffer.lines.get(2)!.isWrapped, true);
      bufferService.buffer.y = 2;
      bufferService.buffer.x = 40;
      inputHandler.eraseInDisplay(Params.fromArray([1]));
      assert.equal(bufferService.buffer.lines.get(2)!.isWrapped, false);

      // reset and add a wrapped line
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 0;
      await inputHandler.parseP(Array(bufferService.cols + 1).join('a')); // line 0
      await inputHandler.parseP(Array(bufferService.cols + 10).join('a')); // line 1 and 2
      for (let i = 3; i < bufferService.rows; ++i) await inputHandler.parseP(Array(bufferService.cols + 1).join('a'));

      // params[1] left and above with wrap
      // confirm precondition that line 2 is wrapped
      assert.equal(bufferService.buffer.lines.get(2)!.isWrapped, true);
      bufferService.buffer.y = 1;
      bufferService.buffer.x = 90; // Cursor is beyond last column
      inputHandler.eraseInDisplay(Params.fromArray([1]));
      assert.equal(bufferService.buffer.lines.get(2)!.isWrapped, false);
    });
  });
  describe('print', () => {
    it('should not cause an infinite loop (regression test)', () => {
      const inputHandler = new TestInputHandler(
        new MockBufferService(80, 30),
        new MockCharsetService(),
        new MockCoreService(),
        new MockDirtyRowService(),
        new MockLogService(),
        new MockOptionsService(),
        new MockCoreMouseService(),
        new MockUnicodeService()
      );
      const container = new Uint32Array(10);
      container[0] = 0x200B;
      inputHandler.print(container, 0, 1);
    });
    it('should clear cells to the right on early wrap-around', async () => {
      bufferService.resize(5, 5);
      optionsService.options.scrollback = 1;
      await inputHandler.parseP('12345');
      bufferService.buffer.x = 0;
      await inputHandler.parseP('￥￥￥');
      assert.deepEqual(getLines(bufferService, 2), ['￥￥', '￥']);
    });
  });

  describe('alt screen', () => {
    let bufferService: IBufferService;
    let handler: TestInputHandler;

    beforeEach(() => {
      bufferService = new MockBufferService(80, 30);
      handler = new TestInputHandler(bufferService, new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService());
    });
    it('should handle DECSET/DECRST 47 (alt screen buffer)', async () => {
      await handler.parseP('\x1b[?47h\r\n\x1b[31mJUNK\x1b[?47lTEST');
      assert.equal(bufferService.buffer.translateBufferLineToString(0, true), '');
      assert.equal(bufferService.buffer.translateBufferLineToString(1, true), '    TEST');
      // Text color of 'TEST' should be red
      assert.equal((bufferService.buffer.lines.get(1)!.loadCell(4, new CellData()).getFgColor()), 1);
    });
    it('should handle DECSET/DECRST 1047 (alt screen buffer)', async () => {
      await handler.parseP('\x1b[?1047h\r\n\x1b[31mJUNK\x1b[?1047lTEST');
      assert.equal(bufferService.buffer.translateBufferLineToString(0, true), '');
      assert.equal(bufferService.buffer.translateBufferLineToString(1, true), '    TEST');
      // Text color of 'TEST' should be red
      assert.equal((bufferService.buffer.lines.get(1)!.loadCell(4, new CellData()).getFgColor()), 1);
    });
    it('should handle DECSET/DECRST 1048 (alt screen cursor)', async () => {
      await handler.parseP('\x1b[?1048h\r\n\x1b[31mJUNK\x1b[?1048lTEST');
      assert.equal(bufferService.buffer.translateBufferLineToString(0, true), 'TEST');
      assert.equal(bufferService.buffer.translateBufferLineToString(1, true), 'JUNK');
      // Text color of 'TEST' should be default
      assert.equal(bufferService.buffer.lines.get(0)!.loadCell(0, new CellData()).fg, DEFAULT_ATTR_DATA.fg);
      // Text color of 'JUNK' should be red
      assert.equal((bufferService.buffer.lines.get(1)!.loadCell(0, new CellData()).getFgColor()), 1);
    });
    it('should handle DECSET/DECRST 1049 (alt screen buffer+cursor)', async () => {
      await handler.parseP('\x1b[?1049h\r\n\x1b[31mJUNK\x1b[?1049lTEST');
      assert.equal(bufferService.buffer.translateBufferLineToString(0, true), 'TEST');
      assert.equal(bufferService.buffer.translateBufferLineToString(1, true), '');
      // Text color of 'TEST' should be default
      assert.equal(bufferService.buffer.lines.get(0)!.loadCell(0, new CellData()).fg, DEFAULT_ATTR_DATA.fg);
    });
    it('should handle DECSET/DECRST 1049 - maintains saved cursor for alt buffer', async () => {
      await handler.parseP('\x1b[?1049h\r\n\x1b[31m\x1b[s\x1b[?1049lTEST');
      assert.equal(bufferService.buffer.translateBufferLineToString(0, true), 'TEST');
      // Text color of 'TEST' should be default
      assert.equal(bufferService.buffer.lines.get(0)!.loadCell(0, new CellData()).fg, DEFAULT_ATTR_DATA.fg);
      await handler.parseP('\x1b[?1049h\x1b[uTEST');
      assert.equal(bufferService.buffer.translateBufferLineToString(1, true), 'TEST');
      // Text color of 'TEST' should be red
      assert.equal((bufferService.buffer.lines.get(1)!.loadCell(0, new CellData()).getFgColor()), 1);
    });
    it('should handle DECSET/DECRST 1049 - clears alt buffer with erase attributes', async () => {
      await handler.parseP('\x1b[42m\x1b[?1049h');
      // Buffer should be filled with green background
      assert.equal(bufferService.buffer.lines.get(20)!.loadCell(10, new CellData()).getBgColor(), 2);
    });
  });

  describe('text attributes', () => {
    it('bold', async () => {
      await inputHandler.parseP('\x1b[1m');
      assert.equal(!!inputHandler.curAttrData.isBold(), true);
      await inputHandler.parseP('\x1b[22m');
      assert.equal(!!inputHandler.curAttrData.isBold(), false);
    });
    it('dim', async () => {
      await inputHandler.parseP('\x1b[2m');
      assert.equal(!!inputHandler.curAttrData.isDim(), true);
      await inputHandler.parseP('\x1b[22m');
      assert.equal(!!inputHandler.curAttrData.isDim(), false);
    });
    it('italic', async () => {
      await inputHandler.parseP('\x1b[3m');
      assert.equal(!!inputHandler.curAttrData.isItalic(), true);
      await inputHandler.parseP('\x1b[23m');
      assert.equal(!!inputHandler.curAttrData.isItalic(), false);
    });
    it('underline', async () => {
      await inputHandler.parseP('\x1b[4m');
      assert.equal(!!inputHandler.curAttrData.isUnderline(), true);
      await inputHandler.parseP('\x1b[24m');
      assert.equal(!!inputHandler.curAttrData.isUnderline(), false);
    });
    it('blink', async () => {
      await inputHandler.parseP('\x1b[5m');
      assert.equal(!!inputHandler.curAttrData.isBlink(), true);
      await inputHandler.parseP('\x1b[25m');
      assert.equal(!!inputHandler.curAttrData.isBlink(), false);
    });
    it('inverse', async () => {
      await inputHandler.parseP('\x1b[7m');
      assert.equal(!!inputHandler.curAttrData.isInverse(), true);
      await inputHandler.parseP('\x1b[27m');
      assert.equal(!!inputHandler.curAttrData.isInverse(), false);
    });
    it('invisible', async () => {
      await inputHandler.parseP('\x1b[8m');
      assert.equal(!!inputHandler.curAttrData.isInvisible(), true);
      await inputHandler.parseP('\x1b[28m');
      assert.equal(!!inputHandler.curAttrData.isInvisible(), false);
    });
    it('strikethrough', async () => {
      await inputHandler.parseP('\x1b[9m');
      assert.equal(!!inputHandler.curAttrData.isStrikethrough(), true);
      await inputHandler.parseP('\x1b[29m');
      assert.equal(!!inputHandler.curAttrData.isStrikethrough(), false);
    });
    it('colormode palette 16', async () => {
      assert.equal(inputHandler.curAttrData.getFgColorMode(), 0); // DEFAULT
      assert.equal(inputHandler.curAttrData.getBgColorMode(), 0); // DEFAULT
      // lower 8 colors
      for (let i = 0; i < 8; ++i) {
        await inputHandler.parseP(`\x1b[${i + 30};${i + 40}m`);
        assert.equal(inputHandler.curAttrData.getFgColorMode(), Attributes.CM_P16);
        assert.equal(inputHandler.curAttrData.getFgColor(), i);
        assert.equal(inputHandler.curAttrData.getBgColorMode(), Attributes.CM_P16);
        assert.equal(inputHandler.curAttrData.getBgColor(), i);
      }
      // reset to DEFAULT
      await inputHandler.parseP(`\x1b[39;49m`);
      assert.equal(inputHandler.curAttrData.getFgColorMode(), 0);
      assert.equal(inputHandler.curAttrData.getBgColorMode(), 0);
    });
    it('colormode palette 256', async () => {
      assert.equal(inputHandler.curAttrData.getFgColorMode(), 0); // DEFAULT
      assert.equal(inputHandler.curAttrData.getBgColorMode(), 0); // DEFAULT
      // lower 8 colors
      for (let i = 0; i < 256; ++i) {
        await inputHandler.parseP(`\x1b[38;5;${i};48;5;${i}m`);
        assert.equal(inputHandler.curAttrData.getFgColorMode(), Attributes.CM_P256);
        assert.equal(inputHandler.curAttrData.getFgColor(), i);
        assert.equal(inputHandler.curAttrData.getBgColorMode(), Attributes.CM_P256);
        assert.equal(inputHandler.curAttrData.getBgColor(), i);
      }
      // reset to DEFAULT
      await inputHandler.parseP(`\x1b[39;49m`);
      assert.equal(inputHandler.curAttrData.getFgColorMode(), 0);
      assert.equal(inputHandler.curAttrData.getFgColor(), -1);
      assert.equal(inputHandler.curAttrData.getBgColorMode(), 0);
      assert.equal(inputHandler.curAttrData.getBgColor(), -1);
    });
    it('colormode RGB', async () => {
      assert.equal(inputHandler.curAttrData.getFgColorMode(), 0); // DEFAULT
      assert.equal(inputHandler.curAttrData.getBgColorMode(), 0); // DEFAULT
      await inputHandler.parseP(`\x1b[38;2;1;2;3;48;2;4;5;6m`);
      assert.equal(inputHandler.curAttrData.getFgColorMode(), Attributes.CM_RGB);
      assert.equal(inputHandler.curAttrData.getFgColor(), 1 << 16 | 2 << 8 | 3);
      assert.deepEqual(AttributeData.toColorRGB(inputHandler.curAttrData.getFgColor()), [1, 2, 3]);
      assert.equal(inputHandler.curAttrData.getBgColorMode(), Attributes.CM_RGB);
      assert.deepEqual(AttributeData.toColorRGB(inputHandler.curAttrData.getBgColor()), [4, 5, 6]);
      // reset to DEFAULT
      await inputHandler.parseP(`\x1b[39;49m`);
      assert.equal(inputHandler.curAttrData.getFgColorMode(), 0);
      assert.equal(inputHandler.curAttrData.getFgColor(), -1);
      assert.equal(inputHandler.curAttrData.getBgColorMode(), 0);
      assert.equal(inputHandler.curAttrData.getBgColor(), -1);
    });
    it('colormode transition RGB to 256', async () => {
      // enter RGB for FG and BG
      await inputHandler.parseP(`\x1b[38;2;1;2;3;48;2;4;5;6m`);
      // enter 256 for FG and BG
      await inputHandler.parseP(`\x1b[38;5;255;48;5;255m`);
      assert.equal(inputHandler.curAttrData.getFgColorMode(), Attributes.CM_P256);
      assert.equal(inputHandler.curAttrData.getFgColor(), 255);
      assert.equal(inputHandler.curAttrData.getBgColorMode(), Attributes.CM_P256);
      assert.equal(inputHandler.curAttrData.getBgColor(), 255);
    });
    it('colormode transition RGB to 16', async () => {
      // enter RGB for FG and BG
      await inputHandler.parseP(`\x1b[38;2;1;2;3;48;2;4;5;6m`);
      // enter 16 for FG and BG
      await inputHandler.parseP(`\x1b[37;47m`);
      assert.equal(inputHandler.curAttrData.getFgColorMode(), Attributes.CM_P16);
      assert.equal(inputHandler.curAttrData.getFgColor(), 7);
      assert.equal(inputHandler.curAttrData.getBgColorMode(), Attributes.CM_P16);
      assert.equal(inputHandler.curAttrData.getBgColor(), 7);
    });
    it('colormode transition 16 to 256', async () => {
      // enter 16 for FG and BG
      await inputHandler.parseP(`\x1b[37;47m`);
      // enter 256 for FG and BG
      await inputHandler.parseP(`\x1b[38;5;255;48;5;255m`);
      assert.equal(inputHandler.curAttrData.getFgColorMode(), Attributes.CM_P256);
      assert.equal(inputHandler.curAttrData.getFgColor(), 255);
      assert.equal(inputHandler.curAttrData.getBgColorMode(), Attributes.CM_P256);
      assert.equal(inputHandler.curAttrData.getBgColor(), 255);
    });
    it('colormode transition 256 to 16', async () => {
      // enter 256 for FG and BG
      await inputHandler.parseP(`\x1b[38;5;255;48;5;255m`);
      // enter 16 for FG and BG
      await inputHandler.parseP(`\x1b[37;47m`);
      assert.equal(inputHandler.curAttrData.getFgColorMode(), Attributes.CM_P16);
      assert.equal(inputHandler.curAttrData.getFgColor(), 7);
      assert.equal(inputHandler.curAttrData.getBgColorMode(), Attributes.CM_P16);
      assert.equal(inputHandler.curAttrData.getBgColor(), 7);
    });
    it('should zero missing RGB values', async () => {
      await inputHandler.parseP(`\x1b[38;2;1;2;3m`);
      await inputHandler.parseP(`\x1b[38;2;5m`);
      assert.deepEqual(AttributeData.toColorRGB(inputHandler.curAttrData.getFgColor()), [5, 0, 0]);
    });
  });
  describe('colon notation', () => {
    let inputHandler2: TestInputHandler;
    beforeEach(() => {
      inputHandler2 = new TestInputHandler(bufferService, new MockCharsetService(), coreService, new MockDirtyRowService(), new MockLogService(), optionsService, new MockCoreMouseService(), new MockUnicodeService());
    });
    describe('should equal to semicolon', () => {
      it('CSI 38:2::50:100:150 m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;2;50;100;150m');
        await inputHandler.parseP('\x1b[38:2::50:100:150m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38:2::50:100: m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;2;50;100;m');
        await inputHandler.parseP('\x1b[38:2::50:100:m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38:2::50:: m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;2;50;;m');
        await inputHandler.parseP('\x1b[38:2::50::m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 50 << 16 | 0 << 8 | 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38:2:::: m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;2;;;m');
        await inputHandler.parseP('\x1b[38:2::::m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 0 << 16 | 0 << 8 | 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38;2::50:100:150 m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;2;50;100;150m');
        await inputHandler.parseP('\x1b[38;2::50:100:150m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38;2;50:100:150 m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;2;50;100;150m');
        await inputHandler.parseP('\x1b[38;2;50:100:150m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38;2;50;100:150 m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;2;50;100;150m');
        await inputHandler.parseP('\x1b[38;2;50;100:150m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38:5:50 m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;5;50m');
        await inputHandler.parseP('\x1b[38:5:50m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFF, 50);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38:5: m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;5;m');
        await inputHandler.parseP('\x1b[38:5:m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFF, 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38;5:50 m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;5;50m');
        await inputHandler.parseP('\x1b[38;5:50m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFF, 50);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
    });
    describe('should fill early sequence end with default of 0', () => {
      it('CSI 38:2 m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;2m');
        await inputHandler.parseP('\x1b[38:2m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 0 << 16 | 0 << 8 | 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 38:5 m', async () => {
        inputHandler.curAttrData.fg = 0xFFFFFFFF;
        inputHandler2.curAttrData.fg = 0xFFFFFFFF;
        await inputHandler2.parseP('\x1b[38;5m');
        await inputHandler.parseP('\x1b[38:5m');
        assert.equal(inputHandler2.curAttrData.fg & 0xFF, 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
    });
    describe('should not interfere with leading/following SGR attrs', () => {
      it('CSI 1 ; 38:2::50:100:150 ; 4 m', async () => {
        await inputHandler2.parseP('\x1b[1;38;2;50;100;150;4m');
        await inputHandler.parseP('\x1b[1;38:2::50:100:150;4m');
        assert.equal(!!inputHandler2.curAttrData.isBold(), true);
        assert.equal(!!inputHandler2.curAttrData.isUnderline(), true);
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 1 ; 38:2::50:100: ; 4 m', async () => {
        await inputHandler2.parseP('\x1b[1;38;2;50;100;;4m');
        await inputHandler.parseP('\x1b[1;38:2::50:100:;4m');
        assert.equal(!!inputHandler2.curAttrData.isBold(), true);
        assert.equal(!!inputHandler2.curAttrData.isUnderline(), true);
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 1 ; 38:2::50:100 ; 4 m', async () => {
        await inputHandler2.parseP('\x1b[1;38;2;50;100;;4m');
        await inputHandler.parseP('\x1b[1;38:2::50:100;4m');
        assert.equal(!!inputHandler2.curAttrData.isBold(), true);
        assert.equal(!!inputHandler2.curAttrData.isUnderline(), true);
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 1 ; 38:2:: ; 4 m', async () => {
        await inputHandler2.parseP('\x1b[1;38;2;;;;4m');
        await inputHandler.parseP('\x1b[1;38:2::;4m');
        assert.equal(!!inputHandler2.curAttrData.isBold(), true);
        assert.equal(!!inputHandler2.curAttrData.isUnderline(), true);
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
      it('CSI 1 ; 38;2:: ; 4 m', async () => {
        await inputHandler2.parseP('\x1b[1;38;2;;;;4m');
        await inputHandler.parseP('\x1b[1;38;2::;4m');
        assert.equal(!!inputHandler2.curAttrData.isBold(), true);
        assert.equal(!!inputHandler2.curAttrData.isUnderline(), true);
        assert.equal(inputHandler2.curAttrData.fg & 0xFFFFFF, 0);
        assert.equal(inputHandler.curAttrData.fg, inputHandler2.curAttrData.fg);
      });
    });
  });
  describe('cursor positioning', () => {
    beforeEach(() => {
      bufferService.resize(10, 10);
    });
    it('cursor forward (CUF)', async () => {
      await inputHandler.parseP('\x1b[C');
      assert.deepEqual(getCursor(bufferService), [1, 0]);
      await inputHandler.parseP('\x1b[1C');
      assert.deepEqual(getCursor(bufferService), [2, 0]);
      await inputHandler.parseP('\x1b[4C');
      assert.deepEqual(getCursor(bufferService), [6, 0]);
      await inputHandler.parseP('\x1b[100C');
      assert.deepEqual(getCursor(bufferService), [9, 0]);
      // should not change y
      bufferService.buffer.x = 8;
      bufferService.buffer.y = 4;
      await inputHandler.parseP('\x1b[C');
      assert.deepEqual(getCursor(bufferService), [9, 4]);
    });
    it('cursor backward (CUB)', async () => {
      await inputHandler.parseP('\x1b[D');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      await inputHandler.parseP('\x1b[1D');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      // place cursor at end of first line
      await inputHandler.parseP('\x1b[100C');
      await inputHandler.parseP('\x1b[D');
      assert.deepEqual(getCursor(bufferService), [8, 0]);
      await inputHandler.parseP('\x1b[1D');
      assert.deepEqual(getCursor(bufferService), [7, 0]);
      await inputHandler.parseP('\x1b[4D');
      assert.deepEqual(getCursor(bufferService), [3, 0]);
      await inputHandler.parseP('\x1b[100D');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      // should not change y
      bufferService.buffer.x = 4;
      bufferService.buffer.y = 4;
      await inputHandler.parseP('\x1b[D');
      assert.deepEqual(getCursor(bufferService), [3, 4]);
    });
    it('cursor down (CUD)', async () => {
      await inputHandler.parseP('\x1b[B');
      assert.deepEqual(getCursor(bufferService), [0, 1]);
      await inputHandler.parseP('\x1b[1B');
      assert.deepEqual(getCursor(bufferService), [0, 2]);
      await inputHandler.parseP('\x1b[4B');
      assert.deepEqual(getCursor(bufferService), [0, 6]);
      await inputHandler.parseP('\x1b[100B');
      assert.deepEqual(getCursor(bufferService), [0, 9]);
      // should not change x
      bufferService.buffer.x = 8;
      bufferService.buffer.y = 0;
      await inputHandler.parseP('\x1b[B');
      assert.deepEqual(getCursor(bufferService), [8, 1]);
    });
    it('cursor up (CUU)', async () => {
      await inputHandler.parseP('\x1b[A');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      await inputHandler.parseP('\x1b[1A');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      // place cursor at beginning of last row
      await inputHandler.parseP('\x1b[100B');
      await inputHandler.parseP('\x1b[A');
      assert.deepEqual(getCursor(bufferService), [0, 8]);
      await inputHandler.parseP('\x1b[1A');
      assert.deepEqual(getCursor(bufferService), [0, 7]);
      await inputHandler.parseP('\x1b[4A');
      assert.deepEqual(getCursor(bufferService), [0, 3]);
      await inputHandler.parseP('\x1b[100A');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      // should not change x
      bufferService.buffer.x = 8;
      bufferService.buffer.y = 9;
      await inputHandler.parseP('\x1b[A');
      assert.deepEqual(getCursor(bufferService), [8, 8]);
    });
    it('cursor next line (CNL)', async () => {
      await inputHandler.parseP('\x1b[E');
      assert.deepEqual(getCursor(bufferService), [0, 1]);
      await inputHandler.parseP('\x1b[1E');
      assert.deepEqual(getCursor(bufferService), [0, 2]);
      await inputHandler.parseP('\x1b[4E');
      assert.deepEqual(getCursor(bufferService), [0, 6]);
      await inputHandler.parseP('\x1b[100E');
      assert.deepEqual(getCursor(bufferService), [0, 9]);
      // should reset x to zero
      bufferService.buffer.x = 8;
      bufferService.buffer.y = 0;
      await inputHandler.parseP('\x1b[E');
      assert.deepEqual(getCursor(bufferService), [0, 1]);
    });
    it('cursor previous line (CPL)', async () => {
      await inputHandler.parseP('\x1b[F');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      await inputHandler.parseP('\x1b[1F');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      // place cursor at beginning of last row
      await inputHandler.parseP('\x1b[100E');
      await inputHandler.parseP('\x1b[F');
      assert.deepEqual(getCursor(bufferService), [0, 8]);
      await inputHandler.parseP('\x1b[1F');
      assert.deepEqual(getCursor(bufferService), [0, 7]);
      await inputHandler.parseP('\x1b[4F');
      assert.deepEqual(getCursor(bufferService), [0, 3]);
      await inputHandler.parseP('\x1b[100F');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      // should reset x to zero
      bufferService.buffer.x = 8;
      bufferService.buffer.y = 9;
      await inputHandler.parseP('\x1b[F');
      assert.deepEqual(getCursor(bufferService), [0, 8]);
    });
    it('cursor character absolute (CHA)', async () => {
      await inputHandler.parseP('\x1b[G');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      await inputHandler.parseP('\x1b[1G');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      await inputHandler.parseP('\x1b[2G');
      assert.deepEqual(getCursor(bufferService), [1, 0]);
      await inputHandler.parseP('\x1b[5G');
      assert.deepEqual(getCursor(bufferService), [4, 0]);
      await inputHandler.parseP('\x1b[100G');
      assert.deepEqual(getCursor(bufferService), [9, 0]);
    });
    it('cursor position (CUP)', async () => {
      bufferService.buffer.x = 5;
      bufferService.buffer.y = 5;
      await inputHandler.parseP('\x1b[H');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      bufferService.buffer.x = 5;
      bufferService.buffer.y = 5;
      await inputHandler.parseP('\x1b[1H');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      bufferService.buffer.x = 5;
      bufferService.buffer.y = 5;
      await inputHandler.parseP('\x1b[1;1H');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      bufferService.buffer.x = 5;
      bufferService.buffer.y = 5;
      await inputHandler.parseP('\x1b[8H');
      assert.deepEqual(getCursor(bufferService), [0, 7]);
      bufferService.buffer.x = 5;
      bufferService.buffer.y = 5;
      await inputHandler.parseP('\x1b[;8H');
      assert.deepEqual(getCursor(bufferService), [7, 0]);
      bufferService.buffer.x = 5;
      bufferService.buffer.y = 5;
      await inputHandler.parseP('\x1b[100;100H');
      assert.deepEqual(getCursor(bufferService), [9, 9]);
    });
    it('horizontal position absolute (HPA)', async () => {
      await inputHandler.parseP('\x1b[`');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      await inputHandler.parseP('\x1b[1`');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      await inputHandler.parseP('\x1b[2`');
      assert.deepEqual(getCursor(bufferService), [1, 0]);
      await inputHandler.parseP('\x1b[5`');
      assert.deepEqual(getCursor(bufferService), [4, 0]);
      await inputHandler.parseP('\x1b[100`');
      assert.deepEqual(getCursor(bufferService), [9, 0]);
    });
    it('horizontal position relative (HPR)', async () => {
      await inputHandler.parseP('\x1b[a');
      assert.deepEqual(getCursor(bufferService), [1, 0]);
      await inputHandler.parseP('\x1b[1a');
      assert.deepEqual(getCursor(bufferService), [2, 0]);
      await inputHandler.parseP('\x1b[4a');
      assert.deepEqual(getCursor(bufferService), [6, 0]);
      await inputHandler.parseP('\x1b[100a');
      assert.deepEqual(getCursor(bufferService), [9, 0]);
      // should not change y
      bufferService.buffer.x = 8;
      bufferService.buffer.y = 4;
      await inputHandler.parseP('\x1b[a');
      assert.deepEqual(getCursor(bufferService), [9, 4]);
    });
    it('vertical position absolute (VPA)', async () => {
      await inputHandler.parseP('\x1b[d');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      await inputHandler.parseP('\x1b[1d');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
      await inputHandler.parseP('\x1b[2d');
      assert.deepEqual(getCursor(bufferService), [0, 1]);
      await inputHandler.parseP('\x1b[5d');
      assert.deepEqual(getCursor(bufferService), [0, 4]);
      await inputHandler.parseP('\x1b[100d');
      assert.deepEqual(getCursor(bufferService), [0, 9]);
      // should not change x
      bufferService.buffer.x = 8;
      bufferService.buffer.y = 4;
      await inputHandler.parseP('\x1b[d');
      assert.deepEqual(getCursor(bufferService), [8, 0]);
    });
    it('vertical position relative (VPR)', async () => {
      await inputHandler.parseP('\x1b[e');
      assert.deepEqual(getCursor(bufferService), [0, 1]);
      await inputHandler.parseP('\x1b[1e');
      assert.deepEqual(getCursor(bufferService), [0, 2]);
      await inputHandler.parseP('\x1b[4e');
      assert.deepEqual(getCursor(bufferService), [0, 6]);
      await inputHandler.parseP('\x1b[100e');
      assert.deepEqual(getCursor(bufferService), [0, 9]);
      // should not change x
      bufferService.buffer.x = 8;
      bufferService.buffer.y = 4;
      await inputHandler.parseP('\x1b[e');
      assert.deepEqual(getCursor(bufferService), [8, 5]);
    });
    describe('should clamp cursor into addressible range', () => {
      it('CUF', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[C');
        assert.deepEqual(getCursor(bufferService), [9, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[C');
        assert.deepEqual(getCursor(bufferService), [1, 0]);
      });
      it('CUB', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[D');
        assert.deepEqual(getCursor(bufferService), [8, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[D');
        assert.deepEqual(getCursor(bufferService), [0, 0]);
      });
      it('CUD', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[B');
        assert.deepEqual(getCursor(bufferService), [9, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[B');
        assert.deepEqual(getCursor(bufferService), [0, 1]);
      });
      it('CUU', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[A');
        assert.deepEqual(getCursor(bufferService), [9, 8]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[A');
        assert.deepEqual(getCursor(bufferService), [0, 0]);
      });
      it('CNL', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[E');
        assert.deepEqual(getCursor(bufferService), [0, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[E');
        assert.deepEqual(getCursor(bufferService), [0, 1]);
      });
      it('CPL', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[F');
        assert.deepEqual(getCursor(bufferService), [0, 8]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[F');
        assert.deepEqual(getCursor(bufferService), [0, 0]);
      });
      it('CHA', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[5G');
        assert.deepEqual(getCursor(bufferService), [4, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[5G');
        assert.deepEqual(getCursor(bufferService), [4, 0]);
      });
      it('CUP', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[5;5H');
        assert.deepEqual(getCursor(bufferService), [4, 4]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[5;5H');
        assert.deepEqual(getCursor(bufferService), [4, 4]);
      });
      it('HPA', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[5`');
        assert.deepEqual(getCursor(bufferService), [4, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[5`');
        assert.deepEqual(getCursor(bufferService), [4, 0]);
      });
      it('HPR', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[a');
        assert.deepEqual(getCursor(bufferService), [9, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[a');
        assert.deepEqual(getCursor(bufferService), [1, 0]);
      });
      it('VPA', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[5d');
        assert.deepEqual(getCursor(bufferService), [9, 4]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[5d');
        assert.deepEqual(getCursor(bufferService), [0, 4]);
      });
      it('VPR', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[e');
        assert.deepEqual(getCursor(bufferService), [9, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[e');
        assert.deepEqual(getCursor(bufferService), [0, 1]);
      });
      it('DCH', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[P');
        assert.deepEqual(getCursor(bufferService), [9, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[P');
        assert.deepEqual(getCursor(bufferService), [0, 0]);
      });
      it('DCH - should delete last cell', async () => {
        await inputHandler.parseP('0123456789\x1b[P');
        assert.equal(bufferService.buffer.lines.get(0)!.translateToString(false), '012345678 ');
      });
      it('ECH', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[X');
        assert.deepEqual(getCursor(bufferService), [9, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[X');
        assert.deepEqual(getCursor(bufferService), [0, 0]);
      });
      it('ECH - should delete last cell', async () => {
        await inputHandler.parseP('0123456789\x1b[X');
        assert.equal(bufferService.buffer.lines.get(0)!.translateToString(false), '012345678 ');
      });
      it('ICH', async () => {
        bufferService.buffer.x = 10000;
        bufferService.buffer.y = 10000;
        await inputHandler.parseP('\x1b[@');
        assert.deepEqual(getCursor(bufferService), [9, 9]);
        bufferService.buffer.x = -10000;
        bufferService.buffer.y = -10000;
        await inputHandler.parseP('\x1b[@');
        assert.deepEqual(getCursor(bufferService), [0, 0]);
      });
      it('ICH - should delete last cell', async () => {
        await inputHandler.parseP('0123456789\x1b[@');
        assert.equal(bufferService.buffer.lines.get(0)!.translateToString(false), '012345678 ');
      });
    });
  });
  describe('DECSTBM - scroll margins', () => {
    beforeEach(() => {
      bufferService.resize(10, 10);
    });
    it('should default to whole viewport', async () => {
      await inputHandler.parseP('\x1b[r');
      assert.equal(bufferService.buffer.scrollTop, 0);
      assert.equal(bufferService.buffer.scrollBottom, 9);
      await inputHandler.parseP('\x1b[3;7r');
      assert.equal(bufferService.buffer.scrollTop, 2);
      assert.equal(bufferService.buffer.scrollBottom, 6);
      await inputHandler.parseP('\x1b[0;0r');
      assert.equal(bufferService.buffer.scrollTop, 0);
      assert.equal(bufferService.buffer.scrollBottom, 9);
    });
    it('should clamp bottom', async () => {
      await inputHandler.parseP('\x1b[3;1000r');
      assert.equal(bufferService.buffer.scrollTop, 2);
      assert.equal(bufferService.buffer.scrollBottom, 9);
    });
    it('should only apply for top < bottom', async () => {
      await inputHandler.parseP('\x1b[7;2r');
      assert.equal(bufferService.buffer.scrollTop, 0);
      assert.equal(bufferService.buffer.scrollBottom, 9);
    });
    it('should home cursor', async () => {
      bufferService.buffer.x = 10000;
      bufferService.buffer.y = 10000;
      await inputHandler.parseP('\x1b[2;7r');
      assert.deepEqual(getCursor(bufferService), [0, 0]);
    });
  });
  describe('scroll margins', () => {
    beforeEach(() => {
      bufferService.resize(10, 10);
    });
    it('scrollUp', async () => {
      await inputHandler.parseP('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[2;4r\x1b[2Sm');
      assert.deepEqual(getLines(bufferService), ['m', '3', '', '', '4', '5', '6', '7', '8', '9']);
    });
    it('scrollDown', async () => {
      await inputHandler.parseP('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[2;4r\x1b[2Tm');
      assert.deepEqual(getLines(bufferService), ['m', '', '', '1', '4', '5', '6', '7', '8', '9']);
    });
    it('insertLines - out of margins', async () => {
      await inputHandler.parseP('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[3;6r');
      assert.equal(bufferService.buffer.scrollTop, 2);
      assert.equal(bufferService.buffer.scrollBottom, 5);
      await inputHandler.parseP('\x1b[2Lm');
      assert.deepEqual(getLines(bufferService), ['m', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
      await inputHandler.parseP('\x1b[2H\x1b[2Ln');
      assert.deepEqual(getLines(bufferService), ['m', 'n', '2', '3', '4', '5', '6', '7', '8', '9']);
      // skip below scrollbottom
      await inputHandler.parseP('\x1b[7H\x1b[2Lo');
      assert.deepEqual(getLines(bufferService), ['m', 'n', '2', '3', '4', '5', 'o', '7', '8', '9']);
      await inputHandler.parseP('\x1b[8H\x1b[2Lp');
      assert.deepEqual(getLines(bufferService), ['m', 'n', '2', '3', '4', '5', 'o', 'p', '8', '9']);
      await inputHandler.parseP('\x1b[100H\x1b[2Lq');
      assert.deepEqual(getLines(bufferService), ['m', 'n', '2', '3', '4', '5', 'o', 'p', '8', 'q']);
    });
    it('insertLines - within margins', async () => {
      await inputHandler.parseP('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[3;6r');
      assert.equal(bufferService.buffer.scrollTop, 2);
      assert.equal(bufferService.buffer.scrollBottom, 5);
      await inputHandler.parseP('\x1b[3H\x1b[2Lm');
      assert.deepEqual(getLines(bufferService), ['0', '1', 'm', '', '2', '3', '6', '7', '8', '9']);
      await inputHandler.parseP('\x1b[6H\x1b[2Ln');
      assert.deepEqual(getLines(bufferService), ['0', '1', 'm', '', '2', 'n', '6', '7', '8', '9']);
    });
    it('deleteLines - out of margins', async () => {
      await inputHandler.parseP('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[3;6r');
      assert.equal(bufferService.buffer.scrollTop, 2);
      assert.equal(bufferService.buffer.scrollBottom, 5);
      await inputHandler.parseP('\x1b[2Mm');
      assert.deepEqual(getLines(bufferService), ['m', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
      await inputHandler.parseP('\x1b[2H\x1b[2Mn');
      assert.deepEqual(getLines(bufferService), ['m', 'n', '2', '3', '4', '5', '6', '7', '8', '9']);
      // skip below scrollbottom
      await inputHandler.parseP('\x1b[7H\x1b[2Mo');
      assert.deepEqual(getLines(bufferService), ['m', 'n', '2', '3', '4', '5', 'o', '7', '8', '9']);
      await inputHandler.parseP('\x1b[8H\x1b[2Mp');
      assert.deepEqual(getLines(bufferService), ['m', 'n', '2', '3', '4', '5', 'o', 'p', '8', '9']);
      await inputHandler.parseP('\x1b[100H\x1b[2Mq');
      assert.deepEqual(getLines(bufferService), ['m', 'n', '2', '3', '4', '5', 'o', 'p', '8', 'q']);
    });
    it('deleteLines - within margins', async () => {
      await inputHandler.parseP('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[3;6r');
      assert.equal(bufferService.buffer.scrollTop, 2);
      assert.equal(bufferService.buffer.scrollBottom, 5);
      await inputHandler.parseP('\x1b[6H\x1b[2Mm');
      assert.deepEqual(getLines(bufferService), ['0', '1', '2', '3', '4', 'm', '6', '7', '8', '9']);
      await inputHandler.parseP('\x1b[3H\x1b[2Mn');
      assert.deepEqual(getLines(bufferService), ['0', '1', 'n', 'm', '', '', '6', '7', '8', '9']);
    });
  });
  it('should parse big chunks in smaller subchunks', async () => {
    // max single chunk size is hardcoded as 131072
    const calls: any[] = [];
    bufferService.resize(10, 10);
    (inputHandler as any)._parser.parse = (data: Uint32Array, length: number) => {
      calls.push([data.length, length]);
    };
    await inputHandler.parseP('12345');
    await inputHandler.parseP('a'.repeat(10000));
    await inputHandler.parseP('a'.repeat(200000));
    await inputHandler.parseP('a'.repeat(300000));
    assert.deepEqual(calls, [
      [4096, 5],
      [10000, 10000],
      [131072, 131072], [131072, 200000 - 131072],
      [131072, 131072], [131072, 131072], [131072, 300000 - 131072 - 131072]
    ]);
  });
  describe('windowOptions', () => {
    it('all should be disabled by default and not report', async () => {
      bufferService.resize(10, 10);
      const stack: string[] = [];
      coreService.onData(data => stack.push(data));
      await inputHandler.parseP('\x1b[14t');
      await inputHandler.parseP('\x1b[16t');
      await inputHandler.parseP('\x1b[18t');
      await inputHandler.parseP('\x1b[20t');
      await inputHandler.parseP('\x1b[21t');
      assert.deepEqual(stack, []);
    });
    it('14 - GetWinSizePixels', async () => {
      bufferService.resize(10, 10);
      optionsService.options.windowOptions.getWinSizePixels = true;
      const stack: string[] = [];
      coreService.onData(data => stack.push(data));
      await inputHandler.parseP('\x1b[14t');
      // does not report in test terminal due to missing renderer
      assert.deepEqual(stack, []);
    });
    it('16 - GetCellSizePixels', async () => {
      bufferService.resize(10, 10);
      optionsService.options.windowOptions.getCellSizePixels = true;
      const stack: string[] = [];
      coreService.onData(data => stack.push(data));
      await inputHandler.parseP('\x1b[16t');
      // does not report in test terminal due to missing renderer
      assert.deepEqual(stack, []);
    });
    it('18 - GetWinSizeChars', async () => {
      bufferService.resize(10, 10);
      optionsService.options.windowOptions.getWinSizeChars = true;
      const stack: string[] = [];
      coreService.onData(data => stack.push(data));
      await inputHandler.parseP('\x1b[18t');
      assert.deepEqual(stack, ['\x1b[8;10;10t']);
      bufferService.resize(50, 20);
      await inputHandler.parseP('\x1b[18t');
      assert.deepEqual(stack, ['\x1b[8;10;10t', '\x1b[8;20;50t']);
    });
    it('22/23 - PushTitle/PopTitle', async () => {
      bufferService.resize(10, 10);
      optionsService.options.windowOptions.pushTitle = true;
      optionsService.options.windowOptions.popTitle = true;
      const stack: string[] = [];
      inputHandler.onTitleChange(data => stack.push(data));
      await inputHandler.parseP('\x1b]0;1\x07');
      await inputHandler.parseP('\x1b[22t');
      await inputHandler.parseP('\x1b]0;2\x07');
      await inputHandler.parseP('\x1b[22t');
      await inputHandler.parseP('\x1b]0;3\x07');
      await inputHandler.parseP('\x1b[22t');
      assert.deepEqual(inputHandler.windowTitleStack, ['1', '2', '3']);
      assert.deepEqual(inputHandler.iconNameStack, ['1', '2', '3']);
      assert.deepEqual(stack, ['1', '2', '3']);
      await inputHandler.parseP('\x1b[23t');
      await inputHandler.parseP('\x1b[23t');
      await inputHandler.parseP('\x1b[23t');
      await inputHandler.parseP('\x1b[23t'); // one more to test "overflow"
      assert.deepEqual(inputHandler.windowTitleStack, []);
      assert.deepEqual(inputHandler.iconNameStack, []);
      assert.deepEqual(stack, ['1', '2', '3', '3', '2', '1']);
    });
    it('22/23 - PushTitle/PopTitle with ;1', async () => {
      bufferService.resize(10, 10);
      optionsService.options.windowOptions.pushTitle = true;
      optionsService.options.windowOptions.popTitle = true;
      const stack: string[] = [];
      inputHandler.onTitleChange(data => stack.push(data));
      await inputHandler.parseP('\x1b]0;1\x07');
      await inputHandler.parseP('\x1b[22;1t');
      await inputHandler.parseP('\x1b]0;2\x07');
      await inputHandler.parseP('\x1b[22;1t');
      await inputHandler.parseP('\x1b]0;3\x07');
      await inputHandler.parseP('\x1b[22;1t');
      assert.deepEqual(inputHandler.windowTitleStack, []);
      assert.deepEqual(inputHandler.iconNameStack, ['1', '2', '3']);
      assert.deepEqual(stack, ['1', '2', '3']);
      await inputHandler.parseP('\x1b[23;1t');
      await inputHandler.parseP('\x1b[23;1t');
      await inputHandler.parseP('\x1b[23;1t');
      await inputHandler.parseP('\x1b[23;1t'); // one more to test "overflow"
      assert.deepEqual(inputHandler.windowTitleStack, []);
      assert.deepEqual(inputHandler.iconNameStack, []);
      assert.deepEqual(stack, ['1', '2', '3']);
    });
    it('22/23 - PushTitle/PopTitle with ;2', async () => {
      bufferService.resize(10, 10);
      optionsService.options.windowOptions.pushTitle = true;
      optionsService.options.windowOptions.popTitle = true;
      const stack: string[] = [];
      inputHandler.onTitleChange(data => stack.push(data));
      await inputHandler.parseP('\x1b]0;1\x07');
      await inputHandler.parseP('\x1b[22;2t');
      await inputHandler.parseP('\x1b]0;2\x07');
      await inputHandler.parseP('\x1b[22;2t');
      await inputHandler.parseP('\x1b]0;3\x07');
      await inputHandler.parseP('\x1b[22;2t');
      assert.deepEqual(inputHandler.windowTitleStack, ['1', '2', '3']);
      assert.deepEqual(inputHandler.iconNameStack, []);
      assert.deepEqual(stack, ['1', '2', '3']);
      await inputHandler.parseP('\x1b[23;2t');
      await inputHandler.parseP('\x1b[23;2t');
      await inputHandler.parseP('\x1b[23;2t');
      await inputHandler.parseP('\x1b[23;2t'); // one more to test "overflow"
      assert.deepEqual(inputHandler.windowTitleStack, []);
      assert.deepEqual(inputHandler.iconNameStack, []);
      assert.deepEqual(stack, ['1', '2', '3', '3', '2', '1']);
    });
    it('DECCOLM - should only work with "SetWinLines" (24) enabled', async () => {
      // disabled
      bufferService.resize(10, 10);
      await inputHandler.parseP('\x1b[?3l');
      assert.equal(bufferService.cols, 10);
      await inputHandler.parseP('\x1b[?3h');
      assert.equal(bufferService.cols, 10);
      // enabled
      inputHandler.reset();
      optionsService.options.windowOptions.setWinLines = true;
      await inputHandler.parseP('\x1b[?3l');
      assert.equal(bufferService.cols, 80);
      await inputHandler.parseP('\x1b[?3h');
      assert.equal(bufferService.cols, 132);
    });
  });
  describe('should correctly reset cells taken by wide chars', () => {
    beforeEach(async () => {
      bufferService.resize(10, 5);
      optionsService.options.scrollback = 1;
      await inputHandler.parseP('￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥');
    });
    it('print', async () => {
      await inputHandler.parseP('\x1b[H#');
      assert.deepEqual(getLines(bufferService), ['# ￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[1;6H######');
      assert.deepEqual(getLines(bufferService), ['# ￥ #####', '# ￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('#');
      assert.deepEqual(getLines(bufferService), ['# ￥ #####', '##￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('#');
      assert.deepEqual(getLines(bufferService), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[3;9H#');
      assert.deepEqual(getLines(bufferService), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥#', '￥￥￥￥￥', '']);
      await inputHandler.parseP('#');
      assert.deepEqual(getLines(bufferService), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥##', '￥￥￥￥￥', '']);
      await inputHandler.parseP('#');
      assert.deepEqual(getLines(bufferService), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥##', '# ￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[4;10H#');
      assert.deepEqual(getLines(bufferService), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥##', '# ￥￥￥ #', '']);
    });
    it('EL', async () => {
      await inputHandler.parseP('\x1b[1;6H\x1b[K#');
      assert.deepEqual(getLines(bufferService), ['￥￥ #', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[2;5H\x1b[1K');
      assert.deepEqual(getLines(bufferService), ['￥￥ #', '      ￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[3;6H\x1b[1K');
      assert.deepEqual(getLines(bufferService), ['￥￥ #', '      ￥￥', '      ￥￥', '￥￥￥￥￥', '']);
    });
    it('ICH', async () => {
      await inputHandler.parseP('\x1b[1;6H\x1b[@');
      assert.deepEqual(getLines(bufferService), ['￥￥   ￥', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[2;4H\x1b[2@');
      assert.deepEqual(getLines(bufferService), ['￥￥   ￥', '￥    ￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[3;4H\x1b[3@');
      assert.deepEqual(getLines(bufferService), ['￥￥   ￥', '￥    ￥￥', '￥     ￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[4;4H\x1b[4@');
      assert.deepEqual(getLines(bufferService), ['￥￥   ￥', '￥    ￥￥', '￥     ￥', '￥      ￥', '']);
    });
    it('DCH', async () => {
      await inputHandler.parseP('\x1b[1;6H\x1b[P');
      assert.deepEqual(getLines(bufferService), ['￥￥ ￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[2;6H\x1b[2P');
      assert.deepEqual(getLines(bufferService), ['￥￥ ￥￥', '￥￥  ￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[3;6H\x1b[3P');
      assert.deepEqual(getLines(bufferService), ['￥￥ ￥￥', '￥￥  ￥', '￥￥ ￥', '￥￥￥￥￥', '']);
    });
    it('ECH', async () => {
      await inputHandler.parseP('\x1b[1;6H\x1b[X');
      assert.deepEqual(getLines(bufferService), ['￥￥  ￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[2;6H\x1b[2X');
      assert.deepEqual(getLines(bufferService), ['￥￥  ￥￥', '￥￥    ￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      await inputHandler.parseP('\x1b[3;6H\x1b[3X');
      assert.deepEqual(getLines(bufferService), ['￥￥  ￥￥', '￥￥    ￥', '￥￥    ￥', '￥￥￥￥￥', '']);
    });
  });

  describe('BS with reverseWraparound set/unset', () => {
    const ttyBS = '\x08 \x08';  // tty ICANON sends <BS SP BS> on pressing BS
    beforeEach(() => {
      bufferService.resize(5, 5);
      optionsService.options.scrollback = 1;
    });
    describe('reverseWraparound unset (default)', () => {
      it('cannot delete last cell', async () => {
        await inputHandler.parseP('12345');
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 1), ['123 5']);
        await inputHandler.parseP(ttyBS.repeat(10));
        assert.deepEqual(getLines(bufferService, 1), ['    5']);
      });
      it('cannot access prev line', async () => {
        await inputHandler.parseP('12345'.repeat(2));
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 2), ['12345', '123 5']);
        await inputHandler.parseP(ttyBS.repeat(10));
        assert.deepEqual(getLines(bufferService, 2), ['12345', '    5']);
      });
    });
    describe('reverseWraparound set', () => {
      it('can delete last cell', async () => {
        await inputHandler.parseP('\x1b[?45h');
        await inputHandler.parseP('12345');
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 1), ['1234 ']);
        await inputHandler.parseP(ttyBS.repeat(7));
        assert.deepEqual(getLines(bufferService, 1), ['     ']);
      });
      it('can access prev line if wrapped', async () => {
        await inputHandler.parseP('\x1b[?45h');
        await inputHandler.parseP('12345'.repeat(2));
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 2), ['12345', '1234 ']);
        await inputHandler.parseP(ttyBS.repeat(7));
        assert.deepEqual(getLines(bufferService, 2), ['12   ', '     ']);
      });
      it('should lift isWrapped', async () => {
        await inputHandler.parseP('\x1b[?45h');
        await inputHandler.parseP('12345'.repeat(2));
        assert.equal(bufferService.buffer.lines.get(1)?.isWrapped, true);
        await inputHandler.parseP(ttyBS.repeat(7));
        assert.equal(bufferService.buffer.lines.get(1)?.isWrapped, false);
      });
      it('stops at hard NLs', async () => {
        await inputHandler.parseP('\x1b[?45h');
        await inputHandler.parseP('12345\r\n');
        await inputHandler.parseP('12345'.repeat(2));
        await inputHandler.parseP(ttyBS.repeat(50));
        assert.deepEqual(getLines(bufferService, 3), ['12345', '     ', '     ']);
        assert.equal(bufferService.buffer.x, 0);
        assert.equal(bufferService.buffer.y, 1);
      });
      it('handles wide chars correctly', async () => {
        await inputHandler.parseP('\x1b[?45h');
        await inputHandler.parseP('￥￥￥');
        assert.deepEqual(getLines(bufferService, 2), ['￥￥', '￥']);
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 2), ['￥￥', '  ']);
        assert.equal(bufferService.buffer.x, 1);
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 2), ['￥￥', '  ']);
        assert.equal(bufferService.buffer.x, 0);
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 2), ['￥  ', '  ']);
        assert.equal(bufferService.buffer.x, 3);  // x=4 skipped due to early wrap-around
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 2), ['￥  ', '  ']);
        assert.equal(bufferService.buffer.x, 2);
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 2), ['    ', '  ']);
        assert.equal(bufferService.buffer.x, 1);
        await inputHandler.parseP(ttyBS);
        assert.deepEqual(getLines(bufferService, 2), ['    ', '  ']);
        assert.equal(bufferService.buffer.x, 0);
      });
    });
  });

  describe('extended underline style support (SGR 4)', () => {
    beforeEach(() => {
      bufferService.resize(10, 5);
    });
    it('4 | 24', async () => {
      await inputHandler.parseP('\x1b[4m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.SINGLE);
      await inputHandler.parseP('\x1b[24m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('21 | 24', async () => {
      await inputHandler.parseP('\x1b[21m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.DOUBLE);
      await inputHandler.parseP('\x1b[24m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:1 | 4:0', async () => {
      await inputHandler.parseP('\x1b[4:1m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.SINGLE);
      await inputHandler.parseP('\x1b[4:0m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      await inputHandler.parseP('\x1b[4:1m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.SINGLE);
      await inputHandler.parseP('\x1b[24m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:2 | 4:0', async () => {
      await inputHandler.parseP('\x1b[4:2m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.DOUBLE);
      await inputHandler.parseP('\x1b[4:0m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      await inputHandler.parseP('\x1b[4:2m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.DOUBLE);
      await inputHandler.parseP('\x1b[24m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:3 | 4:0', async () => {
      await inputHandler.parseP('\x1b[4:3m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.CURLY);
      await inputHandler.parseP('\x1b[4:0m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      await inputHandler.parseP('\x1b[4:3m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.CURLY);
      await inputHandler.parseP('\x1b[24m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:4 | 4:0', async () => {
      await inputHandler.parseP('\x1b[4:4m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.DOTTED);
      await inputHandler.parseP('\x1b[4:0m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      await inputHandler.parseP('\x1b[4:4m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.DOTTED);
      await inputHandler.parseP('\x1b[24m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:5 | 4:0', async () => {
      await inputHandler.parseP('\x1b[4:5m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.DASHED);
      await inputHandler.parseP('\x1b[4:0m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      await inputHandler.parseP('\x1b[4:5m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.DASHED);
      await inputHandler.parseP('\x1b[24m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:x --> 4 should revert to single underline', async () => {
      await inputHandler.parseP('\x1b[4:5m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.DASHED);
      await inputHandler.parseP('\x1b[4m');
      assert.equal(inputHandler.curAttrData.getUnderlineStyle(), UnderlineStyle.SINGLE);
    });
  });
  describe('underline colors (SGR 58 & SGR 59)', () => {
    beforeEach(() => {
      bufferService.resize(10, 5);
    });
    it('defaults to FG color', async () => {
      for (const s of ['', '\x1b[30m', '\x1b[38;510m', '\x1b[38;2;1;2;3m']) {
        await inputHandler.parseP(s);
        assert.equal(inputHandler.curAttrData.getUnderlineColor(), inputHandler.curAttrData.getFgColor());
        assert.equal(inputHandler.curAttrData.getUnderlineColorMode(), inputHandler.curAttrData.getFgColorMode());
        assert.equal(inputHandler.curAttrData.isUnderlineColorRGB(), inputHandler.curAttrData.isFgRGB());
        assert.equal(inputHandler.curAttrData.isUnderlineColorPalette(), inputHandler.curAttrData.isFgPalette());
        assert.equal(inputHandler.curAttrData.isUnderlineColorDefault(), inputHandler.curAttrData.isFgDefault());
      }
    });
    it('correctly sets P256/RGB colors', async () => {
      await inputHandler.parseP('\x1b[4m');
      await inputHandler.parseP('\x1b[58;5;123m');
      assert.equal(inputHandler.curAttrData.getUnderlineColor(), 123);
      assert.equal(inputHandler.curAttrData.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(inputHandler.curAttrData.isUnderlineColorRGB(), false);
      assert.equal(inputHandler.curAttrData.isUnderlineColorPalette(), true);
      assert.equal(inputHandler.curAttrData.isUnderlineColorDefault(), false);
      await inputHandler.parseP('\x1b[58;2::1:2:3m');
      assert.equal(inputHandler.curAttrData.getUnderlineColor(), (1 << 16) | (2 << 8) | 3);
      assert.equal(inputHandler.curAttrData.getUnderlineColorMode(), Attributes.CM_RGB);
      assert.equal(inputHandler.curAttrData.isUnderlineColorRGB(), true);
      assert.equal(inputHandler.curAttrData.isUnderlineColorPalette(), false);
      assert.equal(inputHandler.curAttrData.isUnderlineColorDefault(), false);
    });
    it('P256/RGB persistence', async () => {
      const cell = new CellData();
      await inputHandler.parseP('\x1b[4m');
      await inputHandler.parseP('\x1b[58;5;123m');
      assert.equal(inputHandler.curAttrData.getUnderlineColor(), 123);
      assert.equal(inputHandler.curAttrData.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(inputHandler.curAttrData.isUnderlineColorRGB(), false);
      assert.equal(inputHandler.curAttrData.isUnderlineColorPalette(), true);
      assert.equal(inputHandler.curAttrData.isUnderlineColorDefault(), false);
      await inputHandler.parseP('ab');
      bufferService.buffer!.lines.get(0)!.loadCell(1, cell);
      assert.equal(cell.getUnderlineColor(), 123);
      assert.equal(cell.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(cell.isUnderlineColorRGB(), false);
      assert.equal(cell.isUnderlineColorPalette(), true);
      assert.equal(cell.isUnderlineColorDefault(), false);

      await inputHandler.parseP('\x1b[4:0m');
      assert.equal(inputHandler.curAttrData.getUnderlineColor(), inputHandler.curAttrData.getFgColor());
      assert.equal(inputHandler.curAttrData.getUnderlineColorMode(), inputHandler.curAttrData.getFgColorMode());
      assert.equal(inputHandler.curAttrData.isUnderlineColorRGB(), inputHandler.curAttrData.isFgRGB());
      assert.equal(inputHandler.curAttrData.isUnderlineColorPalette(), inputHandler.curAttrData.isFgPalette());
      assert.equal(inputHandler.curAttrData.isUnderlineColorDefault(), inputHandler.curAttrData.isFgDefault());
      await inputHandler.parseP('a');
      bufferService.buffer!.lines.get(0)!.loadCell(1, cell);
      assert.equal(cell.getUnderlineColor(), 123);
      assert.equal(cell.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(cell.isUnderlineColorRGB(), false);
      assert.equal(cell.isUnderlineColorPalette(), true);
      assert.equal(cell.isUnderlineColorDefault(), false);
      bufferService.buffer!.lines.get(0)!.loadCell(2, cell);
      assert.equal(cell.getUnderlineColor(), inputHandler.curAttrData.getFgColor());
      assert.equal(cell.getUnderlineColorMode(), inputHandler.curAttrData.getFgColorMode());
      assert.equal(cell.isUnderlineColorRGB(), inputHandler.curAttrData.isFgRGB());
      assert.equal(cell.isUnderlineColorPalette(), inputHandler.curAttrData.isFgPalette());
      assert.equal(cell.isUnderlineColorDefault(), inputHandler.curAttrData.isFgDefault());

      await inputHandler.parseP('\x1b[4m');
      await inputHandler.parseP('\x1b[58;2::1:2:3m');
      assert.equal(inputHandler.curAttrData.getUnderlineColor(), (1 << 16) | (2 << 8) | 3);
      assert.equal(inputHandler.curAttrData.getUnderlineColorMode(), Attributes.CM_RGB);
      assert.equal(inputHandler.curAttrData.isUnderlineColorRGB(), true);
      assert.equal(inputHandler.curAttrData.isUnderlineColorPalette(), false);
      assert.equal(inputHandler.curAttrData.isUnderlineColorDefault(), false);
      await inputHandler.parseP('a');
      await inputHandler.parseP('\x1b[24m');
      bufferService.buffer!.lines.get(0)!.loadCell(1, cell);
      assert.equal(cell.getUnderlineColor(), 123);
      assert.equal(cell.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(cell.isUnderlineColorRGB(), false);
      assert.equal(cell.isUnderlineColorPalette(), true);
      assert.equal(cell.isUnderlineColorDefault(), false);
      bufferService.buffer!.lines.get(0)!.loadCell(3, cell);
      assert.equal(cell.getUnderlineColor(), (1 << 16) | (2 << 8) | 3);
      assert.equal(cell.getUnderlineColorMode(), Attributes.CM_RGB);
      assert.equal(cell.isUnderlineColorRGB(), true);
      assert.equal(cell.isUnderlineColorPalette(), false);
      assert.equal(cell.isUnderlineColorDefault(), false);

      // eAttrs in buffer pos 0 and 1 should be the same object
      assert.equal(
        (bufferService.buffer!.lines.get(0)! as any)._extendedAttrs[0],
        (bufferService.buffer!.lines.get(0)! as any)._extendedAttrs[1]
      );
      // should not have written eAttr for pos 2 in the buffer
      assert.equal((bufferService.buffer!.lines.get(0)! as any)._extendedAttrs[2], undefined);
      // eAttrs in buffer pos 1 and pos 3 must be different objs
      assert.notEqual(
        (bufferService.buffer!.lines.get(0)! as any)._extendedAttrs[1],
        (bufferService.buffer!.lines.get(0)! as any)._extendedAttrs[3]
      );
    });
  });
  describe('DECSTR', () => {
    beforeEach(async () => {
      bufferService.resize(10, 5);
      optionsService.options.scrollback = 1;
      await inputHandler.parseP('01234567890123');
    });
    it('should reset IRM', async () => {
      await inputHandler.parseP('\x1b[4h');
      assert.equal(coreService.modes.insertMode, true);
      await inputHandler.parseP('\x1b[!p');
      assert.equal(coreService.modes.insertMode, false);
    });
    it('should reset cursor visibility', async () => {
      await inputHandler.parseP('\x1b[?25l');
      assert.equal(coreService.isCursorHidden, true);
      await inputHandler.parseP('\x1b[!p');
      assert.equal(coreService.isCursorHidden, false);
    });
    it('should reset scroll margins', async () => {
      await inputHandler.parseP('\x1b[2;4r');
      assert.equal(bufferService.buffer.scrollTop, 1);
      assert.equal(bufferService.buffer.scrollBottom, 3);
      await inputHandler.parseP('\x1b[!p');
      assert.equal(bufferService.buffer.scrollTop, 0);
      assert.equal(bufferService.buffer.scrollBottom, bufferService.rows - 1);
    });
    it('should reset text attributes', async () => {
      await inputHandler.parseP('\x1b[1;2;32;43m');
      assert.equal(!!inputHandler.curAttrData.isBold(), true);
      await inputHandler.parseP('\x1b[!p');
      assert.equal(!!inputHandler.curAttrData.isBold(), false);
      assert.equal(inputHandler.curAttrData.fg, 0);
      assert.equal(inputHandler.curAttrData.bg, 0);
    });
    it('should reset DECSC data', async () => {
      await inputHandler.parseP('\x1b7');
      assert.equal(bufferService.buffer.savedX, 4);
      assert.equal(bufferService.buffer.savedY, 1);
      await inputHandler.parseP('\x1b[!p');
      assert.equal(bufferService.buffer.savedX, 0);
      assert.equal(bufferService.buffer.savedY, 0);
    });
    it('should reset DECOM', async () => {
      await inputHandler.parseP('\x1b[?6h');
      assert.equal(coreService.decPrivateModes.origin, true);
      await inputHandler.parseP('\x1b[!p');
      assert.equal(coreService.decPrivateModes.origin, false);
    });
  });
  describe('OSC', () => {
    it('4: should parse correct Ansi color change data', () => {
      // this is testing a private method
      const event = inputHandler.parseAnsiColorChange('19;rgb:a1/b2/c3');

      assert.isNotNull(event);
      assert.deepEqual(event!.colors[0], { colorIndex: 19, red: 0xa1, green: 0xb2, blue: 0xc3 });
    });

    it('4: should ignore incorrect Ansi color change data', () => {
      // this is testing a private method
      assert.isNull(inputHandler.parseAnsiColorChange('17;rgb:a/b/c'));
      assert.isNull(inputHandler.parseAnsiColorChange('17;rgb:#aabbcc'));
      assert.isNull(inputHandler.parseAnsiColorChange('17;rgba:aa/bb/cc'));
      assert.isNull(inputHandler.parseAnsiColorChange('rgb:aa/bb/cc'));
    });

    it('4: should parse a list of Ansi color changes', () => {
      // this is testing a private method
      const event = inputHandler.parseAnsiColorChange('19;rgb:a1/b2/c3;17;rgb:00/11/22;255;rgb:01/ef/2d');

      assert.isNotNull(event);
      assert.equal(event!.colors.length, 3);
      assert.deepEqual(event!.colors[0], { colorIndex: 19, red: 0xa1, green: 0xb2, blue: 0xc3 });
      assert.deepEqual(event!.colors[1], { colorIndex: 17, red: 0x00, green: 0x11, blue: 0x22 });
      assert.deepEqual(event!.colors[2], { colorIndex: 255, red: 0x01, green: 0xef, blue: 0x2d });
    });
    it('4: should ignore incorrect colors in a list of Ansi color changes', () => {
      // this is testing a private method
      const event = inputHandler.parseAnsiColorChange('19;rgb:a1/b2/c3;17;rgb:WR/ON/G;255;rgb:01/ef/2d');

      assert.equal(event!.colors.length, 2);
      assert.deepEqual(event!.colors[0], { colorIndex: 19, red: 0xa1, green: 0xb2, blue: 0xc3 });
      assert.deepEqual(event!.colors[1], { colorIndex: 255, red: 0x01, green: 0xef, blue: 0x2d });
    });
    it('4: should be case insensitive when parsing Ansi color changes', () => {
      // this is testing a private method
      const event = inputHandler.parseAnsiColorChange('19;rGb:A1/b2/C3');

      assert.equal(event!.colors.length, 1);
      assert.deepEqual(event!.colors[0], { colorIndex: 19, red: 0xa1, green: 0xb2, blue: 0xc3 });
    });
    it('4: should fire event on Ansi color change', async () => {
      return new Promise(async r => {
        inputHandler.onAnsiColorChange(e => {
          assert.isNotNull(e);
          assert.isNotNull(e!.colors);
          assert.deepEqual(e!.colors[0], { colorIndex: 17, red: 0x1a, green: 0x2b, blue: 0x3c });
          assert.deepEqual(e!.colors[1], { colorIndex: 12, red: 0x11, green: 0x22, blue: 0x33 });
          r();
        });
        await inputHandler.parseP('\x1b]4;17;rgb:1a/2b/3c;12;rgb:11/22/33\x1b\\');
      });
    });
  });

  // issue #3362 and #2979
  describe('EL/ED cursor at buffer.cols', () => {
    beforeEach(() => {
      bufferService.resize(10, 5);
    });
    describe('cursor should stay at cols / does not overflow', () => {
      it('EL0', async () => {
        await inputHandler.parseP('##########\x1b[0K');
        assert.equal(bufferService.buffer.x, 10);
        assert.deepEqual(getLines(bufferService), ['#'.repeat(10), '', '', '', '']);
      });
      it('EL1', async () => {
        await inputHandler.parseP('##########\x1b[1K');
        assert.equal(bufferService.buffer.x, 10);
        assert.deepEqual(getLines(bufferService), ['', '', '', '', '']);
      });
      it('EL2', async () => {
        await inputHandler.parseP('##########\x1b[2K');
        assert.equal(bufferService.buffer.x, 10);
        assert.deepEqual(getLines(bufferService), ['', '', '', '', '']);
      });
      it('ED0', async () => {
        await inputHandler.parseP('##########\x1b[0J');
        assert.equal(bufferService.buffer.x, 10);
        assert.deepEqual(getLines(bufferService), ['#'.repeat(10), '', '', '', '']);
      });
      it('ED1', async () => {
        await inputHandler.parseP('##########\x1b[1J');
        assert.equal(bufferService.buffer.x, 10);
        assert.deepEqual(getLines(bufferService), ['', '', '', '', '']);
      });
      it('ED2', async () => {
        await inputHandler.parseP('##########\x1b[2J');
        assert.equal(bufferService.buffer.x, 10);
        assert.deepEqual(getLines(bufferService), ['', '', '', '', '']);
      });
      it('ED3', async () => {
        await inputHandler.parseP('##########\x1b[3J');
        assert.equal(bufferService.buffer.x, 10);
        assert.deepEqual(getLines(bufferService), ['#'.repeat(10), '', '', '', '']);
      });
    });
    describe('following sequence keeps working', () => {
      // sequences to test (cursor related ones)
      const SEQ = [
        /* ICH */   '\x1b[10@',
        /* SL */    '\x1b[10 @',
        /* CUU */   '\x1b[10A',
        /* SR */    '\x1b[10 A',
        /* CUD */   '\x1b[10B',
        /* CUF */   '\x1b[10C',
        /* CUB */   '\x1b[10D',
        /* CNL */   '\x1b[10E',
        /* CPL */   '\x1b[10F',
        /* CHA */   '\x1b[10G',
        /* CUP */   '\x1b[10;10H',
        /* CHT */   '\x1b[10I',
        /* IL */    '\x1b[10L',
        /* DL */    '\x1b[10M',
        /* DCH */   '\x1b[10P',
        /* SU */    '\x1b[10S',
        /* SD */    '\x1b[10T',
        /* ECH */   '\x1b[10X',
        /* CBT */   '\x1b[10Z',
        /* HPA */   '\x1b[10`',
        /* HPR */   '\x1b[10a',
        /* REP */   '\x1b[10b',
        /* VPA */   '\x1b[10d',
        /* VPR */   '\x1b[10e',
        /* HVP */   '\x1b[10;10f',
        /* TBC */   '\x1b[0g',
        /* SCOSC */ '\x1b[s',
        /* DECIC */ '\x1b[10\'}',
        /* DECDC */ '\x1b[10\'~'
      ];
      it('cursor never advances beyond cols', async () => {
        for (const seq of SEQ) {
          await inputHandler.parseP('##########\x1b[2J' + seq);
          assert.equal(bufferService.buffer.x <= bufferService.cols, true);
          inputHandler.reset();
          bufferService.reset();
        }
      });
    });
  });
});


describe('InputHandler - async handlers', () => {
  let bufferService: IBufferService;
  let coreService: ICoreService;
  let optionsService: MockOptionsService;
  let inputHandler: TestInputHandler;

  beforeEach(() => {
    optionsService = new MockOptionsService();
    bufferService = new BufferService(optionsService);
    bufferService.resize(80, 30);
    coreService = new CoreService(() => { }, bufferService, new MockLogService(), optionsService);
    coreService.onData(data => { console.log(data); });

    inputHandler = new TestInputHandler(bufferService, new MockCharsetService(), coreService, new MockDirtyRowService(), new MockLogService(), optionsService, new MockCoreMouseService(), new MockUnicodeService());
  });

  it('async CUP with CPR check', async () => {
    const cup: number[][] = [];
    const cpr: number[][] = [];
    inputHandler.registerCsiHandler({ final: 'H' }, async params => {
      cup.push(params.toArray() as number[]);
      await new Promise(res => setTimeout(res, 50));
      // late call of real repositioning
      return inputHandler.cursorPosition(params);
    });
    coreService.onData(data => {
      const m = data.match(/\x1b\[(.*?);(.*?)R/);
      if (m) {
        cpr.push([parseInt(m[1]), parseInt(m[2])]);
      }
    });
    await inputHandler.parseP('aaa\x1b[3;4H\x1b[6nbbb\x1b[6;8H\x1b[6n');
    assert.deepEqual(cup, cpr);
  });
  it('async OSC between', async () => {
    inputHandler.registerOscHandler(1000, async data => {
      await new Promise(res => setTimeout(res, 50));
      assert.deepEqual(getLines(bufferService, 2), ['hello world!', '']);
      assert.equal(data, 'some data');
      return true;
    });
    await inputHandler.parseP('hello world!\r\n\x1b]1000;some data\x07second line');
    assert.deepEqual(getLines(bufferService, 2), ['hello world!', 'second line']);
  });
  it('async DCS between', async () => {
    inputHandler.registerDcsHandler({ final: 'a' }, async (data, params) => {
      await new Promise(res => setTimeout(res, 50));
      assert.deepEqual(getLines(bufferService, 2), ['hello world!', '']);
      assert.equal(data, 'some data');
      assert.deepEqual(params.toArray(), [1, 2]);
      return true;
    });
    await inputHandler.parseP('hello world!\r\n\x1bP1;2asome data\x1b\\second line');
    assert.deepEqual(getLines(bufferService, 2), ['hello world!', 'second line']);
  });
});
