// TODO: Ideally colors would be exposed through some theme manager since colors
// are moving to JS.

export const TANGO_COLORS = [
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

export const COLORS: string[] = (function(): string[] {
  let colors = TANGO_COLORS.slice();
  let r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
  let i;

  // 16-231
  i = 0;
  for (; i < 216; i++) {
    out(r[(i / 36) % 6 | 0], r[(i / 6) % 6 | 0], r[i % 6]);
  }

  // 232-255 (grey)
  i = 0;
  let c: number;
  for (; i < 24; i++) {
    c = 8 + i * 10;
    out(c, c, c);
  }

  function out(r: number, g: number, b: number): void {
    colors.push('#' + hex(r) + hex(g) + hex(b));
  }

  function hex(c: number): string {
    let s = c.toString(16);
    return s.length < 2 ? '0' + s : s;
  }

  return colors;
})();
