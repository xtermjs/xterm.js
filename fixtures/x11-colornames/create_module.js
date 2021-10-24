const fs = require('fs');
const path = require('path');

/**
 * For decoder side:
 * - reconstruct grays with f = lambda x: (x * 256 - x + 50) / 100 (needs value rounding check)
 * - apply nameFilter
 * - build lookup & extract functions (runtime decoding?)
 * - transfer hashtable and color table
 */

// match color entry in rgb.txt
const rexFile = /^\s*(\d+)\s*(\d+)\s*(\d+)\s*?[\t]+(.*)$/;
// match greyXX|grayXX names
const rexGrey = /^gr[ae]y\d+/;
// name match
const rexName = /^\w?[A-Za-z0-9 ]+\w/;

function parseX11Colors(filename) {
  const fileData = fs.readFileSync(filename, {encoding: 'utf8'});
  const colors = [];
  for (const line of fileData.split('\n')) {
    const m = rexFile.exec(line);
    if (m) {
      colors.push({
        color: [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])],
        name: m[4]
      });
    }
  }
  return colors;
}

// Use the FNV algorithm from http://isthe.com/chongo/tech/comp/fnv/ 
function hash(d, name) {
  if (!d) d = 0x01000193;
  for (const c of name) {
    d = ( (d * 0x01000193) ^ c.charCodeAt(0) ) & 0xffffffff;
  }
  return d >>> 0;
}

// inspired from http://stevehanov.ca/blog/?id=119
function createMinimalPerfectHash(nameList) {
  const nameMap = Object.create(null);
  for (const [idx, name] of nameList.entries()) {
    nameMap[name] = idx;
  }
  const size = nameList.length;

  const buckets = [];
  for (let i = 0; i < size; ++i) buckets.push([]);
  const g = new Array(size).fill(0);
  const v = new Array(size).fill(null);

  for (const key of nameList) {
    buckets[hash(0, key) % size].push(key);
  }

  buckets.sort((a, b) => b.length - a.length);
  let breakIdx = 0;
  for (let i = 0; i < size; ++i) {
    const bucket = buckets[i];
    if (bucket.length <= 1) {
      breakIdx = i;
      break;
    }
    let d = 1;
    let item = 0;
    let slots = [];

    while (item < bucket.length) {
      const slot = hash(d, bucket[item]) % size;
      if (v[slot] !== null || slots.includes(slot)) {
        d++;
        item = 0;
        slots = [];
      } else {
        slots.push(slot);
        item++;
      }
    }

    g[hash(0, bucket[0]) % size] = d;
    for (let k = 0; k < bucket.length; ++k) {
      v[slots[k]] = nameMap[bucket[k]];
    }
  }

  const freeList = [];
  for (let i = 0; i < size; ++i) {
    if (v[i] === null) freeList.push(i);
  }

  for (let i = breakIdx; i < size; ++i) {
    const bucket = buckets[i];
    if (!bucket.length) break;
    const slot = freeList.pop();
    g[hash(0, bucket[0]) % size] = -slot - 1;
    v[slot] = nameMap[bucket[0]];
  }

  return [g, v];
}

function lookupPerfectHash(g, v, key) {
  const d = g[hash(0, key) % g.length];
  if (d < 0) return v[-d - 1];
  return v[hash(d, key) % v.length];
}

function checkPerfectHashTables(g, v, nameList) {
  let allPassed = true;
  for (const [idx, name] of nameList.entries()) {
    const lookup = lookupPerfectHash(g, v, name);
    if (lookup !== idx) {
      console.log(`\x1b[33mmismatch: '${name}' returns ${lookup} (orig: ${idx})\x1b[m`);
      allPassed = false;
    }
  }
  return allPassed;
}

function crc10atm(name, crc) {
  if (!crc) crc = 0;
  for (const c of name) {
    const v = c.charCodeAt(0);
    crc ^= v << 2;
    for (let k = 0; k < 8; k++) {
      crc = crc & 0x200 ? (crc << 1) ^ 0x233 : crc << 1;
    }
  }
  crc &= 0x3ff;
  return crc >>> 0;
}

function checkColorList(g, v, crc, colorNames) {
  let match = [];
  for (const word of colorNames) {
    if (!nameFilter(word)) continue;
    const idx = lookupPerfectHash(g, v, word);
    const crc10 = crc10atm(word);
    if (crc[idx] === crc10) {
      match.push({idx, word, colorName: colorNames[idx]});
    }
  }
  return {tested: colorNames.length, match};
}

function checkWordlists(g, v, crc, colorNames, filename) {
  const fileData = fs.readFileSync(filename, {encoding: 'utf8'});
  const words = fileData.split('\n').filter(el => lookupPerfectHash.length !== 0);
  let collisions = [];
  for (const word of words) {
    if (!nameFilter(word)) continue;
    const idx = lookupPerfectHash(g, v, word);
    const crc10 = crc10atm(word);
    if (crc[idx] === crc10 && word !== colorNames[idx]) {
      collisions.push({idx, word, colorName: colorNames[idx]});
    }
  }
  return {tested: words.length, collisions};
}

function nameFilter(name) {
  // length 3 - 22
  if (name.length < 3 || name.length > 22) return;
  // chars only in [A-Za-z0-9 ]
  if (!rexName.exec(name)) return;
  return name;
}

function compressTables(g, v, crc, al) {
  // g | v | crc: all in 10 bit (<1024)
  // --> 30 bit
  // --> fits into 5 bytes of a 64-bit char alphabet

  // g needs an offset for proper zero alignment
  const gOffset = -Math.min(...g);
  g = g.map(el => el + gOffset);

  // assert we are in 0..2^10
  if (Math.min(...g) < 0 || Math.min(...v) < 0 || Math.min(...crc) < 0
    || Math.max(...g) > 1023 || Math.max(...v) > 1023 || Math.max(...crc) > 1023
  ) {
    console.log('\x1b[31mTables out of compressible range, manual fix needed.\x1b[m');
    process.exit(1);
  }

  // assert we have same length
  if (g.length !== v.length || g.length !== crc.length) {
    console.log('\x1b[31mTables length mismatch, manual fix needed.\x1b[m');
    process.exit(1);
  }

  // construct compressed data string
  let result = '';
  const length = g.length;
  for (let i = 0; i < length; ++i) {
    let value = (g[i] << 20) | (v[i] << 10) | crc[i];
    let bucket = '';
    for (let k = 0; k < 5; ++k) {
      bucket += al[value % al.length];
      value = Math.floor(value / al.length);
    }
    result += bucket.split('').reverse().join('');
  }

  return [result, length, gOffset];
}

function compressColors(colors, al) {
  let result = '';
  for (const color of colors) {
    let value = (color[0] << 16) | (color[1] << 8) | color[2];
    let bucket = '';
    for (let k = 0; k < 4; ++k) {
      bucket += al[value % al.length];
      value = Math.floor(value / al.length);
    }
    result += bucket.split('').reverse().join('');
  }
  return result;
}

function loadData(bucket, al) {
  let value = 0;
  for (const c of bucket) {
    value *= al.length;
    value += al.indexOf(c);
  }
  return [value >>> 20, (value >> 10) & 0x3FF, value & 0x3FF];
}

function loadColor(al, data, idx) {
  // color buckets are hardcoded to 4 chars
  let value = 0;
  for (let i = idx * 4; i < idx * 4 + 4; ++i) {
    value *= al.length;
    value += al.indexOf(data[i]);
  }
  return [value >>> 16, (value >> 8) & 0xFF, value & 0xFF];
}

function lookupIdx(al, data, length, gOffset, name) {
  const bl = data.length / length;
  let offset = (hash(0, name) % length) * bl;
  let [g, v, crc] = loadData(data.slice(offset, offset + bl), al);
  offset = g < gOffset
    ? (-(g - gOffset) - 1) * bl
    : (hash(g - gOffset, name) % length) * bl;
  [_, v, _] = loadData(data.slice(offset, offset + bl), al);
  offset = v * bl;
  [_, _, crc] = loadData(data.slice(offset, offset + bl), al);
  return crc10atm(name) === crc ? v : -1;
}

function lookup(al, data, colorData, length, gOffset, name) {
  const idx = lookupIdx(al, data, length, gOffset, name);
  if (idx === -1) return;
  return loadColor(al, colorData, idx);
}

function createModule(tableData, colorData, alphabet, gOffset, length) {
  const TMPL = `/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * This module enables X11 color name lookups with the help of a perfect hash function
 * to not penalize the package size too much.
 * saving: ~70% (from 17kB down to 5kB)
 */

// Note: module and table data created with fixtures/x11-colornames/create_module.js
const TABLE = '${tableData}';
const COLORS = '${colorData}';
const ALPHABET = '${alphabet}';
const OFFSET = ${gOffset};
const LENGTH = ${length};
const BUCKET_LENGTH = TABLE.length / LENGTH;

// match greyXX|grayXX names
const rexGrey = /^gr[ae]y(\\d+)/;
// name match
const rexName = /^\\w?[A-Za-z0-9 ]+\\w/;

function gray(n: number): [number, number, number] | undefined {
  if (0 <= n && n <= 100) {
    const v = Math.floor((n * 256 - n + 50) / 100);
    return [v, v, v];
  }
  return;
}

function hash(d: number, name: string): number {
  if (!d) d = 0x01000193;
  for (const c of name) {
    d = ((d * 0x01000193) ^ c.charCodeAt(0)) & 0xffffffff;
  }
  return d >>> 0;
}

function crc10(name: string, crc?: number): number {
  if (!crc) crc = 0;
  for (const c of name) {
    crc ^= c.charCodeAt(0) << 2;
    for (let k = 0; k < 8; k++) {
      crc = crc & 0x200 ? (crc << 1) ^ 0x233 : crc << 1;
    }
  }
  crc &= 0x3ff;
  return crc >>> 0;
}

function loadData(idx: number): [number, number, number] {
  let value = 0;
  for (let i = idx * BUCKET_LENGTH; i < idx * BUCKET_LENGTH + BUCKET_LENGTH; ++i) {
    value *= ALPHABET.length;
    value += ALPHABET.indexOf(TABLE[i]);
  }
  return [value >>> 20, (value >> 10) & 0x3FF, value & 0x3FF];
}

function loadColor(idx: number): [number, number, number] {
  // color buckets are hardcoded to 4 chars
  let v = 0;
  for (let i = idx * 4; i < idx * 4 + 4; ++i) {
    v *= ALPHABET.length;
    v += ALPHABET.indexOf(COLORS[i]);
  }
  return [v >>> 16, (v >> 8) & 0xFF, v & 0xFF];
}

function lookupIdx(name: string): number {
  let b = loadData(hash(0, name) % LENGTH);
  b = loadData(b[0] < OFFSET ? (-(b[0] - OFFSET) - 1) : hash(b[0] - OFFSET, name) % LENGTH);
  const [ , , crc] = loadData(b[1]);
  return crc10(name) === crc ? b[1] : -1;
}

export function getColorFromName(name: string): [number, number, number] | undefined {
  // basic name filtering
  if (name.length < 3 || name.length > 22 || !rexName.exec(name)) return;

  // handle grays special
  const m = rexGrey.exec(name);
  if (m) return gray(parseInt(m[1]));

  // grab crc checked idx from PHF
  const idx = lookupIdx(name);
  if (idx === -1) return;
  return loadColor(idx);
}
`;
  return TMPL;
}


function main() {
  // parse definitions from X11 file
  const colorList = parseX11Colors(path.join(__dirname, '/rgb.txt'))
    .filter(el => !rexGrey.exec(el.name));  // remove greys, as we can reconstruct them later
  const nameList = colorList.map(el => el.name);

  // PHF creation and test
  const [g, v] = createMinimalPerfectHash(nameList);
  if (!checkPerfectHashTables(g, v, nameList)) {
    console.error('\x1b[31mPHF creation failed.\x1b[m');
    process.exit(1);
  } else {
    console.log('\x1b[32mPHF creation successful.\x1b[m');
  }

  // calc 10-bit CRCs to rule to avoid collisions at ~1:1024
  const crc = nameList.map(el => crc10atm(el));

  // collision check against colorNames - must all collide
  console.log('Self collision test:')
  const collSelf = checkColorList(g, v, crc, nameList);
  console.log('self:', {
    entries: collSelf.tested,
    matches: collSelf.match.length,
    rate: collSelf.tested / collSelf.match.length
  });
  if (collSelf.match.length !== collSelf.tested) {
    console.error('\x1b[31mSelf collision tested failed.\x1b[m');
    process.exit(1);
  }

  // basic collision checks against dictionaries (rates should be greater than 900:1)
  console.log('Dictionary collision test:')
  const collEnglish = checkWordlists(g, v, crc, nameList, '/usr/share/dict/words');
  console.log('english:', {
    entries: collEnglish.tested,
    collisions: collEnglish.collisions.length,
    rate: collEnglish.tested / collEnglish.collisions.length
  });
  //console.log(collEnglish.collisions);
  const collnGerman = checkWordlists(g, v, crc, nameList, '/usr/share/dict/ngerman');
  console.log('ngerman:', {
    entries: collnGerman.tested,
    collisions: collnGerman.collisions.length,
    rate: collnGerman.tested / collnGerman.collisions.length
  });
  const colloGerman = checkWordlists(g, v, crc, nameList, '/usr/share/dict/ogerman');
  console.log('ogerman:', {
    entries: colloGerman.tested,
    collisions: colloGerman.collisions.length,
    rate: colloGerman.tested / colloGerman.collisions.length
  });

  // compression with custom alphabet
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?';
  const [tableData, length, gOffset] = compressTables(g, v, crc, ALPHABET);
  const colorData = compressColors(colorList.map(el => el.color), ALPHABET);

  // test loading of compressed table data
  let failed = false;
  for (const name of nameList) {
    const orig = lookupPerfectHash(g, v, name);
    const idx = lookupIdx(ALPHABET, tableData, length, gOffset, name);
    if (idx !== orig) {
      console.log('\x1b[31mcompressed loading failed for:\x1b[m', {name, idx, orig});
      failed = true;
    }
  }
  if (failed) process.exit(1);

  // test full color decoding
  for (const color of colorList) {
    const loaded = lookup(ALPHABET, tableData, colorData, length, gOffset, color.name);
    if (loaded[0] !== color.color[0] || loaded[1] !== color.color[1] || loaded[2] !== color.color[2]) {
      console.log('\x1b[31mcolor loading failed for:\x1b[m', {color, loaded});
      failed = true;
    }
  }
  if (failed) process.exit(1);

  // if we made it up to here, create decoding boilerplate
  const moduleData = createModule(tableData, colorData, ALPHABET, gOffset, length);
  fs.writeFileSync(path.join(__dirname, '/ColorNames.ts'), moduleData);
  console.log(`${moduleData.length} bytes written to ${path.join(__dirname, '/ColorNames.ts')}`);
}

main();
