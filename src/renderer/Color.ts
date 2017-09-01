// TODO: Ideally colors would be exposed through some theme manager since colors
// are moving to JS.

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

const TANGO_COLORS = [
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

export const COLORS: string[] = generate256Colors(TANGO_COLORS);

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
