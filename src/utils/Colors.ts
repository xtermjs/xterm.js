/**
 * Colors 0-15
 */
export const tangoColors = [
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

// Colors 0-15 + 16-255
// Much thanks to TooTallNate for writing this.
export const colors: string[] = (function () {
  const colors = tangoColors.slice();
  let r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];

  // 16-231
  for (let i = 0; i < 216; i++) {
    out(r[(i / 36) % 6 | 0], r[(i / 6) % 6 | 0], r[i % 6]);
  }

  // 232-255 (grey)
  for (let i = 0; i < 24; i++) {
    let r = 8 + i * 10;
    out(r, r, r);
  }

  function out(r, g, b) {
    colors.push('#' + hex(r) + hex(g) + hex(b));
  }

  function hex(c) {
    c = c.toString(16);
    return c.length < 2 ? '0' + c : c;
  }

  return colors;
})();

export const vcolors: string[] = (function () {
  const out = [];
  for (let i = 0; i < 256; i++) {
    const color = parseInt(colors[i].substring(1), 16);
    out.push([
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff
    ]);
  }
  return out;
})();
