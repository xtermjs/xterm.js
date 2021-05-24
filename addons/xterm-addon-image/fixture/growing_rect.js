const sixelEncode = require('../node_modules/sixel/lib/SixelEncoder').image2sixel;
const toRGBA8888 = require('../node_modules/sixel/lib/Colors').toRGBA8888;

function createRect(size, color) {
  const pixels = new Uint32Array(size * size);
  pixels.fill(toRGBA8888(...color));
  return sixelEncode(new Uint8ClampedArray(pixels.buffer), size, size);
}

async function main() {
  // clear + cursor and sixelScrolling off
  process.stdout.write('\x1b[2J\x1b[?25;80l');

  for (let i = 1; i < 300; ++i) {
    await new Promise(res => setTimeout(() => {
      process.stdout.write('\x1b[2J' + createRect(i, [0, 255, 0]));
      res();
    }, 10));
  }
  for (let i = 299; i >= 1; --i) {
    await new Promise(res => setTimeout(() => {
      process.stdout.write('\x1b[2J' + createRect(i, [0, 255, 0]));
      res();
    }, 10));
  }

  // re-enable cursor and sixel scrolling
  process.stdout.write('\x1b[?25;80h');
}

main();
