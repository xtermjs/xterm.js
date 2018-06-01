#!/usr/bin/env node
'use strict';

const URL = 'https://www.unicode.org/Public/10.0.0/ucd/auxiliary/GraphemeBreakProperty.txt';
const PATH = __dirname + '/../src/GraphemeData.ts';

const GRAPHEME_REX = /^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*([A-Za-z_]+)/gm;

const TYPES  = {
    Other: 0,
    L: 1,
    V: 2,
    T: 3,
    LV: 4,
    LVT: 5,
    CR: 6,
    LF: 7,
    ZWJ: 8,
    Prepend: 9,
    Control: 10,
    Extend: 11,
    SpacingMark: 12,
    E_Base: 13,
    Glue_After_Zwj: 14,
    E_Modifier: 15,
    E_Base_GAZ: 16,
    Regional_Indicator: 17
};

function parseDefinitions(data) {
    let codepoints = Object.create(null);
    let match = null;
    while (match = GRAPHEME_REX.exec(data)) {
        let start = parseInt(match[1], 16);
        let end = parseInt(match[2], 16) || start;
        for (let i = start; i < end + 1; ++i)
            codepoints[i] = match[3];
    }
    return codepoints;
}


function createPackedBMP(codepoints, start, end) {
    let type = -1;
    let count = 0;
    let lengths = [];
    let types = [];
    for (let i = start; i < end; ++i) {
        let t = parseInt(TYPES[codepoints[i] || 'Other']);
        if (t !== type) {
            lengths.push(count);
            types.push(type);
            type = t;
            count = 0;
        }
        count++;
        if (count === 255) {
            lengths.push(count);
            types.push(type);
            count = 0;
        }
    }
    lengths.push(count);
    types.push(type);

    // remove start entries
    lengths.shift();
    types.shift();

    if (types.length & 1)
        types.push(0);

    let accu = 0;
    let finalTypes = [];
    for (let i = 0; i < types.length; ++i) {
        accu <<= 4;
        accu |= types[i];
        if (i & 1) {
            finalTypes.push(accu);
            accu = 0;
        }
    }

    // null terminate length values
    lengths.push(0);
    return new Buffer(lengths.concat(finalTypes)).toString('base64');
}


function createGraphemeDataFile(url, path) {
    require('https').get(url, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
            data += chunk;
        });
        resp.on('end', () => {
            const codepoints = parseDefinitions(data);
            let highest = 0;
            for (let el in codepoints)
                highest = Math.max(highest, parseInt(el));

            // codepoint < 12443
            const first = createPackedBMP(codepoints, 0, 12443);
            // 42606 <= codepoint < 65536
            const second = createPackedBMP(codepoints, 42606, 65536);
            // codepoint <= 65536
            const third = ''; //createPackedHIGH(codepoints, 65536, highest);

            // write to ts file
            let final = '';
            final += `// FIRST: 0 <= codepoint < 12443\n`;
            final += `export const FIRST: string = '${first}';\n`;
            final += `// SECOND: 42606 <= codepoint < 65536\n`;
            final += `export const SECOND: string = '${second}';\n`;
            final += `// THIRD: codepoint >= 65536\n`;
            final += `export const THIRD: string = '${third}';\n`;
            require('fs').writeFileSync(path, final);
        });
    }).on('error', (err) => {
        console.log('error', err.message);
    });
}

createGraphemeDataFile(URL, PATH);
