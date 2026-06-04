const TEXT = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

// generates 128 * 128 * 128 * 94 = ~197M glyphs
async function stress() {
  for (let r = 0; r < 256; r += 2) {
    for (let g = 0; g < 256; g += 2) {
      for (let b = 0; b < 256; b += 2) {
        console.log('\x1b[H\x1b[2J\x1b[mThis should be readable with white FG color.');
        console.log(`r: ${r} g:${g} b:${b}`);
        console.log(`\x1b[38;2;${r};${g};${b}m${TEXT}`);
        await new Promise(r => setTimeout(r, 0));
      }
    }
  }
}

stress();
