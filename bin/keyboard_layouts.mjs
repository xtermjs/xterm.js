import fs from 'node:fs';
import path from 'node:path';

const DATA = {};

for (let i = 2; i < process.argv.length; ++i) {
  const filename = process.argv[i];
  const key = path.basename(filename).split('.')[0];
  const value = JSON.parse(fs.readFileSync(filename));
  DATA[key] = value;
}

let keys = [];
for (const map in DATA) {
  keys = keys.concat(Object.keys(DATA[map]));
}
const KEYS = Array.from(new Set(keys)).sort();
const ACC = Object.fromEntries(Object.keys(DATA).map((el, i) => [el, i]));
const MAP = Object.fromEntries(KEYS.map(el => [el, []]));
for (const key of KEYS) {
  for (const map in ACC) {
    MAP[key].push(DATA[map][key]);
  }
}

// minify if all entries are of length 1
for (const key in MAP) {
  for (const c of MAP[key]) {
    if (!c || c.length !== 1)
      break;
  }
  MAP[key] = MAP[key].join('');
}

const FINAL = {acc: ACC, map: MAP};

console.log(FINAL);
console.log(JSON.stringify(FINAL).length);
