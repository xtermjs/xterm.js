import { IColorSet } from './Interfaces';
import { ITheme } from '../Interfaces';

export enum COLOR_CODES {
  BLACK = 0,
  RED = 1,
  GREEN = 2,
  YELLOW = 3,
  BLUE = 4,
  MAGENTA = 5,
  CYAN = 6,
  WHITE = 7,
  BRIGHT_BLACK = 8,
  BRIGHT_RED = 9,
  BRIGHT_GREEN = 10,
  BRIGHT_YELLOW = 11,
  BRIGHT_BLUE = 12,
  BRIGHT_MAGENTA = 13,
  BRIGHT_CYAN = 14,
  BRIGHT_WHITE = 15
}

const DEFAULT_FOREGROUND = '#ffffff';
const DEFAULT_BACKGROUND = '#000000';
const DEFAULT_CURSOR = '#ffffff';
export const DEFAULT_ANSI_COLORS = [
  // dark:
  '#2e3436',
  '#cc0000',
  '#4e9a06',
  '#c4a000',
  '#3465a4',
  '#75507b',
  '#06989a',
  '#d3d7cf',
  // bright:
  '#555753',
  '#ef2929',
  '#8ae234',
  '#fce94f',
  '#729fcf',
  '#ad7fa8',
  '#34e2e2',
  '#eeeeec'
];

function generate256Colors(first16Colors: string[]): string[] {
  let colors = first16Colors.slice();

  // Generate colors (16-231)
  let v = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
  for (let i = 0; i < 216; i++) {
    const r = toPaddedHex(v[(i / 36) % 6 | 0]);
    const g = toPaddedHex(v[(i / 6) % 6 | 0]);
    const b = toPaddedHex(v[i % 6]);
    colors.push(`#${r}${g}${b}`);
  }

  // Generate greys (232-255)
  for (let i = 0; i < 24; i++) {
    const c = toPaddedHex(8 + i * 10);
    colors.push(`#${c}${c}${c}`);
  }

  return colors;
}

function toPaddedHex(c: number): string {
  let s = c.toString(16);
  return s.length < 2 ? '0' + s : s;
}

export class ColorManager {
  public colors: IColorSet;

  constructor() {
    this.colors = {
      foreground: DEFAULT_FOREGROUND,
      background: DEFAULT_BACKGROUND,
      cursor: DEFAULT_CURSOR,
      ansi: generate256Colors(DEFAULT_ANSI_COLORS)
    };
  }

  /**
   * Sets the terminal's theme.
   * @param theme The  theme to use. If a partial theme is provided then default
   * colors will be used where colors are not defined.
   */
  public setTheme(theme: ITheme): void {
    this.colors.foreground = theme.foreground || DEFAULT_FOREGROUND;
    this.colors.background = theme.background || DEFAULT_BACKGROUND;
    this.colors.cursor = theme.cursor || DEFAULT_CURSOR;
    this.colors.ansi[0] = theme.black || DEFAULT_ANSI_COLORS[0];
    this.colors.ansi[1] = theme.red || DEFAULT_ANSI_COLORS[1];
    this.colors.ansi[2] = theme.green || DEFAULT_ANSI_COLORS[2];
    this.colors.ansi[3] = theme.yellow || DEFAULT_ANSI_COLORS[3];
    this.colors.ansi[4] = theme.blue || DEFAULT_ANSI_COLORS[4];
    this.colors.ansi[5] = theme.magenta || DEFAULT_ANSI_COLORS[5];
    this.colors.ansi[6] = theme.cyan || DEFAULT_ANSI_COLORS[6];
    this.colors.ansi[7] = theme.white || DEFAULT_ANSI_COLORS[7];
    this.colors.ansi[8] = theme.brightBlack || DEFAULT_ANSI_COLORS[8];
    this.colors.ansi[9] = theme.brightRed || DEFAULT_ANSI_COLORS[9];
    this.colors.ansi[10] = theme.brightGreen || DEFAULT_ANSI_COLORS[10];
    this.colors.ansi[11] = theme.brightYellow || DEFAULT_ANSI_COLORS[11];
    this.colors.ansi[12] = theme.brightBlue || DEFAULT_ANSI_COLORS[12];
    this.colors.ansi[13] = theme.brightMagenta || DEFAULT_ANSI_COLORS[13];
    this.colors.ansi[14] = theme.brightCyan || DEFAULT_ANSI_COLORS[14];
    this.colors.ansi[15] = theme.brightWhite || DEFAULT_ANSI_COLORS[15];
  }
}
