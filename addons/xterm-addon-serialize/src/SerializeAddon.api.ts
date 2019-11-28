/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as puppeteer from 'puppeteer';
import { assert } from 'chai';
import { ITerminalOptions } from 'xterm';

const APP = 'http://127.0.0.1:3000/test';

let browser: puppeteer.Browser;
let page: puppeteer.Page;
const width = 800;
const height = 600;

describe('SerializeAddon', () => {
  before(async function (): Promise<any> {
    this.timeout(8 * 1000);
    browser = await puppeteer.launch({
      headless: process.argv.indexOf('--headless') !== -1,
      args: [`--window-size=${width},${height}`]
    });
    page = (await browser.pages())[0];
    await page.setViewport({ width, height });
    await page.goto(APP);
    await openTerminal({ rows: 10, cols: 10, rendererType: 'dom' });
    await page.evaluate(`
      window.serializeAddon = new SerializeAddon();
      window.term.loadAddon(window.serializeAddon);
    `);
  });

  after(async () => await browser.close());
  beforeEach(async () => await page.evaluate(`window.term.reset()`));

  it('empty content', async function (): Promise<any> {
    const rows = 10;
    const cols = 10;
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), '');
  });

  it('trim last empty lines', async function (): Promise<any> {
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
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.slice(0, 8).join('\r\n'));
  });

  it('digits content', async function (): Promise<any> {
    const rows = 10;
    const cols = 10;
    const digitsLine = digitsString(cols);
    const lines = newArray<string>(digitsLine, rows);
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize half rows of content', async function (): Promise<any> {
    const rows = 10;
    const halfRows = rows >> 1;
    const cols = 10;
    const lines = newArray<string>((index: number) => digitsString(cols, index), rows);
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize(${halfRows});`), lines.slice(halfRows, 2 * halfRows).join('\r\n'));
  });

  it('serialize 0 rows of content', async function (): Promise<any> {
    const rows = 10;
    const cols = 10;
    const lines = newArray<string>((index: number) => digitsString(cols, index), rows);
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize(0);`), '');
  });

  it('serialize all rows of content with color16', async function (): Promise<any> {
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

  it('serialize all rows of content with fg/bg flags', async function (): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      mkSGR(FG_P16_GREEN) + line,  // Workaround: If we clear all flags a the end, serialize will use \x1b[0m to clear instead of the sepcific disable sequence
      mkSGR(INVERSE) + line,
      mkSGR(BOLD) + line,
      mkSGR(UNDERLINED) + line,
      mkSGR(BLINK) + line,
      mkSGR(INVISIBLE) + line,
      mkSGR(NO_INVERSE) + line,
      mkSGR(NO_BOLD) + line,
      mkSGR(NO_UNDERLINED) + line,
      mkSGR(NO_BLINK) + line,
      mkSGR(NO_INVISIBLE) + line
    ];
    const rows = lines.length;
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color256', async function (): Promise<any> {
    const rows = 32;
    const cols = 10;
    const lines = newArray<string>(
      (index: number) => digitsString(cols, index, `\x1b[38;5;${index}m`),
      rows
    );
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color16 and style separately', async function (): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      mkSGR(FG_P16_RED) + line,     // fg Red,
      mkSGR(UNDERLINED) + line,     // fg Red, Underlined
      mkSGR(FG_P16_GREEN) + line,   // fg Green, Underlined
      mkSGR(INVERSE) + line,        // fg Green, Underlined, Inverse
      mkSGR(NO_INVERSE) + line,     // fg Green, Underlined
      mkSGR(INVERSE) + line,        // fg Green, Underlined, Inverse
      mkSGR(BG_P16_YELLOW) + line,  // fg Green, bg Yellow, Underlined, Inverse
      mkSGR(FG_RESET) + line,       // bg Yellow, Underlined, Inverse
      mkSGR(BG_RESET) + line,       // Underlined, Inverse
      mkSGR(NORMAL) + line          // Back to normal
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color16 and style together', async function (): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      mkSGR(FG_P16_RED) + line,                   // fg Red
      mkSGR(FG_P16_GREEN, BG_P16_YELLOW) + line,  // fg Green, bg Yellow
      mkSGR(UNDERLINED, ITALIC) + line,           // fg Green, bg Yellow, Underlined, Italic
      mkSGR(NO_UNDERLINED, NO_ITALIC) + line,     // fg Green, bg Yellow
      mkSGR(FG_RESET, ITALIC) + line,             // bg Yellow, Italic
      mkSGR(BG_RESET) + line,                     // Italic
      mkSGR(NORMAL) + line,                       // Back to normal
      mkSGR(FG_P16_RED) + line,                   // fg Red
      mkSGR(FG_P16_GREEN, BG_P16_YELLOW) + line,  // fg Green, bg Yellow
      mkSGR(UNDERLINED, ITALIC) + line,           // fg Green, bg Yellow, Underlined, Italic
      mkSGR(NO_UNDERLINED, NO_ITALIC) + line,     // fg Green, bg Yellow
      mkSGR(FG_RESET, ITALIC) + line,             // bg Yellow, Italic
      mkSGR(BG_RESET) + line                      // Italic
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color256 and style separately', async function (): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      mkSGR(FG_P256_RED) + line,    // fg Red 256,
      mkSGR(UNDERLINED) + line,     // fg Red 256, Underlined
      mkSGR(FG_P256_GREEN) + line,  // fg Green 256, Underlined
      mkSGR(INVERSE) + line,        // fg Green 256, Underlined, Inverse
      mkSGR(NO_INVERSE) + line,     // fg Green 256, Underlined
      mkSGR(INVERSE) + line,        // fg Green 256, Underlined, Inverse
      mkSGR(BG_P256_YELLOW) + line, // fg Green 256, bg Yellow 256, Underlined, Inverse
      mkSGR(FG_RESET) + line,       // bg Yellow 256, Underlined, Inverse
      mkSGR(BG_RESET) + line,       // Underlined, Inverse
      mkSGR(NORMAL) + line          // Back to normal
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with color256 and style together', async function (): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      mkSGR(FG_P256_RED) + line,                    // fg Red 256
      mkSGR(FG_P256_GREEN, BG_P256_YELLOW) + line,  // fg Green 256, bg Yellow 256
      mkSGR(UNDERLINED, ITALIC) + line,             // fg Green 256, bg Yellow 256, Underlined, Italic
      mkSGR(NO_UNDERLINED, NO_ITALIC) + line,       // fg Green 256, bg Yellow 256
      mkSGR(FG_RESET, ITALIC) + line,               // bg Yellow 256, Italic
      mkSGR(BG_RESET) + line,                       // Italic
      mkSGR(NORMAL) + line,                         // Back to normal
      mkSGR(FG_P256_RED) + line,                    // fg Red 256
      mkSGR(FG_P256_GREEN, BG_P256_YELLOW) + line,  // fg Green 256, bg Yellow 256
      mkSGR(UNDERLINED, ITALIC) + line,             // fg Green 256, bg Yellow 256, Underlined, Italic
      mkSGR(NO_UNDERLINED, NO_ITALIC) + line,       // fg Green 256, bg Yellow 256
      mkSGR(FG_RESET, ITALIC) + line,               // bg Yellow 256, Italic
      mkSGR(BG_RESET) + line                        // Italic
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with colorRGB and style separately', async function (): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      mkSGR(FG_RGB_RED) + line,     // fg Red RGB,
      mkSGR(UNDERLINED) + line,     // fg Red RGB, Underlined
      mkSGR(FG_RGB_GREEN) + line,   // fg Green RGB, Underlined
      mkSGR(INVERSE) + line,        // fg Green RGB, Underlined, Inverse
      mkSGR(NO_INVERSE) + line,     // fg Green RGB, Underlined
      mkSGR(INVERSE) + line,        // fg Green RGB, Underlined, Inverse
      mkSGR(BG_RGB_YELLOW) + line,  // fg Green RGB, bg Yellow RGB, Underlined, Inverse
      mkSGR(FG_RESET) + line,       // bg Yellow RGB, Underlined, Inverse
      mkSGR(BG_RESET) + line,       // Underlined, Inverse
      mkSGR(NORMAL) + line          // Back to normal
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize all rows of content with colorRGB and style together', async function (): Promise<any> {
    const cols = 10;
    const line = '+'.repeat(cols);
    const lines: string[] = [
      mkSGR(FG_RGB_RED) + line,                   // fg Red RGB
      mkSGR(FG_RGB_GREEN, BG_RGB_YELLOW) + line,  // fg Green RGB, bg Yellow RGB
      mkSGR(UNDERLINED, ITALIC) + line,           // fg Green RGB, bg Yellow RGB, Underlined, Italic
      mkSGR(NO_UNDERLINED, NO_ITALIC) + line,     // fg Green RGB, bg Yellow RGB
      mkSGR(FG_RESET, ITALIC) + line,             // bg Yellow RGB, Italic
      mkSGR(BG_RESET) + line,                     // Italic
      mkSGR(NORMAL) + line,                       // Back to normal
      mkSGR(FG_RGB_RED) + line,                   // fg Red RGB
      mkSGR(FG_RGB_GREEN, BG_RGB_YELLOW) + line,  // fg Green RGB, bg Yellow RGB
      mkSGR(UNDERLINED, ITALIC) + line,           // fg Green RGB, bg Yellow RGB, Underlined, Italic
      mkSGR(NO_UNDERLINED, NO_ITALIC) + line,     // fg Green RGB, bg Yellow RGB
      mkSGR(FG_RESET, ITALIC) + line,             // bg Yellow RGB, Italic
      mkSGR(BG_RESET) + line                      // Italic
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });

  it('serialize tabs correctly', async () =>  {
    const lines = [
      'a\tb',
      'foo\tbar\tbaz'
    ];
    await writeSync(page, lines.join('\\r\\n'));
    assert.equal(await page.evaluate(`serializeAddon.serialize();`), lines.join('\r\n'));
  });
});

async function openTerminal(options: ITerminalOptions = {}): Promise<void> {
  await page.evaluate(`window.term = new Terminal(${JSON.stringify(options)})`);
  await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
  if (options.rendererType === 'dom') {
    await page.waitForSelector('.xterm-rows');
  } else {
    await page.waitForSelector('.xterm-text-layer');
  }
}

function newArray<T>(initial: T | ((index: number) => T), count: number): T[] {
  const array: T[] = new Array<T>(count);
  for (let i = 0; i < array.length; i++) {
    if (typeof initial === 'function') {
      array[i] = (<(index: number) => T>initial)(i);
    } else {
      array[i] = <T>initial;
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

function mkSGR(...seq: string[]): string {
  return `\x1b[${seq.join(';')}m`;
}

const NORMAL = '0';

const FG_P16_RED = '31';
const FG_P16_GREEN = '32';
const FG_P16_YELLOW = '33';
const FG_P256_RED = '38;5;1';
const FG_P256_GREEN = '38;5;2';
const FG_P256_YELLOW = '38;5;3';
const FG_RGB_RED = '38;2;255;0;0';
const FG_RGB_GREEN = '38;2;0;255;0';
const FG_RGB_YELLOW = '38;2;255;255;0';
const FG_RESET = '39';


const BG_P16_RED = '41';
const BG_P16_GREEN = '42';
const BG_P16_YELLOW = '43';
const BG_P256_RED = '48;5;1';
const BG_P256_GREEN = '48;5;2';
const BG_P256_YELLOW = '48;5;3';
const BG_RGB_RED = '48;2;255;0;0';
const BG_RGB_GREEN = '48;2;0;255;0';
const BG_RGB_YELLOW = '48;2;255;255;0';
const BG_RESET = '49';

const INVERSE = '7';
const BOLD = '1';
const UNDERLINED = '4';
const BLINK = '5';
const INVISIBLE = '8';

const NO_INVERSE = '27';
const NO_BOLD = '22';
const NO_UNDERLINED = '24';
const NO_BLINK = '25';
const NO_INVISIBLE = '28';

const ITALIC = '3';
const DIM = '2';

const NO_ITALIC = '23';
const NO_DIM = '22';

async function writeSync(page: puppeteer.Page, data: string): Promise<void> {
  await page.evaluate(`
    window.ready = false;
    window.term.write('${data}', () => window.ready = true);
  `);
  await pollFor(page, 'window.ready', true);
}

async function pollFor(page: puppeteer.Page, fn: string, val: any, preFn?: () => Promise<void>): Promise<void> {
  if (preFn) {
    await preFn();
  }
  const result = await page.evaluate(fn);
  if (result !== val) {
    return new Promise<void>(r => {
      setTimeout(() => r(pollFor(page, fn, val, preFn)), 10);
    });
  }
}
