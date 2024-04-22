/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IImage32, decodePng } from '@lunapaint/png-codec';
import { LocatorScreenshotOptions, test } from '@playwright/test';
import { ITheme } from '@xterm/xterm';
import { ITestContext, MaybeAsync, openTerminal, pollFor, pollForApproximate } from './TestUtils';

export interface ISharedRendererTestContext {
  value: ITestContext;
  skipCanvasExceptions?: boolean;
  skipDomExceptions?: boolean;
}

export function injectSharedRendererTests(ctx: ISharedRendererTestContext): void {
  test.beforeEach(async () => {
    await ctx.value.proxy.reset();
    ctx.value.page.evaluate(`
      window.term.options.minimumContrastRatio = 1;
      window.term.options.allowTransparency = false;
      window.term.options.theme = undefined;
    `);
    // Clear the cached screenshot before each test
    frameDetails = undefined;
  });

  test.describe('colors', () => {
    test('foreground 0-15', async () => {
      const theme: ITheme = {
        black: '#010203',
        red: '#040506',
        green: '#070809',
        yellow: '#0a0b0c',
        blue: '#0d0e0f',
        magenta: '#101112',
        cyan: '#131415',
        white: '#161718'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.value.proxy.write(`\x1b[30m■\x1b[31m■\x1b[32m■\x1b[33m■\x1b[34m■\x1b[35m■\x1b[36m■\x1b[37m■`);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [1, 2, 3, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [4, 5, 6, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [7, 8, 9, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [10, 11, 12, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [13, 14, 15, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [16, 17, 18, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [19, 20, 21, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [22, 23, 24, 255]);
    });
  });

  test('foreground 0-7 drawBoldTextInBrightColors', async () => {
    const theme: ITheme = {
      brightBlack: '#010203',
      brightRed: '#040506',
      brightGreen: '#070809',
      brightYellow: '#0a0b0c',
      brightBlue: '#0d0e0f',
      brightMagenta: '#101112',
      brightCyan: '#131415',
      brightWhite: '#161718'
    };
    await ctx.value.page.evaluate(`
      window.term.options.theme = ${JSON.stringify(theme)};
      window.term.options.drawBoldTextInBrightColors = true;
    `);
    await ctx.value.proxy.write(`\x1b[1;30m■\x1b[1;31m■\x1b[1;32m■\x1b[1;33m■\x1b[1;34m■\x1b[1;35m■\x1b[1;36m■\x1b[1;37m■`);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [1, 2, 3, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [4, 5, 6, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [7, 8, 9, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [10, 11, 12, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [13, 14, 15, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [16, 17, 18, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [19, 20, 21, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [22, 23, 24, 255]);
  });

  test('background 0-15', async () => {
    const theme: ITheme = {
      black: '#010203',
      red: '#040506',
      green: '#070809',
      yellow: '#0a0b0c',
      blue: '#0d0e0f',
      magenta: '#101112',
      cyan: '#131415',
      white: '#161718'
    };
    await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
    await ctx.value.proxy.write(`\x1b[40m \x1b[41m \x1b[42m \x1b[43m \x1b[44m \x1b[45m \x1b[46m \x1b[47m `);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [1, 2, 3, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [4, 5, 6, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [7, 8, 9, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [10, 11, 12, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [13, 14, 15, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [16, 17, 18, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [19, 20, 21, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [22, 23, 24, 255]);
  });

  test('foreground 0-15 inverse', async () => {
    const theme: ITheme = {
      black: '#010203',
      red: '#040506',
      green: '#070809',
      yellow: '#0a0b0c',
      blue: '#0d0e0f',
      magenta: '#101112',
      cyan: '#131415',
      white: '#161718'
    };
    await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
    await ctx.value.proxy.write(`\x1b[7;30m \x1b[7;31m \x1b[7;32m \x1b[7;33m \x1b[7;34m \x1b[7;35m \x1b[7;36m \x1b[7;37m `);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [1, 2, 3, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [4, 5, 6, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [7, 8, 9, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [10, 11, 12, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [13, 14, 15, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [16, 17, 18, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [19, 20, 21, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [22, 23, 24, 255]);
  });

  test('background 0-15 inverse', async () => {
    const theme: ITheme = {
      black: '#010203',
      red: '#040506',
      green: '#070809',
      yellow: '#0a0b0c',
      blue: '#0d0e0f',
      magenta: '#101112',
      cyan: '#131415',
      white: '#161718'
    };
    await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
    await ctx.value.proxy.write(`\x1b[7;40m■\x1b[7;41m■\x1b[7;42m■\x1b[7;43m■\x1b[7;44m■\x1b[7;45m■\x1b[7;46m■\x1b[7;47m■`);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [1, 2, 3, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [4, 5, 6, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [7, 8, 9, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [10, 11, 12, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [13, 14, 15, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [16, 17, 18, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [19, 20, 21, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [22, 23, 24, 255]);
  });

  test('foreground 0-15 invisible', async () => {
    const theme: ITheme = {
      black: '#010203',
      red: '#040506',
      green: '#070809',
      yellow: '#0a0b0c',
      blue: '#0d0e0f',
      magenta: '#101112',
      cyan: '#131415',
      white: '#161718'
    };
    await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
    await ctx.value.proxy.write(`\x1b[8;30m \x1b[8;31m \x1b[8;32m \x1b[8;33m \x1b[8;34m \x1b[8;35m \x1b[8;36m \x1b[8;37m `);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 0, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [0, 0, 0, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [0, 0, 0, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [0, 0, 0, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [0, 0, 0, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [0, 0, 0, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [0, 0, 0, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [0, 0, 0, 255]);
  });

  test('background 0-15 invisible', async () => {
    const theme: ITheme = {
      black: '#010203',
      red: '#040506',
      green: '#070809',
      yellow: '#0a0b0c',
      blue: '#0d0e0f',
      magenta: '#101112',
      cyan: '#131415',
      white: '#161718'
    };
    await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
    await ctx.value.proxy.write(`\x1b[8;40m■\x1b[8;41m■\x1b[8;42m■\x1b[8;43m■\x1b[8;44m■\x1b[8;45m■\x1b[8;46m■\x1b[8;47m■`);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [1, 2, 3, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [4, 5, 6, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [7, 8, 9, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [10, 11, 12, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [13, 14, 15, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [16, 17, 18, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [19, 20, 21, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [22, 23, 24, 255]);
  });

  test('foreground 0-15 bright', async () => {
    const theme: ITheme = {
      brightBlack: '#010203',
      brightRed: '#040506',
      brightGreen: '#070809',
      brightYellow: '#0a0b0c',
      brightBlue: '#0d0e0f',
      brightMagenta: '#101112',
      brightCyan: '#131415',
      brightWhite: '#161718'
    };
    await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
    await ctx.value.proxy.write(`\x1b[90m■\x1b[91m■\x1b[92m■\x1b[93m■\x1b[94m■\x1b[95m■\x1b[96m■\x1b[97m■`);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [1, 2, 3, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [4, 5, 6, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [7, 8, 9, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [10, 11, 12, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [13, 14, 15, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [16, 17, 18, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [19, 20, 21, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [22, 23, 24, 255]);
  });

  test('background 0-15 bright', async () => {
    const theme: ITheme = {
      brightBlack: '#010203',
      brightRed: '#040506',
      brightGreen: '#070809',
      brightYellow: '#0a0b0c',
      brightBlue: '#0d0e0f',
      brightMagenta: '#101112',
      brightCyan: '#131415',
      brightWhite: '#161718'
    };
    await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
    await ctx.value.proxy.write(`\x1b[100m \x1b[101m \x1b[102m \x1b[103m \x1b[104m \x1b[105m \x1b[106m \x1b[107m `);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [1, 2, 3, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [4, 5, 6, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [7, 8, 9, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [10, 11, 12, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [13, 14, 15, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [16, 17, 18, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [19, 20, 21, 255]);
    await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [22, 23, 24, 255]);
  });

  test('foreground 16-255', async () => {
    let data = '';
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        data += `\x1b[38;5;${16 + y * 16 + x}m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cssColor = COLORS_16_TO_255[y * 16 + x];
        const r = parseInt(cssColor.slice(1, 3), 16);
        const g = parseInt(cssColor.slice(3, 5), 16);
        const b = parseInt(cssColor.slice(5, 7), 16);
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [r, g, b, 255]);
      }
    }
  });

  test('background 16-255', async () => {
    let data = '';
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        data += `\x1b[48;5;${16 + y * 16 + x}m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cssColor = COLORS_16_TO_255[y * 16 + x];
        const r = parseInt(cssColor.slice(1, 3), 16);
        const g = parseInt(cssColor.slice(3, 5), 16);
        const b = parseInt(cssColor.slice(5, 7), 16);
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [r, g, b, 255]);
      }
    }
  });

  test('foreground 16-255 inverse', async () => {
    let data = '';
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        data += `\x1b[7;38;5;${16 + y * 16 + x}m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cssColor = COLORS_16_TO_255[y * 16 + x];
        const r = parseInt(cssColor.slice(1, 3), 16);
        const g = parseInt(cssColor.slice(3, 5), 16);
        const b = parseInt(cssColor.slice(5, 7), 16);
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [r, g, b, 255]);
      }
    }
  });

  test('background 16-255 inverse', async () => {
    let data = '';
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        data += `\x1b[7;48;5;${16 + y * 16 + x}m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cssColor = COLORS_16_TO_255[y * 16 + x];
        const r = parseInt(cssColor.slice(1, 3), 16);
        const g = parseInt(cssColor.slice(3, 5), 16);
        const b = parseInt(cssColor.slice(5, 7), 16);
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [r, g, b, 255]);
      }
    }
  });

  test('foreground 16-255 invisible', async () => {
    let data = '';
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        data += `\x1b[8;38;5;${16 + y * 16 + x}m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, 0, 0, 255]);
      }
    }
  });

  test('background 16-255 invisible', async () => {
    let data = '';
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        data += `\x1b[8;48;5;${16 + y * 16 + x}m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cssColor = COLORS_16_TO_255[y * 16 + x];
        const r = parseInt(cssColor.slice(1, 3), 16);
        const g = parseInt(cssColor.slice(3, 5), 16);
        const b = parseInt(cssColor.slice(5, 7), 16);
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [r, g, b, 255]);
      }
    }
  });

  test('foreground 16-255 dim', async () => {
    let data = '';
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        data += `\x1b[2;38;5;${16 + y * 16 + x}m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cssColor = COLORS_16_TO_255[y * 16 + x];
        const r = parseInt(cssColor.slice(1, 3), 16);
        const g = parseInt(cssColor.slice(3, 5), 16);
        const b = parseInt(cssColor.slice(5, 7), 16);
        // It's difficult to assert the exact color due to rounding, just ensure the color differs
        // to the regular color
        await pollFor(ctx.value.page, async () => {
          const c = await getCellColor(ctx.value, x + 1, y + 1);
          return (
            (c[0] === 0 || c[0] !== r) &&
            (c[1] === 0 || c[1] !== g) &&
            (c[2] === 0 || c[2] !== b)
          );
        }, true);
      }
    }
  });

  test('background 16-255 dim', async () => {
    let data = '';
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        data += `\x1b[2;48;5;${16 + y * 16 + x}m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 240 / 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cssColor = COLORS_16_TO_255[y * 16 + x];
        const r = parseInt(cssColor.slice(1, 3), 16);
        const g = parseInt(cssColor.slice(3, 5), 16);
        const b = parseInt(cssColor.slice(5, 7), 16);
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [r, g, b, 255]);
      }
    }
  });

  test('foreground true color red', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[38;2;${i};0;0m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [i, 0, 0, 255]);
      }
    }
  });

  test('background true color red', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[48;2;${i};0;0m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [i, 0, 0, 255]);
      }
    }
  });

  test('foreground true color green', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[38;2;0;${i};0m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, i, 0, 255]);
      }
    }
  });

  test('background true color green', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[48;2;0;${i};0m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, i, 0, 255]);
      }
    }
  });

  test('foreground true color blue', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[38;2;0;0;${i}m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, 0, i, 255]);
      }
    }
  });

  test('background true color blue', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[48;2;0;0;${i}m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, 0, i, 255]);
      }
    }
  });

  test('foreground true color grey', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[38;2;${i};${i};${i}m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [i, i, i, 255]);
      }
    }
  });

  test('background true color grey', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[48;2;${i};${i};${i}m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [i, i, i, 255]);
      }
    }
  });

  test('foreground true color red inverse', async function(): Promise<void> {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[7;38;2;${i};0;0m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [i, 0, 0, 255]);
      }
    }
  });

  test('background true color red inverse', async function(): Promise<void> {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[7;48;2;${i};0;0m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [i, 0, 0, 255]);
      }
    }
  });

  test('foreground true color green inverse', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[7;38;2;0;${i};0m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, i, 0, 255]);
      }
    }
  });

  test('background true color green inverse', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[7;48;2;0;${i};0m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, i, 0, 255]);
      }
    }
  });

  test('foreground true color blue inverse', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[7;38;2;0;0;${i}m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, 0, i, 255]);
      }
    }
  });

  test('background true color blue inverse', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[7;48;2;0;0;${i}m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, 0, i, 255]);
      }
    }
  });

  test('foreground true color grey inverse', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[7;38;2;${i};${i};${i}m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [i, i, i, 255]);
      }
    }
  });

  test('background true color grey inverse', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[7;48;2;${i};${i};${i}m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [i, i, i, 255]);
      }
    }
  });

  test('foreground true color grey invisible', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[8;38;2;${i};${i};${i}m \x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [0, 0, 0, 255]);
      }
    }
  });

  test('background true color grey invisible', async () => {
    let data = '';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        data += `\x1b[8;48;2;${i};${i};${i}m■\x1b[0m`;
      }
      data += '\r\n';
    }
    await ctx.value.proxy.write(data);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const i = y * 16 + x;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, x + 1, y + 1), [i, i, i, 255]);
      }
    }
  });

  test.describe('minimumContrastRatio', async () => {
    test('should adjust 0-15 colors on black background', async () => {
      const theme: ITheme = {
        black: '#2e3436',
        red: '#cc0000',
        green: '#4e9a06',
        yellow: '#c4a000',
        blue: '#3465a4',
        magenta: '#75507b',
        cyan: '#06989a',
        white: '#d3d7cf',
        brightBlack: '#555753',
        brightRed: '#ef2929',
        brightGreen: '#8ae234',
        brightYellow: '#fce94f',
        brightBlue: '#729fcf',
        brightMagenta: '#ad7fa8',
        brightCyan: '#34e2e2',
        brightWhite: '#eeeeec'
      };
      await ctx.value.page.evaluate(`
        window.term.options.theme = ${JSON.stringify(theme)};
        window.term.options.minimumContrastRatio = 1;
      `);
      await ctx.value.proxy.write(
        `\x1b[30m■\x1b[31m■\x1b[32m■\x1b[33m■\x1b[34m■\x1b[35m■\x1b[36m■\x1b[37m■\r\n` +
        `\x1b[90m■\x1b[91m■\x1b[92m■\x1b[93m■\x1b[94m■\x1b[95m■\x1b[96m■\x1b[97m■`
      );
      // Validate before minimumContrastRatio is applied
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0x2e, 0x34, 0x36, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [0xcc, 0x00, 0x00, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [0x4e, 0x9a, 0x06, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [0xc4, 0xa0, 0x00, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [0x34, 0x65, 0xa4, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [0x75, 0x50, 0x7b, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [0x06, 0x98, 0x9a, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [0xd3, 0xd7, 0xcf, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 2), [0x55, 0x57, 0x53, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 2), [0xef, 0x29, 0x29, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 2), [0x8a, 0xe2, 0x34, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 2), [0xfc, 0xe9, 0x4f, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 2), [0x72, 0x9f, 0xcf, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 2), [0xad, 0x7f, 0xa8, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 2), [0x34, 0xe2, 0xe2, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 2), [0xee, 0xee, 0xec, 255]);
      // Setting and check for minimum contrast values, note that these are not
      // exact to the contrast ratio, if the increase luminance algorithm
      // changes then these will probably fail
      await ctx.value.page.evaluate(`window.term.options.minimumContrastRatio = 10;`);
      frameDetails = undefined;
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [176, 180, 180, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [238, 158, 158, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [152, 198, 110, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [208, 179, 49, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [161, 183, 215, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [191, 174, 194, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [110, 197, 198, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [211, 215, 207, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 2), [183, 185, 183, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 2), [249, 156, 156, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 2), [138, 226, 52, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 2), [252, 233, 79, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 2), [154, 186, 221, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 2), [203, 173, 199, 255]);
      // Unchanged
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 2), [0x34, 0xe2, 0xe2, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 2), [0xee, 0xee, 0xec, 255]);
    });

    test('should adjust 0-15 colors on white background', async () => {
      const theme: ITheme = {
        background: '#ffffff',
        black: '#2e3436',
        red: '#cc0000',
        green: '#4e9a06',
        yellow: '#c4a000',
        blue: '#3465a4',
        magenta: '#75507b',
        cyan: '#06989a',
        white: '#d3d7cf',
        brightBlack: '#555753',
        brightRed: '#ef2929',
        brightGreen: '#8ae234',
        brightYellow: '#fce94f',
        brightBlue: '#729fcf',
        brightMagenta: '#ad7fa8',
        brightCyan: '#34e2e2',
        brightWhite: '#eeeeec'
      };
      await ctx.value.page.evaluate(`
        window.term.options.theme = ${JSON.stringify(theme)};
        window.term.options.minimumContrastRatio = 1;
      `);
      await ctx.value.proxy.write(
        `\x1b[30m■\x1b[31m■\x1b[32m■\x1b[33m■\x1b[34m■\x1b[35m■\x1b[36m■\x1b[37m■\r\n` +
        `\x1b[90m■\x1b[91m■\x1b[92m■\x1b[93m■\x1b[94m■\x1b[95m■\x1b[96m■\x1b[97m■`
      );
      // Validate before minimumContrastRatio is applied
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0x2e, 0x34, 0x36, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [0xcc, 0x00, 0x00, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [0x4e, 0x9a, 0x06, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [0xc4, 0xa0, 0x00, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [0x34, 0x65, 0xa4, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [0x75, 0x50, 0x7b, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [0x06, 0x98, 0x9a, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [0xd3, 0xd7, 0xcf, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 2), [0x55, 0x57, 0x53, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 2), [0xef, 0x29, 0x29, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 2), [0x8a, 0xe2, 0x34, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 2), [0xfc, 0xe9, 0x4f, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 2), [0x72, 0x9f, 0xcf, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 2), [0xad, 0x7f, 0xa8, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 2), [0x34, 0xe2, 0xe2, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 2), [0xee, 0xee, 0xec, 255]);
      // Setting and check for minimum contrast values, note that these are not
      // exact to the contrast ratio, if the increase luminance algorithm
      // changes then these will probably fail
      await ctx.value.page.evaluate(`window.term.options.minimumContrastRatio = 10;`);
      frameDetails = undefined;
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [46, 52, 54, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [132, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [36, 72, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 1), [72, 59, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 1), [32, 64, 106, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 1), [75, 51, 80, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 1), [0, 71, 72, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 1), [64, 64, 63, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 2), [61, 63, 59, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 2), [125, 19, 19, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 2), [40, 67, 13, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 4, 2), [67, 63, 19, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 5, 2), [45, 65, 87, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 6, 2), [81, 57, 78, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 7, 2), [13, 67, 67, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 8, 2), [64, 64, 64, 255]);
    });

    test('should enforce half the contrast for dim cells', async () => {
      const theme: ITheme = {
        background: '#ffffff',
        black: '#2e3436',
        red: '#cc0000',
        green: '#4e9a06',
        yellow: '#c4a000',
        blue: '#3465a4',
        magenta: '#75507b',
        cyan: '#06989a',
        white: '#d3d7cf',
        brightBlack: '#555753',
        brightRed: '#ef2929',
        brightGreen: '#8ae234',
        brightYellow: '#fce94f',
        brightBlue: '#729fcf',
        brightMagenta: '#ad7fa8',
        brightCyan: '#34e2e2',
        brightWhite: '#eeeeec'
      };
      await ctx.value.page.evaluate(`
        window.term.options.theme = ${JSON.stringify(theme)};
        window.term.options.minimumContrastRatio = 1;
      `);
      await ctx.value.proxy.write(
        '\x1b[2m' +
        `\x1b[30m■\x1b[31m■\x1b[32m■\x1b[33m■\x1b[34m■\x1b[35m■\x1b[36m■\x1b[37m■\r\n` +
        `\x1b[90m■\x1b[91m■\x1b[92m■\x1b[93m■\x1b[94m■\x1b[95m■\x1b[96m■\x1b[97m■`
      );
      // Validate before minimumContrastRatio is applied
      const marginOfError = 1;
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 1, 1), [Math.floor((255 + 0x2e) / 2), Math.floor((255 + 0x34) / 2), Math.floor((255 + 0x36) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 2, 1), [Math.floor((255 + 0xcc) / 2), Math.floor((255 + 0x00) / 2), Math.floor((255 + 0x00) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 3, 1), [Math.floor((255 + 0x4e) / 2), Math.floor((255 + 0x9a) / 2), Math.floor((255 + 0x06) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 4, 1), [Math.floor((255 + 0xc4) / 2), Math.floor((255 + 0xa0) / 2), Math.floor((255 + 0x00) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 5, 1), [Math.floor((255 + 0x34) / 2), Math.floor((255 + 0x65) / 2), Math.floor((255 + 0xa4) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 6, 1), [Math.floor((255 + 0x75) / 2), Math.floor((255 + 0x50) / 2), Math.floor((255 + 0x7b) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 7, 1), [Math.floor((255 + 0x06) / 2), Math.floor((255 + 0x98) / 2), Math.floor((255 + 0x9a) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 8, 1), [Math.floor((255 + 0xd3) / 2), Math.floor((255 + 0xd7) / 2), Math.floor((255 + 0xcf) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 1, 2), [Math.floor((255 + 0x55) / 2), Math.floor((255 + 0x57) / 2), Math.floor((255 + 0x53) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 2, 2), [Math.floor((255 + 0xef) / 2), Math.floor((255 + 0x29) / 2), Math.floor((255 + 0x29) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 3, 2), [Math.floor((255 + 0x8a) / 2), Math.floor((255 + 0xe2) / 2), Math.floor((255 + 0x34) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 4, 2), [Math.floor((255 + 0xfc) / 2), Math.floor((255 + 0xe9) / 2), Math.floor((255 + 0x4f) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 5, 2), [Math.floor((255 + 0x72) / 2), Math.floor((255 + 0x9f) / 2), Math.floor((255 + 0xcf) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 6, 2), [Math.floor((255 + 0xad) / 2), Math.floor((255 + 0x7f) / 2), Math.floor((255 + 0xa8) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 7, 2), [Math.floor((255 + 0x34) / 2), Math.floor((255 + 0xe2) / 2), Math.floor((255 + 0xe2) / 2), 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 8, 2), [Math.floor((255 + 0xee) / 2), Math.floor((255 + 0xee) / 2), Math.floor((255 + 0xec) / 2), 255]);
      // Setting and check for minimum contrast values, note that these are not
      // exact to the contrast ratio, if the increase luminance algorithm
      // changes then these will probably fail
      await ctx.value.page.evaluate(`window.term.options.minimumContrastRatio = 10;`);
      frameDetails = undefined;
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 1, 1), [150, 153, 154, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 2, 1), [229, 127, 127, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 3, 1), [63, 124, 4, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 4, 1), [127, 104, 0, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 5, 1), [153, 178, 209, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 6, 1), [186, 167, 189, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 7, 1), [4, 122, 124, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 8, 1), [110, 112, 108, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 1, 2), [170, 171, 169, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 2, 2), [215, 36, 36, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 3, 2), [72, 117, 25, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 4, 2), [117, 109, 36, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 5, 2), [72, 103, 135, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 6, 2), [125, 91, 121, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 7, 2), [25, 117, 117, 255]);
      await pollForApproximate(ctx.value.page, marginOfError, () => getCellColor(ctx.value, 8, 2), [111, 111, 110, 255]);
    });
  });

  (ctx.skipCanvasExceptions ? test.describe.skip : test.describe)('selectionBackground', async () => {
    test('should resolve the inverse foreground color based on the original background color, not the selection', async () => {
      const theme: ITheme = {
        foreground: '#FF0000',
        background: '#00FF00',
        selectionBackground: '#0000FF'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.value.proxy.write( ` ■\x1b[7m■\x1b[0m`);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 255, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [255, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [0, 255, 0, 255]);
      await ctx.value.proxy.selectAll();
      frameDetails = undefined;
      // Selection only cell needs to be first to ensure renderer has kicked in
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 255, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [255, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [0, 255, 0, 255]);
    });
  });

  (ctx.skipCanvasExceptions ? test.describe.skip : test.describe)('selectionInactiveBackground', async () => {
    test('should render the the inactive selection when not focused', async () => {
      const theme: ITheme = {
        selectionBackground: '#FF000080',
        selectionInactiveBackground: '#0000FF80'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.value.proxy.focus();
      // Check both the cursor line and another line
      await ctx.value.proxy.writeln('_ ');
      await ctx.value.proxy.write('_ ');
      await ctx.value.proxy.selectAll();
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [128, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [128, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 2), [128, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 2), [128, 0, 0, 255]);
      await ctx.value.page.evaluate(`document.activeElement.blur()`);
      frameDetails = undefined;
      // Selection only cell needs to be first to ensure renderer has kicked in
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 128, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [0, 0, 128, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 2), [0, 0, 128, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 2), [0, 0, 128, 255]);
    });
  });

  (ctx.skipCanvasExceptions || ctx.skipDomExceptions ? test.describe.skip : test.describe)('selection blending', () => {
    test('background', async () => {
      const theme: ITheme = {
        red: '#CC0000',
        selectionBackground: '#FFFFFF'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.value.proxy.focus();
      await ctx.value.proxy.writeln('\x1b[41m red bg\x1b[0m');
      await ctx.value.proxy.writeln('\x1b[7m inverse\x1b[0m');
      await ctx.value.proxy.writeln('\x1b[31;7m red fg inverse\x1b[0m');
      await ctx.value.proxy.writeln('\x1b[48:2:0:204:0:0m red truecolor bg\x1b[0m');
      await ctx.value.proxy.selectAll();
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [230, 128, 128, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 2), [255, 255, 255, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 3), [230, 128, 128, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 4), [230, 128, 128, 255]);
    });
    test('powerline decorative symbols', async () => {
      const theme: ITheme = {
        red: '#CC0000',
        green: '#00CC00',
        selectionBackground: '#FFFFFF'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.value.proxy.focus();
      await ctx.value.proxy.writeln('\u{E0B4} plain\x1b[0m');
      await ctx.value.proxy.writeln('\x1b[31;42m\u{E0B4} red fg green bg\x1b[0m');
      await ctx.value.proxy.writeln('\x1b[32;41m\u{E0B4} green fg red bg\x1b[0m');
      await ctx.value.proxy.writeln('\x1b[31;42;7m\u{E0B4} red fg green bg inverse\x1b[0m');
      await ctx.value.proxy.writeln('\x1b[32;41;7m\u{E0B4} green fg red bg inverse\x1b[0m');
      await ctx.value.proxy.selectAll();
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [255,255,255,255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 2), [230, 128, 128, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 3), [128, 230, 128, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 4), [128, 230, 128, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 5), [230, 128, 128, 255]);
    });
  });

  test.describe('allowTransparency', async () => {
    test.beforeEach(() => ctx.value.page.evaluate(`term.options.allowTransparency = true`));

    test('transparent background inverse', async () => {
      const theme: ITheme = {
        background: '#ff000080'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      const data = `\x1b[7m■\x1b[0m`;
      await ctx.value.proxy.write( data);
      // Inverse background should be opaque
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [255, 0, 0, 255]);
    });
  });

  (ctx.skipCanvasExceptions ? test.describe.skip : test.describe)('selectionForeground', () => {
    test('transparent background inverse', async () => {
      const theme: ITheme = {
        selectionForeground: '#ff0000'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      const data = `\x1b[7m■\x1b[0m`;
      await ctx.value.proxy.write( data);
      await ctx.value.proxy.selectAll();
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [255, 0, 0, 255]);
    });
  });

  test.describe('decoration color overrides', async () => {
    test('foregroundColor', async () => {
      await ctx.value.page.evaluate(`
        const marker = window.term.registerMarker(-window.term.buffer.active.cursorY);
        window.term.registerDecoration({
          marker,
          foregroundColor: '#ff0000',
          backgroundColor: '#0000ff'
        });
      `);
      const data = `■`;
      await ctx.value.proxy.write( data);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [255, 0, 0, 255]);
    });
    test('foregroundColor should ignore inverse', async () => {
      await ctx.value.page.evaluate(`
        const marker = window.term.registerMarker(-window.term.buffer.active.cursorY);
        window.term.registerDecoration({
          marker,
          foregroundColor: '#ff0000',
          backgroundColor: '#0000ff'
        });
      `);
      const data = `\x1b[7m■\x1b[0m`;
      await ctx.value.proxy.write( data);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [255, 0, 0, 255]);
    });
    test('foregroundColor should ignore inverse (only fg on decoration)', async () => {
      await ctx.value.page.evaluate(`
        const marker = window.term.registerMarker(-window.term.buffer.active.cursorY);
        window.term.registerDecoration({
          marker,
          width: 2,
          foregroundColor: '#ff0000'
        });
      `);
      const data = `\x1b[7m■ \x1b[0m`;
      await ctx.value.proxy.write( data);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [255, 0, 0, 255]); // inverse foreground of '■' should be decoration fg override
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [255, 255, 255, 255]); // inverse background of ' ' should be default foreground
    });
    test('backgroundColor', async () => {
      await ctx.value.page.evaluate(`
        const marker = window.term.registerMarker(-window.term.buffer.active.cursorY);
        window.term.registerDecoration({
          marker,
          foregroundColor: '#ff0000',
          backgroundColor: '#0000ff'
        });
      `);
      const data = ` `;
      await ctx.value.proxy.write( data);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 255, 255]);
    });
    test('backgroundColor should ignore inverse', async () => {
      await ctx.value.page.evaluate(`
        const marker = window.term.registerMarker(-window.term.buffer.active.cursorY);
        window.term.registerDecoration({
          marker,
          foregroundColor: '#ff0000',
          backgroundColor: '#0000ff'
        });
      `);
      const data = `\x1b[7m \x1b[0m`;
      await ctx.value.proxy.write( data);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 255, 255]);
    });
    (ctx.skipCanvasExceptions ? test.skip : test)('backgroundColor should ignore inverse (only bg on decoration)', async () => {
      const data = `\x1b[7m■ \x1b[0m`;
      await ctx.value.proxy.write( data);
      await ctx.value.page.evaluate(`
        const marker = window.term.registerMarker(-window.term.buffer.active.cursorY);
        window.term.registerDecoration({
          marker,
          width: 2,
          backgroundColor: '#0000ff'
        });
      `);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 0, 255]); // inverse foreground of '■' should be default
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [0, 0, 255, 255]); // inverse background of ' ' should be decoration bg override
    });
  });

  test.describe('regression tests', () => {
    (ctx.skipCanvasExceptions ? test.skip : test)('#4736: inactive selection background should replace regular cell background color', async () => {
      const theme: ITheme = {
        selectionBackground: '#FF0000',
        selectionInactiveBackground: '#0000FF'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.value.proxy.writeln(' ');
      await ctx.value.proxy.writeln(' O ');
      await ctx.value.proxy.writeln(' ');
      await ctx.value.proxy.focus();
      await ctx.value.proxy.selectAll();
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [255, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [255, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 2), [255, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 3), [255, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 3), [255, 0, 0, 255]);
      await ctx.value.proxy.blur();
      frameDetails = undefined;
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 255, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [0, 0, 255, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 2), [0, 0, 255, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 3), [0, 0, 255, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 3), [0, 0, 255, 255]);
    });
    test('#4758: multiple invisible text characters without SGR change should not be rendered', async () => {
      // Regression test: #4758 when multiple invisible characters are used
      await ctx.value.proxy.writeln(`■\x1b[8m■■`);
      // Full refresh as the before result is the same as after
      await ctx.value.proxy.refresh(0, await ctx.value.proxy.rows - 1);
      // Control to ensure rendering has occurred
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [255, 255, 255, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [0, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [0, 0, 0, 255]);
    });
    // HACK: It's not clear why DOM is failing here
    (ctx.skipDomExceptions ? test.skip : test)('#4759: minimum contrast ratio should be respected on inverse text', async () => {
      const theme: ITheme = {
        foreground: '#aaaaaa',
        background: '#333333'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.value.proxy.write(`\x1b[7m■■`);
      // Validate before minimumContrastRatio is applied
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [51, 51, 51, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [51, 51, 51, 255]);
      await ctx.value.page.evaluate(`window.term.options.minimumContrastRatio = 10;`);
      frameDetails = undefined;
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [0, 0, 0, 255]);
    });
    (ctx.skipCanvasExceptions ? test.skip : test)('#4759: minimum contrast ratio should be respected on selected inverse text', async () => {
      const theme: ITheme = {
        foreground: '#777777',
        background: '#555555',
        selectionBackground: '#666666' // Slightly more contrast needed for selection
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.value.proxy.write(`\x1b[7m■■`);
      await ctx.value.proxy.selectAll();
      // Validate before minimumContrastRatio is applied
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [85, 85, 85, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [85, 85, 85, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [102, 102, 102, 255]);
      await ctx.value.page.evaluate(`window.term.options.minimumContrastRatio = 10;`);
      await ctx.value.proxy.selectAll();
      frameDetails = undefined;
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [255, 255, 255, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 2, 1), [255, 255, 255, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 3, 1), [102, 102, 102, 255]);
    });
    test('#4773: block cursor should render when the cell is selected', async () => {
      const theme: ITheme = {
        cursor: '#0000FF',
        selectionBackground: '#FF0000'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      await ctx.value.proxy.focus();
      await ctx.value.proxy.selectAll();
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 255, 255]);
    });
    test('#4799: cursor should be in the correct position', async () => {
      const theme: ITheme = {
        cursor: '#0000FF'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      for (let index = 0; index < 160; index++) {
        await ctx.value.proxy.writeln(``);
      }
      await ctx.value.proxy.focus();
      await ctx.value.proxy.write('\x1b[A');
      await ctx.value.proxy.write('\x1b[A');
      await ctx.value.proxy.scrollLines(-2);
      const rows = await ctx.value.proxy.rows;
      // block cursor style
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, rows), [0, 0, 255, 255]);
      await ctx.value.proxy.blur();
      frameDetails = undefined;
      // outlink cursor style
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, rows), [0, 0, 0, 255]);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, rows, CellColorPosition.FIRST), [0, 0, 255, 255]);
    });
    test('#4917 The selection should not be displayed if it is not within the scope of the viewport.', async () => {
      const theme: ITheme = {
        selectionBackground: '#FF0000'
      };
      await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
      for (let index = 0; index < 160; index++) {
        await ctx.value.proxy.writeln(``);
      }
      await ctx.value.proxy.scrollToBottom();
      const rows = await ctx.value.proxy.buffer.active.length;
      await ctx.value.proxy.selectLines(rows - 1, rows - 1);
      await ctx.value.proxy.scrollLines(-2);
      await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 0, 255]);
    });
  });
}

enum CellColorPosition {
  CENTER = 0,
  FIRST = 1
}

/**
 * Injects shared renderer tests where it's required to re-initialize the terminal for each test.
 * This is much slower than just calling `Terminal.reset` but testing some features needs this
 * treatment.
 */
export function injectSharedRendererTestsStandalone(ctx: ISharedRendererTestContext, setupCb: () => Promise<void> | void): void {
  test.describe('standalone tests', () => {
    test.beforeEach(async () => {
      // Recreate terminal
      await openTerminal(ctx.value);
      await ctx.value.page.evaluate(`
        window.term.options.minimumContrastRatio = 1;
        window.term.options.allowTransparency = false;
        window.term.options.theme = undefined;
      `);
      await setupCb();
      // Clear the cached screenshot before each test
      frameDetails = undefined;
    });
    test.describe('regression tests', () => {
      test('#4790: cursor should not be displayed before focusing', async () => {
        const theme: ITheme = {
          cursor: '#0000FF'
        };
        await ctx.value.page.evaluate(`window.term.options.theme = ${JSON.stringify(theme)};`);
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 0, 255]);
        await ctx.value.proxy.focus();
        frameDetails = undefined;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 255, 255]);
        await ctx.value.proxy.blur();
        frameDetails = undefined;
        await pollFor(ctx.value.page, () => getCellColor(ctx.value, 1, 1), [0, 0, 0, 255]);
      });
    });
  });
}

/**
 * Gets the color of the pixel in the center of a cell.
 * @param ctx The test context.
 * @param col The 1-based column index to get the color for.
 * @param row The 1-based row index to get the color for.
 */
function getCellColor(ctx: ITestContext, col: number, row: number, position: CellColorPosition = CellColorPosition.CENTER): MaybeAsync<[red: number, green: number, blue: number, alpha: number]> {
  if (!frameDetails) {
    return getFrameDetails(ctx).then(frameDetails => getCellColorInner(frameDetails, col, row));
  }
  switch (position) {
    case CellColorPosition.CENTER:
      return getCellColorInner(frameDetails, col, row);
    case CellColorPosition.FIRST:
      return getCellColorFirstPoint(frameDetails, col, row);
  }
}

let frameDetails: { cols: number, rows: number, decoded: IImage32 } | undefined = undefined;
async function getFrameDetails(ctx: ITestContext): Promise<{ cols: number, rows: number, decoded: IImage32 }> {
  const screenshotOptions: LocatorScreenshotOptions | undefined = process.env.DEBUG ? { path: 'out-test/playwright/screenshot.png' } : undefined;
  const buffer = await ctx.page.locator('#terminal-container .xterm-screen').screenshot(screenshotOptions);
  frameDetails = {
    cols: await ctx.proxy.cols,
    rows: await ctx.proxy.rows,
    decoded: (await decodePng(buffer, { force32: true })).image
  };
  return frameDetails;
}

function getCellColorInner(frameDetails: { cols: number, rows: number, decoded: IImage32 }, col: number, row: number): [red: number, green: number, blue: number, alpha: number] {
  const cellSize = {
    width: frameDetails.decoded.width / frameDetails.cols,
    height: frameDetails.decoded.height / frameDetails.rows
  };
  const x = Math.floor((col - 1/* 1- to 0-based index */ + 0.5/* middle of cell */) * cellSize.width);
  const y = Math.floor((row - 1/* 1- to 0-based index */ + 0.5/* middle of cell */) * cellSize.height);
  const i = (y * frameDetails.decoded.width + x) * 4/* 4 channels per pixel */;
  return Array.from(frameDetails.decoded.data.slice(i, i + 4)) as [number, number, number, number];
}

function getCellColorFirstPoint(frameDetails: { cols: number, rows: number, decoded: IImage32 }, col: number, row: number): [red: number, green: number, blue: number, alpha: number] {
  const cellSize = {
    width: frameDetails.decoded.width / frameDetails.cols,
    height: frameDetails.decoded.height / frameDetails.rows
  };
  const x = Math.floor((col - 1/* 1- to 0-based index */) * cellSize.width);
  const y = Math.floor((row - 1/* 1- to 0-based index */) * cellSize.height);
  const i = (y * frameDetails.decoded.width + x) * 4/* 4 channels per pixel */;
  return Array.from(frameDetails.decoded.data.slice(i, i + 4)) as [number, number, number, number];
}

const COLORS_16_TO_255 = [
  '#000000', '#00005f', '#000087', '#0000af', '#0000d7', '#0000ff', '#005f00', '#005f5f', '#005f87', '#005faf', '#005fd7', '#005fff', '#008700', '#00875f', '#008787', '#0087af',
  '#0087d7', '#0087ff', '#00af00', '#00af5f', '#00af87', '#00afaf', '#00afd7', '#00afff', '#00d700', '#00d75f', '#00d787', '#00d7af', '#00d7d7', '#00d7ff', '#00ff00', '#00ff5f',
  '#00ff87', '#00ffaf', '#00ffd7', '#00ffff', '#5f0000', '#5f005f', '#5f0087', '#5f00af', '#5f00d7', '#5f00ff', '#5f5f00', '#5f5f5f', '#5f5f87', '#5f5faf', '#5f5fd7', '#5f5fff',
  '#5f8700', '#5f875f', '#5f8787', '#5f87af', '#5f87d7', '#5f87ff', '#5faf00', '#5faf5f', '#5faf87', '#5fafaf', '#5fafd7', '#5fafff', '#5fd700', '#5fd75f', '#5fd787', '#5fd7af',
  '#5fd7d7', '#5fd7ff', '#5fff00', '#5fff5f', '#5fff87', '#5fffaf', '#5fffd7', '#5fffff', '#870000', '#87005f', '#870087', '#8700af', '#8700d7', '#8700ff', '#875f00', '#875f5f',
  '#875f87', '#875faf', '#875fd7', '#875fff', '#878700', '#87875f', '#878787', '#8787af', '#8787d7', '#8787ff', '#87af00', '#87af5f', '#87af87', '#87afaf', '#87afd7', '#87afff',
  '#87d700', '#87d75f', '#87d787', '#87d7af', '#87d7d7', '#87d7ff', '#87ff00', '#87ff5f', '#87ff87', '#87ffaf', '#87ffd7', '#87ffff', '#af0000', '#af005f', '#af0087', '#af00af',
  '#af00d7', '#af00ff', '#af5f00', '#af5f5f', '#af5f87', '#af5faf', '#af5fd7', '#af5fff', '#af8700', '#af875f', '#af8787', '#af87af', '#af87d7', '#af87ff', '#afaf00', '#afaf5f',
  '#afaf87', '#afafaf', '#afafd7', '#afafff', '#afd700', '#afd75f', '#afd787', '#afd7af', '#afd7d7', '#afd7ff', '#afff00', '#afff5f', '#afff87', '#afffaf', '#afffd7', '#afffff',
  '#d70000', '#d7005f', '#d70087', '#d700af', '#d700d7', '#d700ff', '#d75f00', '#d75f5f', '#d75f87', '#d75faf', '#d75fd7', '#d75fff', '#d78700', '#d7875f', '#d78787', '#d787af',
  '#d787d7', '#d787ff', '#d7af00', '#d7af5f', '#d7af87', '#d7afaf', '#d7afd7', '#d7afff', '#d7d700', '#d7d75f', '#d7d787', '#d7d7af', '#d7d7d7', '#d7d7ff', '#d7ff00', '#d7ff5f',
  '#d7ff87', '#d7ffaf', '#d7ffd7', '#d7ffff', '#ff0000', '#ff005f', '#ff0087', '#ff00af', '#ff00d7', '#ff00ff', '#ff5f00', '#ff5f5f', '#ff5f87', '#ff5faf', '#ff5fd7', '#ff5fff',
  '#ff8700', '#ff875f', '#ff8787', '#ff87af', '#ff87d7', '#ff87ff', '#ffaf00', '#ffaf5f', '#ffaf87', '#ffafaf', '#ffafd7', '#ffafff', '#ffd700', '#ffd75f', '#ffd787', '#ffd7af',
  '#ffd7d7', '#ffd7ff', '#ffff00', '#ffff5f', '#ffff87', '#ffffaf', '#ffffd7', '#ffffff', '#080808', '#121212', '#1c1c1c', '#262626', '#303030', '#3a3a3a', '#444444', '#4e4e4e',
  '#585858', '#626262', '#6c6c6c', '#767676', '#808080', '#8a8a8a', '#949494', '#9e9e9e', '#a8a8a8', '#b2b2b2', '#bcbcbc', '#c6c6c6', '#d0d0d0', '#dadada', '#e4e4e4', '#eeeeee'
];
