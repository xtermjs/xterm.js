/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { openTerminal, writeSync, launchBrowser } from '../../../out-test/api/TestUtils';
import { Browser, Page } from '@playwright/test';

const APP = 'http://127.0.0.1:3001/test';

let browser: Browser;
let page: Page;
const width = 800;
const height = 600;

const writeRawSync = (page: any, str: string): Promise<void> => writeSync(page, `' +` + JSON.stringify(str) + `+ '`);

const testNormalScreenEqual = async (page: any, str: string): Promise<void> => {
  await writeRawSync(page, str);
  const originalBuffer = await page.evaluate(`inspectBuffer(term.buffer.normal);`);

  const result = await page.evaluate(`serializeAddon.serialize();`) as string;
  await page.evaluate(`term.reset();`);
  await writeRawSync(page, result);
  const newBuffer = await page.evaluate(`inspectBuffer(term.buffer.normal);`);

  // chai decides -0 and 0 are different number...
  // and firefox have a bug that output -0 for unknown reason
  assert.equal(JSON.stringify(originalBuffer), JSON.stringify(newBuffer));
};

async function testSerializeEquals(writeContent: string, expectedSerialized: string): Promise<void> {
  await writeRawSync(page, writeContent);
  const result = await page.evaluate(`serializeAddon.serialize();`) as string;
  assert.strictEqual(result, expectedSerialized);
}

describe('SerializeAddon', () => {
  before(async function(): Promise<any> {
    browser = await launchBrowser();
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
    await page.goto(APP);
    await openTerminal(page, { rows: 10, cols: 10 });
    await page.evaluate(`
      window.serializeAddon = new SerializeAddon();
      window.term.loadAddon(window.serializeAddon);
      window.inspectBuffer = (buffer) => {
        const lines = [];
        for (let i = 0; i < buffer.length; i++) {
          // Do this intentionally to get content of underlining source
          const bufferLine = buffer.getLine(i)._line;
          lines.push(JSON.stringify(bufferLine));
        }
        return {
          x: buffer.cursorX,
          y: buffer.cursorY,
          data: lines
        };
      }
    `);
  });

  after(async () => await browser.close());
  beforeEach(async () => await page.evaluate(`window.term.reset()`));

  it('produce different output when we call test util with different text', async function(): Promise<any> {
    await writeRawSync(page, '12345');
    const buffer1 = await page.evaluate(`inspectBuffer(term.buffer.normal);`);

    await page.evaluate(`term.reset();`);
    await writeRawSync(page, '67890');
    const buffer2 = await page.evaluate(`inspectBuffer(term.buffer.normal);`);

    assert.throw(() => {
      assert.equal(JSON.stringify(buffer1), JSON.stringify(buffer2));
    });
  });

  it('produce different output when we call test util with different line wrap', async function(): Promise<any> {
    await writeRawSync(page, '1234567890\r\n12345');
    const buffer3 = await page.evaluate(`inspectBuffer(term.buffer.normal);`);

    await page.evaluate(`term.reset();`);
    await writeRawSync(page, '123456789012345');
    const buffer4 = await page.evaluate(`inspectBuffer(term.buffer.normal);`);

    assert.throw(() => {
      assert.equal(JSON.stringify(buffer3), JSON.stringify(buffer4));
    });
  });

  it('empty content', async function(): Promise<any> {
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), '');
  });

  it('unwrap wrapped line', async function(): Promise<any> {
    const lines = ['123456789123456789'];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('does not unwrap non-wrapped line', async function(): Promise<any> {
    const lines = [
      '123456789',
      '123456789'
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });


  it('preserve last empty lines', async function(): Promise<any> {
    const cols = 10;
    const lines = [
      '',
      '',
      digitsString(cols),
      digitsString(cols),
      '',
      '',
      digitsString(cols),
      digitsString(cols),
      '',
      '',
      ''
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('digits content', async function(): Promise<any> {
    const rows = 10;
    const cols = 10;
    const digitsLine = digitsString(cols);
    const lines = newArray<string>(digitsLine, rows);
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize with half of scrollback', async function(): Promise<any> {
    const rows = 20;
    const scrollback = rows - 10;
    const halfScrollback = scrollback / 2;
    const cols = 10;
    const lines = newArray<string>((index: number) => digitsString(cols, index), rows);
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize({ scrollback: ${halfScrollback} });`), lines.slice(halfScrollback, rows).join('\r\n'));
  });

  it('serialize 0 rows of scrollback', async function(): Promise<any> {
    const rows = 20;
    const cols = 10;
    const lines = newArray<string>((index: number) => digitsString(cols, index), rows);
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize({ scrollback: 0 });`), lines.slice(rows - 10, rows).join('\r\n'));
  });

  it('serialize exclude modes', async () => {
    await writeSync(page, 'before\\x1b[?1hafter');
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), 'beforeafter\x1b[?1h');
    assert.equal(await page.evaluate(`serializeAddon.serialize({ excludeModes: true });`), 'beforeafter');
  });

  it('serialize exclude alt buffer', async () => {
    await writeSync(page, 'normal\\x1b[?1049h\\x1b[Halt');
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), 'normal\x1b[?1049h\x1b[Halt');
    assert.equal(await page.evaluate(`serializeAddon.serialize({ excludeAltBuffer: true });`), 'normal');
  });

  it('serialize all rows of content with color16', async function(): Promise<any> {
    const cols = 10;
    const color16 = [
      30, 31, 32, 33, 34, 35, 36, 37, // Set foreground color
      90, 91, 92, 93, 94, 95, 96, 97,
      40, 41, 42, 43, 44, 45, 46, 47, // Set background color
      100, 101, 103, 104, 105, 106, 107
    ];
    const rows = color16.length;
    const lines = newArray<string>(
      (index: number) => digitsString(cols, index, `\x1b[${color16[index % color16.length]}m`),
      rows
    );
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with fg/bg flags', async function(): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      sgr(FG_P16_GREEN) + line,  // Workaround: If we clear all flags a the end, serialize will use \x1b[0m to clear instead of the sepcific disable sequence
      sgr(INVERSE) + line,
      sgr(BOLD) + line,
      sgr(UNDERLINED) + line,
      sgr(BLINK) + line,
      sgr(INVISIBLE) + line,
      sgr(STRIKETHROUGH) + line,
      sgr(NO_INVERSE) + line,
      sgr(NO_BOLD) + line,
      sgr(NO_UNDERLINED) + line,
      sgr(NO_BLINK) + line,
      sgr(NO_INVISIBLE) + line,
      sgr(NO_STRIKETHROUGH) + line
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color256', async function(): Promise<any> {
    const rows = 32;
    const cols = 10;
    const lines = newArray<string>(
      (index: number) => digitsString(cols, index, `\x1b[38;5;${16 + index}m`),
      rows
    );
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with overline', async () => {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      sgr(OVERLINED) + line,                   // Overlined
      sgr(UNDERLINED) + line,                  // Overlined, Underlined
      sgr(NORMAL) + line                       // Normal
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color16 and style separately', async function(): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      sgr(FG_P16_RED) + line,     // fg Red,
      sgr(UNDERLINED) + line,     // fg Red, Underlined
      sgr(FG_P16_GREEN) + line,   // fg Green, Underlined
      sgr(INVERSE) + line,        // fg Green, Underlined, Inverse
      sgr(NO_INVERSE) + line,     // fg Green, Underlined
      sgr(INVERSE) + line,        // fg Green, Underlined, Inverse
      sgr(BG_P16_YELLOW) + line,  // fg Green, bg Yellow, Underlined, Inverse
      sgr(FG_RESET) + line,       // bg Yellow, Underlined, Inverse
      sgr(BG_RESET) + line,       // Underlined, Inverse
      sgr(NORMAL) + line          // Back to normal
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color16 and style together', async function(): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      sgr(FG_P16_RED) + line,                   // fg Red
      sgr(FG_P16_GREEN, BG_P16_YELLOW) + line,  // fg Green, bg Yellow
      sgr(UNDERLINED, ITALIC) + line,           // fg Green, bg Yellow, Underlined, Italic
      sgr(NO_UNDERLINED, NO_ITALIC) + line,     // fg Green, bg Yellow
      sgr(FG_RESET, ITALIC) + line,             // bg Yellow, Italic
      sgr(BG_RESET) + line,                     // Italic
      sgr(NORMAL) + line,                       // Back to normal
      sgr(FG_P16_RED) + line,                   // fg Red
      sgr(FG_P16_GREEN, BG_P16_YELLOW) + line,  // fg Green, bg Yellow
      sgr(UNDERLINED, ITALIC) + line,           // fg Green, bg Yellow, Underlined, Italic
      sgr(NO_UNDERLINED, NO_ITALIC) + line,     // fg Green, bg Yellow
      sgr(FG_RESET, ITALIC) + line,             // bg Yellow, Italic
      sgr(BG_RESET) + line                      // Italic
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color256 and style separately', async function(): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      sgr(FG_P256_RED) + line,    // fg Red 256,
      sgr(UNDERLINED) + line,     // fg Red 256, Underlined
      sgr(FG_P256_GREEN) + line,  // fg Green 256, Underlined
      sgr(INVERSE) + line,        // fg Green 256, Underlined, Inverse
      sgr(NO_INVERSE) + line,     // fg Green 256, Underlined
      sgr(INVERSE) + line,        // fg Green 256, Underlined, Inverse
      sgr(BG_P256_YELLOW) + line, // fg Green 256, bg Yellow 256, Underlined, Inverse
      sgr(FG_RESET) + line,       // bg Yellow 256, Underlined, Inverse
      sgr(BG_RESET) + line,       // Underlined, Inverse
      sgr(NORMAL) + line          // Back to normal
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color256 and style together', async function(): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      sgr(FG_P256_RED) + line,                    // fg Red 256
      sgr(FG_P256_GREEN, BG_P256_YELLOW) + line,  // fg Green 256, bg Yellow 256
      sgr(UNDERLINED, ITALIC) + line,             // fg Green 256, bg Yellow 256, Underlined, Italic
      sgr(NO_UNDERLINED, NO_ITALIC) + line,       // fg Green 256, bg Yellow 256
      sgr(FG_RESET, ITALIC) + line,               // bg Yellow 256, Italic
      sgr(BG_RESET) + line,                       // Italic
      sgr(NORMAL) + line,                         // Back to normal
      sgr(FG_P256_RED) + line,                    // fg Red 256
      sgr(FG_P256_GREEN, BG_P256_YELLOW) + line,  // fg Green 256, bg Yellow 256
      sgr(UNDERLINED, ITALIC) + line,             // fg Green 256, bg Yellow 256, Underlined, Italic
      sgr(NO_UNDERLINED, NO_ITALIC) + line,       // fg Green 256, bg Yellow 256
      sgr(FG_RESET, ITALIC) + line,               // bg Yellow 256, Italic
      sgr(BG_RESET) + line                        // Italic
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with colorRGB and style separately', async function(): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      sgr(FG_RGB_RED) + line,     // fg Red RGB,
      sgr(UNDERLINED) + line,     // fg Red RGB, Underlined
      sgr(FG_RGB_GREEN) + line,   // fg Green RGB, Underlined
      sgr(INVERSE) + line,        // fg Green RGB, Underlined, Inverse
      sgr(NO_INVERSE) + line,     // fg Green RGB, Underlined
      sgr(INVERSE) + line,        // fg Green RGB, Underlined, Inverse
      sgr(BG_RGB_YELLOW) + line,  // fg Green RGB, bg Yellow RGB, Underlined, Inverse
      sgr(FG_RESET) + line,       // bg Yellow RGB, Underlined, Inverse
      sgr(BG_RESET) + line,       // Underlined, Inverse
      sgr(NORMAL) + line          // Back to normal
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with colorRGB and style together', async function(): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      sgr(FG_RGB_RED) + line,                   // fg Red RGB
      sgr(FG_RGB_GREEN, BG_RGB_YELLOW) + line,  // fg Green RGB, bg Yellow RGB
      sgr(UNDERLINED, ITALIC) + line,           // fg Green RGB, bg Yellow RGB, Underlined, Italic
      sgr(NO_UNDERLINED, NO_ITALIC) + line,     // fg Green RGB, bg Yellow RGB
      sgr(FG_RESET, ITALIC) + line,             // bg Yellow RGB, Italic
      sgr(BG_RESET) + line,                     // Italic
      sgr(NORMAL) + line,                       // Back to normal
      sgr(FG_RGB_RED) + line,                   // fg Red RGB
      sgr(FG_RGB_GREEN, BG_RGB_YELLOW) + line,  // fg Green RGB, bg Yellow RGB
      sgr(UNDERLINED, ITALIC) + line,           // fg Green RGB, bg Yellow RGB, Underlined, Italic
      sgr(NO_UNDERLINED, NO_ITALIC) + line,     // fg Green RGB, bg Yellow RGB
      sgr(FG_RESET, ITALIC) + line,             // bg Yellow RGB, Italic
      sgr(BG_RESET) + line                      // Italic
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize tabs correctly', async () => {
    const lines = [
      'a\tb',
      'aa\tc',
      'aaa\td'
    ];
    const expected = [
      'a\x1b[7Cb',
      'aa\x1b[6Cc',
      'aaa\x1b[5Cd'
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), expected.join('\r\n'));
  });

  it('serialize CJK correctly', async () => {
    const lines = [
      '中文中文',
      '12中文',
      '中文12',
      // This line is going to be wrapped at last character
      // because it has line length of 11 (1+2*5).
      // We concat it back without the null cell currently.
      // But this may be incorrect.
      // see also #3097
      '1中文中文中'
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize CJK Mixed with tab correctly', async () => {
    const lines = [
      '中文\t12' // CJK mixed with tab
    ];
    const expected = [
      '中文\x1b[4C12'
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), expected.join('\r\n'));
  });

  it('serialize with alt screen correctly', async () => {
    const SMCUP = '\u001b[?1049h';
    const CUP = '\u001b[H';

    const lines = [
      `1${SMCUP}${CUP}2`
    ];
    const expected = [
      `1${SMCUP}${CUP}2`
    ];

    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'alternate');
    assert.equal(JSON.stringify(await page.evaluate(`serializeAddon.serialize();`)), JSON.stringify(expected.join('\r\n')));
  });

  it('serialize without alt screen correctly', async () => {
    const SMCUP = '\u001b[?1049h';
    const RMCUP = '\u001b[?1049l';

    const lines = [
      `1${SMCUP}2${RMCUP}`
    ];
    const expected = [
      `1`
    ];

    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`window.term.buffer.active.type`), 'normal');
    assert.equal(JSON.stringify(await page.evaluate(`serializeAddon.serialize();`)), JSON.stringify(expected.join('\r\n')));
  });

  it('serialize with background', async () => {
    const CLEAR_RIGHT = (l: number): string => `\u001b[${l}X`;

    const lines = [
      `1\u001b[44m${CLEAR_RIGHT(5)}`,
      `2${CLEAR_RIGHT(9)}`
    ];

    await testNormalScreenEqual(page, lines.join('\r\n'));
  });

  it('cause the BCE on scroll', async () => {
    const CLEAR_RIGHT = (l: number): string => `\u001b[${l}X`;

    const padLines = newArray<string>(
      (index: number) => digitsString(10, index),
      10
    );

    const lines = [
      ...padLines,
      `\u001b[44m${CLEAR_RIGHT(5)}1111111111111111`
    ];

    await testNormalScreenEqual(page, lines.join('\r\n'));
  });

  it('handle invalid wrap before scroll', async () => {
    const CLEAR_RIGHT = (l: number): string => `\u001b[${l}X`;
    const MOVE_UP = (l: number): string => `\u001b[${l}A`;
    const MOVE_DOWN = (l: number): string => `\u001b[${l}B`;
    const MOVE_LEFT = (l: number): string => `\u001b[${l}D`;

    // A line wrap happened after current line.
    // But there is no content.
    // so wrap shouldn't even be able to happen.
    const segments = [
      `123456789012345`,
      MOVE_UP(1),
      CLEAR_RIGHT(5),
      MOVE_DOWN(1),
      MOVE_LEFT(5),
      CLEAR_RIGHT(5),
      MOVE_UP(1),
      '1'
    ];

    await testNormalScreenEqual(page, segments.join(''));
  });

  it('handle invalid wrap after scroll', async () => {
    const CLEAR_RIGHT = (l: number): string => `\u001b[${l}X`;
    const MOVE_UP = (l: number): string => `\u001b[${l}A`;
    const MOVE_DOWN = (l: number): string => `\u001b[${l}B`;
    const MOVE_LEFT = (l: number): string => `\u001b[${l}D`;

    const padLines = newArray<string>(
      (index: number) => digitsString(10, index),
      10
    );

    // A line wrap happened after current line.
    // But there is no content.
    // so wrap shouldn't even be able to happen.
    const lines = [
      padLines.join('\r\n'),
      '\r\n',
      `123456789012345`,
      MOVE_UP(1),
      CLEAR_RIGHT(5),
      MOVE_DOWN(1),
      MOVE_LEFT(5),
      CLEAR_RIGHT(5),
      MOVE_UP(1),
      '1'
    ];

    await testNormalScreenEqual(page, lines.join(''));
  });

  describe('handle modes', () => {
    it('applicationCursorKeysMode', async () => {
      await testSerializeEquals('test\u001b[?1h', 'test\u001b[?1h');
      await testSerializeEquals('\u001b[?1l', 'test');
    });
    it('applicationKeypadMode', async () => {
      await testSerializeEquals('test\u001b[?66h', 'test\u001b[?66h');
      await testSerializeEquals('\u001b[?66l', 'test');
    });
    it('bracketedPasteMode', async () => {
      await testSerializeEquals('test\u001b[?2004h', 'test\u001b[?2004h');
      await testSerializeEquals('\u001b[?2004l', 'test');
    });
    it('insertMode', async () => {
      await testSerializeEquals('test\u001b[4h', 'test\u001b[4h');
      await testSerializeEquals('\u001b[4l', 'test');
    });
    it('mouseTrackingMode', async () => {
      await testSerializeEquals('test\u001b[?9h', 'test\u001b[?9h');
      await testSerializeEquals('\u001b[?9l', 'test');
      await testSerializeEquals('\u001b[?1000h', 'test\u001b[?1000h');
      await testSerializeEquals('\u001b[?1000l', 'test');
      await testSerializeEquals('\u001b[?1002h', 'test\u001b[?1002h');
      await testSerializeEquals('\u001b[?1002l', 'test');
      await testSerializeEquals('\u001b[?1003h', 'test\u001b[?1003h');
      await testSerializeEquals('\u001b[?1003l', 'test');
    });
    it('originMode', async () => {
      // origin mode moves cursor to (0,0)
      await testSerializeEquals('test\u001b[?6h', 'test\u001b[4D\u001b[?6h');
      await testSerializeEquals('\u001b[?6l', 'test\u001b[4D');
    });
    it('reverseWraparoundMode', async () => {
      await testSerializeEquals('test\u001b[?45h', 'test\u001b[?45h');
      await testSerializeEquals('\u001b[?45l', 'test');
    });
    it('sendFocusMode', async () => {
      await testSerializeEquals('test\u001b[?1004h', 'test\u001b[?1004h');
      await testSerializeEquals('\u001b[?1004l', 'test');
    });
    it('wraparoundMode', async () => {
      await testSerializeEquals('test\u001b[?7l', 'test\u001b[?7l');
      await testSerializeEquals('\u001b[?7h', 'test');
    });
  });
});

function newArray<T>(initial: T | ((index: number) => T), count: number): T[] {
  const array: T[] = new Array<T>(count);
  for (let i = 0; i < array.length; i++) {
    if (typeof initial === 'function') {
      array[i] = (initial as (index: number) => T)(i);
    } else {
      array[i] = initial as T;
    }
  }
  return array;
}

function digitsString(length: number, from: number = 0, sgr: string = ''): string {
  let s = sgr;
  for (let i = 0; i < length; i++) {
    s += `${(from++) % 10}`;
  }
  return s;
}

function sgr(...seq: string[]): string {
  return `\x1b[${seq.join(';')}m`;
}

const NORMAL = '0';

const FG_P16_RED = '31';
const FG_P16_GREEN = '32';
const FG_P16_YELLOW = '33';
const FG_P256_RED = '38;5;196';
const FG_P256_GREEN = '38;5;46';
const FG_P256_YELLOW = '38;5;226';
const FG_RGB_RED = '38;2;255;0;0';
const FG_RGB_GREEN = '38;2;0;255;0';
const FG_RGB_YELLOW = '38;2;255;255;0';
const FG_RESET = '39';

const BG_P16_RED = '41';
const BG_P16_GREEN = '42';
const BG_P16_YELLOW = '43';
const BG_P256_RED = '48;5;196';
const BG_P256_GREEN = '48;5;46';
const BG_P256_YELLOW = '48;5;226';
const BG_RGB_RED = '48;2;255;0;0';
const BG_RGB_GREEN = '48;2;0;255;0';
const BG_RGB_YELLOW = '48;2;255;255;0';
const BG_RESET = '49';

const BOLD = '1';
const DIM = '2';
const ITALIC = '3';
const UNDERLINED = '4';
const BLINK = '5';
const INVERSE = '7';
const INVISIBLE = '8';
const STRIKETHROUGH = '9';
const OVERLINED = '53';

const NO_BOLD = '22';
const NO_DIM = '22';
const NO_ITALIC = '23';
const NO_UNDERLINED = '24';
const NO_BLINK = '25';
const NO_INVERSE = '27';
const NO_INVISIBLE = '28';
const NO_STRIKETHROUGH = '29';
const NO_OVERLINED = '55';
