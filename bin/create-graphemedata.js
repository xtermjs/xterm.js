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
        if (count === 255) {
            lengths.push(count);
            types.push(type);
            count = 0;
        }
        count++;
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

function createPackedHIGH(codepoints, plane, start, end) {
    start = start + 65536 * plane;
    end = end + 65536 * plane;
    let length = 0;
    let type = -1;
    const segments = [];
    let segmentStart = -1;
    for (let i = start; i < end; ++i) {
        let t = parseInt(TYPES[codepoints[i] || 'Other']);
        if (t !== type) {
            // end of segment reached
            // only push non Other segments
            if (type) segments.push([segmentStart, length, type]);
            segmentStart = i;
            length = 0;
            type = t;
        }
        if (length === 255) {
            if (type) {
                segments.push([segmentStart, length, type]);
                segmentStart = i;
                length = 0;
            }
        }
        length++;
    }
    if (type) segments.push([segmentStart, length, type]);
    segments.shift();
    console.log(segments);
    
    // write to byte typed
    let final = [];
    for (let i = 0; i < segments.length; ++i) {
        final.push(segments[i][0] >> 8);
        final.push(segments[i][0] & 255);
        final.push(segments[i][1]);
        final.push(segments[i][2]);
    }
    return new Buffer(final).toString('base64');
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
            // Supplementary Multilingual Plane (1): 0 <= codepoint < 63966
            const third = createPackedHIGH(codepoints, 1, 0, 63966);
            // Supplement­ary Special-purpose Plane (14): 0 <= codepoint < highest + 1
            const fourth = createPackedHIGH(codepoints, 14, 0, highest + 1);

            // write to ts file
            let final = '';
            final += `// FIRST: 0 <= codepoint < 12443\n`;
            final += `export const FIRST: string = '${first}';\n`;
            final += `// SECOND: 42606 <= codepoint < 65536\n`;
            final += `export const SECOND: string = '${second}';\n`;
            final += `// THIRD: Supplementary Multilingual Plane (1) 0 <= codepoint < 63966\n`;
            final += `export const THIRD: string = '${third}';\n`;
            final += `// FOURTH: Supplement­ary Special-purpose Plane (14) 0 <= codepoint <= highest\n`;
            final += `export const FOURTH: string = '${fourth}';\n`;
            require('fs').writeFileSync(path, final);
        });
    }).on('error', (err) => {
        console.log('error', err.message);
    });
}

createGraphemeDataFile(URL, PATH);
