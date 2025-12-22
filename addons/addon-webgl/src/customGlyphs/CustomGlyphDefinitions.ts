/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/* eslint-disable @typescript-eslint/naming-convention */

import { CustomGlyphVectorType, type CustomGlyphDrawFunctionDefinition, type ICustomGlyphSolidOctantBlockVector, type ICustomGlyphVectorShape, type CustomGlyphPatternDefinition } from 'customGlyphs/CustomGlyphRasterizer';

export const blockElementDefinitions: { [index: string]: ICustomGlyphSolidOctantBlockVector[] | undefined } = {
  // Block elements (0x2580-0x2590)
  '▀': [{ x: 0, y: 0, w: 8, h: 4 }], // UPPER HALF BLOCK
  '▁': [{ x: 0, y: 7, w: 8, h: 1 }], // LOWER ONE EIGHTH BLOCK
  '▂': [{ x: 0, y: 6, w: 8, h: 2 }], // LOWER ONE QUARTER BLOCK
  '▃': [{ x: 0, y: 5, w: 8, h: 3 }], // LOWER THREE EIGHTHS BLOCK
  '▄': [{ x: 0, y: 4, w: 8, h: 4 }], // LOWER HALF BLOCK
  '▅': [{ x: 0, y: 3, w: 8, h: 5 }], // LOWER FIVE EIGHTHS BLOCK
  '▆': [{ x: 0, y: 2, w: 8, h: 6 }], // LOWER THREE QUARTERS BLOCK
  '▇': [{ x: 0, y: 1, w: 8, h: 7 }], // LOWER SEVEN EIGHTHS BLOCK
  '█': [{ x: 0, y: 0, w: 8, h: 8 }], // FULL BLOCK
  '▉': [{ x: 0, y: 0, w: 7, h: 8 }], // LEFT SEVEN EIGHTHS BLOCK
  '▊': [{ x: 0, y: 0, w: 6, h: 8 }], // LEFT THREE QUARTERS BLOCK
  '▋': [{ x: 0, y: 0, w: 5, h: 8 }], // LEFT FIVE EIGHTHS BLOCK
  '▌': [{ x: 0, y: 0, w: 4, h: 8 }], // LEFT HALF BLOCK
  '▍': [{ x: 0, y: 0, w: 3, h: 8 }], // LEFT THREE EIGHTHS BLOCK
  '▎': [{ x: 0, y: 0, w: 2, h: 8 }], // LEFT ONE QUARTER BLOCK
  '▏': [{ x: 0, y: 0, w: 1, h: 8 }], // LEFT ONE EIGHTH BLOCK
  '▐': [{ x: 4, y: 0, w: 4, h: 8 }], // RIGHT HALF BLOCK

  // Block elements (0x2594-0x2595)
  '▔': [{ x: 0, y: 0, w: 8, h: 1 }], // UPPER ONE EIGHTH BLOCK
  '▕': [{ x: 7, y: 0, w: 1, h: 8 }], // RIGHT ONE EIGHTH BLOCK

  // Terminal graphic characters (0x2596-0x259F)
  '▖': [{ x: 0, y: 4, w: 4, h: 4 }],                             // QUADRANT LOWER LEFT
  '▗': [{ x: 4, y: 4, w: 4, h: 4 }],                             // QUADRANT LOWER RIGHT
  '▘': [{ x: 0, y: 0, w: 4, h: 4 }],                             // QUADRANT UPPER LEFT
  '▙': [{ x: 0, y: 0, w: 4, h: 8 }, { x: 0, y: 4, w: 8, h: 4 }], // QUADRANT UPPER LEFT AND LOWER LEFT AND LOWER RIGHT
  '▚': [{ x: 0, y: 0, w: 4, h: 4 }, { x: 4, y: 4, w: 4, h: 4 }], // QUADRANT UPPER LEFT AND LOWER RIGHT
  '▛': [{ x: 0, y: 0, w: 4, h: 8 }, { x: 4, y: 0, w: 4, h: 4 }], // QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER LEFT
  '▜': [{ x: 0, y: 0, w: 8, h: 4 }, { x: 4, y: 0, w: 4, h: 8 }], // QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER RIGHT
  '▝': [{ x: 4, y: 0, w: 4, h: 4 }],                             // QUADRANT UPPER RIGHT
  '▞': [{ x: 4, y: 0, w: 4, h: 4 }, { x: 0, y: 4, w: 4, h: 4 }], // QUADRANT UPPER RIGHT AND LOWER LEFT
  '▟': [{ x: 4, y: 0, w: 4, h: 8 }, { x: 0, y: 4, w: 8, h: 4 }], // QUADRANT UPPER RIGHT AND LOWER LEFT AND LOWER RIGHT

  // VERTICAL ONE EIGHTH BLOCK-2 through VERTICAL ONE EIGHTH BLOCK-7
  '\u{1FB70}': [{ x: 1, y: 0, w: 1, h: 8 }],
  '\u{1FB71}': [{ x: 2, y: 0, w: 1, h: 8 }],
  '\u{1FB72}': [{ x: 3, y: 0, w: 1, h: 8 }],
  '\u{1FB73}': [{ x: 4, y: 0, w: 1, h: 8 }],
  '\u{1FB74}': [{ x: 5, y: 0, w: 1, h: 8 }],
  '\u{1FB75}': [{ x: 6, y: 0, w: 1, h: 8 }],

  // HORIZONTAL ONE EIGHTH BLOCK-2 through HORIZONTAL ONE EIGHTH BLOCK-7
  '\u{1FB76}': [{ x: 0, y: 1, w: 8, h: 1 }],
  '\u{1FB77}': [{ x: 0, y: 2, w: 8, h: 1 }],
  '\u{1FB78}': [{ x: 0, y: 3, w: 8, h: 1 }],
  '\u{1FB79}': [{ x: 0, y: 4, w: 8, h: 1 }],
  '\u{1FB7A}': [{ x: 0, y: 5, w: 8, h: 1 }],
  '\u{1FB7B}': [{ x: 0, y: 6, w: 8, h: 1 }],

  // LEFT AND LOWER ONE EIGHTH BLOCK
  '\u{1FB7C}': [{ x: 0, y: 0, w: 1, h: 8 }, { x: 0, y: 7, w: 8, h: 1 }],
  // LEFT AND UPPER ONE EIGHTH BLOCK
  '\u{1FB7D}': [{ x: 0, y: 0, w: 1, h: 8 }, { x: 0, y: 0, w: 8, h: 1 }],
  // RIGHT AND UPPER ONE EIGHTH BLOCK
  '\u{1FB7E}': [{ x: 7, y: 0, w: 1, h: 8 }, { x: 0, y: 0, w: 8, h: 1 }],
  // RIGHT AND LOWER ONE EIGHTH BLOCK
  '\u{1FB7F}': [{ x: 7, y: 0, w: 1, h: 8 }, { x: 0, y: 7, w: 8, h: 1 }],
  // UPPER AND LOWER ONE EIGHTH BLOCK
  '\u{1FB80}': [{ x: 0, y: 0, w: 8, h: 1 }, { x: 0, y: 7, w: 8, h: 1 }],
  // HORIZONTAL ONE EIGHTH BLOCK-1358
  '\u{1FB81}': [{ x: 0, y: 0, w: 8, h: 1 }, { x: 0, y: 2, w: 8, h: 1 }, { x: 0, y: 4, w: 8, h: 1 }, { x: 0, y: 7, w: 8, h: 1 }],

  // UPPER ONE QUARTER BLOCK
  '\u{1FB82}': [{ x: 0, y: 0, w: 8, h: 2 }],
  // UPPER THREE EIGHTHS BLOCK
  '\u{1FB83}': [{ x: 0, y: 0, w: 8, h: 3 }],
  // UPPER FIVE EIGHTHS BLOCK
  '\u{1FB84}': [{ x: 0, y: 0, w: 8, h: 5 }],
  // UPPER THREE QUARTERS BLOCK
  '\u{1FB85}': [{ x: 0, y: 0, w: 8, h: 6 }],
  // UPPER SEVEN EIGHTHS BLOCK
  '\u{1FB86}': [{ x: 0, y: 0, w: 8, h: 7 }],

  // RIGHT ONE QUARTER BLOCK
  '\u{1FB87}': [{ x: 6, y: 0, w: 2, h: 8 }],
  // RIGHT THREE EIGHTHS B0OCK
  '\u{1FB88}': [{ x: 5, y: 0, w: 3, h: 8 }],
  // RIGHT FIVE EIGHTHS BL0CK
  '\u{1FB89}': [{ x: 3, y: 0, w: 5, h: 8 }],
  // RIGHT THREE QUARTERS 0LOCK
  '\u{1FB8A}': [{ x: 2, y: 0, w: 6, h: 8 }],
  // RIGHT SEVEN EIGHTHS B0OCK
  '\u{1FB8B}': [{ x: 1, y: 0, w: 7, h: 8 }],

  // CHECKER BOARD FILL
  '\u{1FB95}': [
    { x: 0, y: 0, w: 2, h: 2 }, { x: 4, y: 0, w: 2, h: 2 },
    { x: 2, y: 2, w: 2, h: 2 }, { x: 6, y: 2, w: 2, h: 2 },
    { x: 0, y: 4, w: 2, h: 2 }, { x: 4, y: 4, w: 2, h: 2 },
    { x: 2, y: 6, w: 2, h: 2 }, { x: 6, y: 6, w: 2, h: 2 }
  ],
  // INVERSE CHECKER BOARD FILL
  '\u{1FB96}': [
    { x: 2, y: 0, w: 2, h: 2 }, { x: 6, y: 0, w: 2, h: 2 },
    { x: 0, y: 2, w: 2, h: 2 }, { x: 4, y: 2, w: 2, h: 2 },
    { x: 2, y: 4, w: 2, h: 2 }, { x: 6, y: 4, w: 2, h: 2 },
    { x: 0, y: 6, w: 2, h: 2 }, { x: 4, y: 6, w: 2, h: 2 }
  ],
  // HEAVY HORIZONTAL FILL (upper middle and lower one quarter block)
  '\u{1FB97}': [{ x: 0, y: 2, w: 8, h: 2 }, { x: 0, y: 6, w: 8, h: 2 }]
};

/**
 * Generates a drawing function for sextant characters. Sextants are a 2x3 grid where each cell
 * can be on or off.
 * @param pattern A 6-bit pattern where bit 0 = top-left, bit 1 = top-right, bit 2 = middle-left,
 * bit 3 = middle-right, bit 4 = bottom-left, bit 5 = bottom-right
 */
function sextant(pattern: number): CustomGlyphDrawFunctionDefinition {
  return () => {
    // Sextant grid: 2 columns, 3 rows
    // Row heights in 8ths: top=3, middle=2, bottom=3
    // Column widths: left=4, right=4
    const rects: string[] = [];
    const colW = 0.5; // Each column is half width
    const rowH = [3 / 8, 2 / 8, 3 / 8]; // Row heights as fractions
    const rowY = [0, 3 / 8, 5 / 8]; // Row Y positions

    for (let row = 0; row < 3; row++) {
      const leftBit = (pattern >> (row * 2)) & 1;
      const rightBit = (pattern >> (row * 2 + 1)) & 1;

      if (leftBit && rightBit) {
        // Full row
        rects.push(`M0,${rowY[row]} L1,${rowY[row]} L1,${rowY[row] + rowH[row]} L0,${rowY[row] + rowH[row]} Z`);
      } else if (leftBit) {
        rects.push(`M0,${rowY[row]} L${colW},${rowY[row]} L${colW},${rowY[row] + rowH[row]} L0,${rowY[row] + rowH[row]} Z`);
      } else if (rightBit) {
        rects.push(`M${colW},${rowY[row]} L1,${rowY[row]} L1,${rowY[row] + rowH[row]} L${colW},${rowY[row] + rowH[row]} Z`);
      }
    }
    return rects.join(' ');
  };
}

export const symbolsForLegacyComputingDefinitions: { [index: string]: CustomGlyphDrawFunctionDefinition | undefined } = {
  // Block sextants (0x1FB00-0x1FB3B)
  // Each sextant is a 2x3 grid of cells in an 8x8 block
  // Cell positions: bit 0=top-left, bit 1=top-right, bit 2=middle-left, bit 3=middle-right,
  // bit 4=bottom-left, bit 5=bottom-right
  // Patterns 0 (empty), 21 (left half), 42 (right half), 63 (full) are excluded as they exist
  // elsewhere
  '\u{1FB00}': sextant(0b000001), // BLOCK SEXTANT-1
  '\u{1FB01}': sextant(0b000010), // BLOCK SEXTANT-2
  '\u{1FB02}': sextant(0b000011), // BLOCK SEXTANT-12 (upper one third block)
  '\u{1FB03}': sextant(0b000100), // BLOCK SEXTANT-3
  '\u{1FB04}': sextant(0b000101), // BLOCK SEXTANT-13
  '\u{1FB05}': sextant(0b000110), // BLOCK SEXTANT-23
  '\u{1FB06}': sextant(0b000111), // BLOCK SEXTANT-123
  '\u{1FB07}': sextant(0b001000), // BLOCK SEXTANT-4
  '\u{1FB08}': sextant(0b001001), // BLOCK SEXTANT-14
  '\u{1FB09}': sextant(0b001010), // BLOCK SEXTANT-24
  '\u{1FB0A}': sextant(0b001011), // BLOCK SEXTANT-124
  '\u{1FB0B}': sextant(0b001100), // BLOCK SEXTANT-34 (middle one third block)
  '\u{1FB0C}': sextant(0b001101), // BLOCK SEXTANT-134
  '\u{1FB0D}': sextant(0b001110), // BLOCK SEXTANT-234
  '\u{1FB0E}': sextant(0b001111), // BLOCK SEXTANT-1234 (upper two thirds block)
  '\u{1FB0F}': sextant(0b010000), // BLOCK SEXTANT-5
  '\u{1FB10}': sextant(0b010001), // BLOCK SEXTANT-15
  '\u{1FB11}': sextant(0b010010), // BLOCK SEXTANT-25
  '\u{1FB12}': sextant(0b010011), // BLOCK SEXTANT-125
  '\u{1FB13}': sextant(0b010100), // BLOCK SEXTANT-35
  // Pattern 21 (0x15 = 0b010101) = left half block, skipped (exists as U+258C)
  '\u{1FB14}': sextant(0b010110), // BLOCK SEXTANT-235
  '\u{1FB15}': sextant(0b010111), // BLOCK SEXTANT-1235
  '\u{1FB16}': sextant(0b011000), // BLOCK SEXTANT-45
  '\u{1FB17}': sextant(0b011001), // BLOCK SEXTANT-145
  '\u{1FB18}': sextant(0b011010), // BLOCK SEXTANT-245
  '\u{1FB19}': sextant(0b011011), // BLOCK SEXTANT-1245
  '\u{1FB1A}': sextant(0b011100), // BLOCK SEXTANT-345
  '\u{1FB1B}': sextant(0b011101), // BLOCK SEXTANT-1345
  '\u{1FB1C}': sextant(0b011110), // BLOCK SEXTANT-2345
  '\u{1FB1D}': sextant(0b011111), // BLOCK SEXTANT-12345
  '\u{1FB1E}': sextant(0b100000), // BLOCK SEXTANT-6
  '\u{1FB1F}': sextant(0b100001), // BLOCK SEXTANT-16
  '\u{1FB20}': sextant(0b100010), // BLOCK SEXTANT-26
  '\u{1FB21}': sextant(0b100011), // BLOCK SEXTANT-126
  '\u{1FB22}': sextant(0b100100), // BLOCK SEXTANT-36
  '\u{1FB23}': sextant(0b100101), // BLOCK SEXTANT-136
  '\u{1FB24}': sextant(0b100110), // BLOCK SEXTANT-236
  '\u{1FB25}': sextant(0b100111), // BLOCK SEXTANT-1236
  '\u{1FB26}': sextant(0b101000), // BLOCK SEXTANT-46
  '\u{1FB27}': sextant(0b101001), // BLOCK SEXTANT-146
  // Pattern 42 (0x2A = 0b101010) = right half block, skipped (exists as U+2590)
  '\u{1FB28}': sextant(0b101011), // BLOCK SEXTANT-1246
  '\u{1FB29}': sextant(0b101100), // BLOCK SEXTANT-346
  '\u{1FB2A}': sextant(0b101101), // BLOCK SEXTANT-1346
  '\u{1FB2B}': sextant(0b101110), // BLOCK SEXTANT-2346
  '\u{1FB2C}': sextant(0b101111), // BLOCK SEXTANT-12346
  '\u{1FB2D}': sextant(0b110000), // BLOCK SEXTANT-56 (lower one third block)
  '\u{1FB2E}': sextant(0b110001), // BLOCK SEXTANT-156
  '\u{1FB2F}': sextant(0b110010), // BLOCK SEXTANT-256
  '\u{1FB30}': sextant(0b110011), // BLOCK SEXTANT-1256 (upper and lower one
  // third block)
  '\u{1FB31}': sextant(0b110100), // BLOCK SEXTANT-356
  '\u{1FB32}': sextant(0b110101), // BLOCK SEXTANT-1356
  '\u{1FB33}': sextant(0b110110), // BLOCK SEXTANT-2356
  '\u{1FB34}': sextant(0b110111), // BLOCK SEXTANT-12356
  '\u{1FB35}': sextant(0b111000), // BLOCK SEXTANT-456
  '\u{1FB36}': sextant(0b111001), // BLOCK SEXTANT-1456
  '\u{1FB37}': sextant(0b111010), // BLOCK SEXTANT-2456
  '\u{1FB38}': sextant(0b111011), // BLOCK SEXTANT-12456
  '\u{1FB39}': sextant(0b111100), // BLOCK SEXTANT-3456 (lower two thirds block)
  '\u{1FB3A}': sextant(0b111101), // BLOCK SEXTANT-13456
  '\u{1FB3B}': sextant(0b111110),  // BLOCK SEXTANT-23456
  // Pattern 63 (0x3F = 0b111111) = full block, skipped (exists as U+2588)

  // Smooth mosaic terminal graphic characters (0x1FB3C-0x1FB6F)
  // These are triangular/diagonal shapes. "X BLOCK DIAGONAL A TO B" means the X region is filled,
  // with a diagonal edge from point A to point B.
  // Reference points: upper/lower = y (0/1), left/right = x (0/1), centre = x=0.5
  // Vertical uses sextant grid: upper-middle = y=1/3, lower-middle = y=2/3

  // LOWER LEFT BLOCK variants (1FB3C-1FB40) - filled region in lower-left
  '\u{1FB3C}': () => `M0,${2/3} L0,1 L0.5,1 Z`,           // LOWER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER CENTRE
  '\u{1FB3D}': () => `M0,${2/3} L0,1 L1,1 Z`,             // LOWER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER RIGHT
  '\u{1FB3E}': () => `M0,${1/3} L0,1 L0.5,1 Z`,           // LOWER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER CENTRE
  '\u{1FB3F}': () => `M0,${1/3} L0,1 L1,1 Z`,             // LOWER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER RIGHT
  '\u{1FB40}': () => 'M0,0 L0,1 L0.5,1 Z',                // LOWER LEFT BLOCK DIAGONAL UPPER LEFT TO LOWER CENTRE

  // LOWER RIGHT BLOCK variants (1FB41-1FB4B) - filled region in lower-right
  '\u{1FB41}': () => `M0,${1/3} L0.5,0 L1,0 L1,1 L0,1 Z`, // LOWER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER CENTRE
  '\u{1FB42}': () => `M0,${1/3} L1,0 L1,1 L0,1 Z`,        // LOWER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER RIGHT
  '\u{1FB43}': () => `M0,${2/3} L0.5,0 L1,0 L1,1 L0,1 Z`, // LOWER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER CENTRE
  '\u{1FB44}': () => `M0,${2/3} L1,0 L1,1 L0,1 Z`,        // LOWER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER RIGHT
  '\u{1FB45}': () => 'M0,1 L0.5,0 L1,0 L1,1 Z',           // LOWER RIGHT BLOCK DIAGONAL LOWER LEFT TO UPPER CENTRE
  '\u{1FB46}': () => `M0,${2/3} L1,${1/3} L1,1 L0,1 Z`,   // LOWER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB47}': () => `M0.5,1 L1,${2/3} L1,1 Z`,           // LOWER RIGHT BLOCK DIAGONAL LOWER CENTRE TO LOWER MIDDLE RIGHT
  '\u{1FB48}': () => `M0,1 L1,${2/3} L1,1 Z`,             // LOWER RIGHT BLOCK DIAGONAL LOWER LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB49}': () => `M0.5,1 L1,${1/3} L1,1 Z`,           // LOWER RIGHT BLOCK DIAGONAL LOWER CENTRE TO UPPER MIDDLE RIGHT
  '\u{1FB4A}': () => `M0,1 L1,${1/3} L1,1 Z`,             // LOWER RIGHT BLOCK DIAGONAL LOWER LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB4B}': () => 'M0.5,1 L1,0 L1,1 Z',                // LOWER RIGHT BLOCK DIAGONAL LOWER CENTRE TO UPPER RIGHT

  // LOWER LEFT BLOCK variants continued (1FB4C-1FB51) - large fills with upper-right cut
  '\u{1FB4C}': () => `M0.5,0 L0,0 L0,1 L1,1 L1,${1/3} Z`, // LOWER LEFT BLOCK DIAGONAL UPPER CENTRE TO UPPER MIDDLE RIGHT
  '\u{1FB4D}': () => `M0,0 L0,1 L1,1 L1,${1/3} Z`,        // LOWER LEFT BLOCK DIAGONAL UPPER LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB4E}': () => `M0.5,0 L0,0 L0,1 L1,1 L1,${2/3} Z`, // LOWER LEFT BLOCK DIAGONAL UPPER CENTRE TO LOWER MIDDLE RIGHT
  '\u{1FB4F}': () => `M0,0 L0,1 L1,1 L1,${2/3} Z`,        // LOWER LEFT BLOCK DIAGONAL UPPER LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB50}': () => 'M0.5,0 L0,0 L0,1 L1,1 Z',           // LOWER LEFT BLOCK DIAGONAL UPPER CENTRE TO LOWER RIGHT
  '\u{1FB51}': () => `M0,${1/3} L0,1 L1,1 L1,${2/3} Z`,   // LOWER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER MIDDLE RIGHT

  // UPPER RIGHT BLOCK variants (1FB52-1FB56) - large fills with lower-left cut
  '\u{1FB52}': () => `M0,${2/3} L0.5,1 L1,1 L1,0 L0,0 Z`, // UPPER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER CENTRE
  '\u{1FB53}': () => `M0,${2/3} L1,1 L1,0 L0,0 Z`,        // UPPER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER RIGHT
  '\u{1FB54}': () => `M0,${1/3} L0.5,1 L1,1 L1,0 L0,0 Z`, // UPPER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER CENTRE
  '\u{1FB55}': () => `M0,${1/3} L1,1 L1,0 L0,0 Z`,        // UPPER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER RIGHT
  '\u{1FB56}': () => 'M0,0 L0.5,1 L1,1 L1,0 Z',           // UPPER RIGHT BLOCK DIAGONAL UPPER LEFT TO LOWER CENTRE

  // UPPER LEFT BLOCK variants (1FB57-1FB61) - small to large fills in upper-left
  '\u{1FB57}': () => `M0,${1/3} L0,0 L0.5,0 Z`,           // UPPER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER CENTRE
  '\u{1FB58}': () => `M0,${1/3} L0,0 L1,0 Z`,             // UPPER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER RIGHT
  '\u{1FB59}': () => `M0,${2/3} L0,0 L0.5,0 Z`,           // UPPER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER CENTRE
  '\u{1FB5A}': () => `M0,${2/3} L0,0 L1,0 Z`,             // UPPER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER RIGHT
  '\u{1FB5B}': () => 'M0,1 L0,0 L0.5,0 Z',                // UPPER LEFT BLOCK DIAGONAL LOWER LEFT TO UPPER CENTRE
  '\u{1FB5C}': () => `M0,${2/3} L0,0 L1,0 L1,${1/3} Z`,   // UPPER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB5D}': () => `M0.5,1 L0,1 L0,0 L1,0 L1,${2/3} Z`, // UPPER LEFT BLOCK DIAGONAL LOWER CENTRE TO LOWER MIDDLE RIGHT
  '\u{1FB5E}': () => `M0,1 L0,0 L1,0 L1,${2/3} Z`,        // UPPER LEFT BLOCK DIAGONAL LOWER LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB5F}': () => `M0.5,1 L0,1 L0,0 L1,0 L1,${1/3} Z`, // UPPER LEFT BLOCK DIAGONAL LOWER CENTRE TO UPPER MIDDLE RIGHT
  '\u{1FB60}': () => `M0,1 L0,0 L1,0 L1,${1/3} Z`,        // UPPER LEFT BLOCK DIAGONAL LOWER LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB61}': () => 'M0.5,1 L0,1 L0,0 L1,0 Z',           // UPPER LEFT BLOCK DIAGONAL LOWER CENTRE TO UPPER RIGHT

  // UPPER RIGHT BLOCK variants continued (1FB62-1FB67) - small to medium fills in upper-right
  '\u{1FB62}': () => `M0.5,0 L1,0 L1,${1/3} Z`,           // UPPER RIGHT BLOCK DIAGONAL UPPER CENTRE TO UPPER MIDDLE RIGHT
  '\u{1FB63}': () => `M0,0 L1,0 L1,${1/3} Z`,             // UPPER RIGHT BLOCK DIAGONAL UPPER LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB64}': () => `M0.5,0 L1,0 L1,${2/3} Z`,           // UPPER RIGHT BLOCK DIAGONAL UPPER CENTRE TO LOWER MIDDLE RIGHT
  '\u{1FB65}': () => `M0,0 L1,0 L1,${2/3} Z`,             // UPPER RIGHT BLOCK DIAGONAL UPPER LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB66}': () => 'M0.5,0 L1,0 L1,1 Z',                // UPPER RIGHT BLOCK DIAGONAL UPPER CENTRE TO LOWER RIGHT
  '\u{1FB67}': () => `M0,${1/3} L1,${2/3} L1,0 L0,0 Z`,   // UPPER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER MIDDLE RIGHT

  // Triangular blocks (1FB68-1FB6F)
  // Three-quarter blocks: full block minus one triangular quarter pointing to center
  '\u{1FB68}': () => 'M0,0 L1,0 L1,1 L0,1 L0.5,0.5 Z',    // UPPER AND RIGHT AND LOWER TRIANGULAR THREE QUARTERS BLOCK (missing left)
  '\u{1FB69}': () => 'M0,0 L0.5,0.5 L1,0 L1,1 L0,1 Z',    // LEFT AND LOWER AND RIGHT TRIANGULAR THREE QUARTERS BLOCK (missing upper)
  '\u{1FB6A}': () => 'M0,0 L1,0 L0.5,0.5 L1,1 L0,1 Z',    // UPPER AND LEFT AND LOWER TRIANGULAR THREE QUARTERS BLOCK (missing right)
  '\u{1FB6B}': () => 'M0,0 L1,0 L1,1 L0.5,0.5 L0,1 Z',    // LEFT AND UPPER AND RIGHT TRIANGULAR THREE QUARTERS BLOCK (missing lower)
  '\u{1FB6C}': () => 'M0,0 L0.5,0.5 L0,1 Z',              // LEFT TRIANGULAR ONE QUARTER BLOCK
  '\u{1FB6D}': () => 'M0,0 L1,0 L0.5,0.5 Z',              // UPPER TRIANGULAR ONE QUARTER BLOCK
  '\u{1FB6E}': () => 'M1,0 L1,1 L0.5,0.5 Z',              // RIGHT TRIANGULAR ONE QUARTER BLOCK
  '\u{1FB6F}': () => 'M0,1 L1,1 L0.5,0.5 Z'               // LOWER TRIANGULAR ONE QUARTER BLOCK
};

/** Region defined as [x, y, width, height] in 0-1 normalized coordinates. */
type RegionDefinition = [number, number, number, number];

/**
 * Rectangular shade characters - these use medium shade pattern with region bounds.
 * Pattern is a checkerboard that shifts 1px each row (same as medium shade).
 */
export const rectangularShadeDefinitions: { [index: string]: RegionDefinition | undefined } = {
  '\u{1FB8C}': [0, 0, 0.5, 1],   // LEFT HALF MEDIUM SHADE
  '\u{1FB8D}': [0.5, 0, 0.5, 1], // RIGHT HALF MEDIUM SHADE
  '\u{1FB8E}': [0, 0, 1, 0.5],   // UPPER HALF MEDIUM SHADE
  '\u{1FB8F}': [0, 0.5, 1, 0.5], // LOWER HALF MEDIUM SHADE
  '\u{1FB90}': [0, 0, 1, 1]      // INVERSE MEDIUM SHADE
};

/** [solidRegion, shadeRegion] where shade region uses inverse medium shade pattern. */
type BlockShadeComboDefinition = [RegionDefinition, RegionDefinition];

/**
 * Block + inverse shade combo characters.
 */
export const blockShadeComboDefinitions: { [index: string]: BlockShadeComboDefinition | undefined } = {
  '\u{1FB91}': [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],     // UPPER HALF BLOCK AND LOWER HALF INVERSE MEDIUM SHADE
  '\u{1FB92}': [[0, 0.5, 1, 0.5], [0, 0, 1, 0.5]],     // UPPER HALF INVERSE MEDIUM SHADE AND LOWER HALF BLOCK
  // 1FB93 is reserved
  '\u{1FB94}': [[0.5, 0, 0.5, 1], [0, 0, 0.5, 1]]      // LEFT HALF INVERSE MEDIUM SHADE AND RIGHT HALF BLOCK
};

/**
 * Defines the repeating pattern used by special characters, the pattern is made up of a 2d array of
 * pixel values to be filled (1) or not filled (0).
 */
export const patternCharacterDefinitions: { [key: string]: CustomGlyphPatternDefinition | undefined } = {
  // Shade characters (0x2591-0x2593)
  '░': [ // LIGHT SHADE (25%)
    [1, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 0]
  ],
  '▒': [ // MEDIUM SHADE (50%)
    [1, 0],
    [0, 0],
    [0, 1],
    [0, 0]
  ],
  '▓': [ // DARK SHADE (75%)
    [0, 1],
    [1, 1],
    [1, 0],
    [1, 1]
  ]
};

const enum Shapes {
  /** │ */ TOP_TO_BOTTOM = 'M.5,0 L.5,1',
  /** ─ */ LEFT_TO_RIGHT = 'M0,.5 L1,.5',

  /** └ */ TOP_TO_RIGHT = 'M.5,0 L.5,.5 L1,.5',
  /** ┘ */ TOP_TO_LEFT = 'M.5,0 L.5,.5 L0,.5',
  /** ┐ */ LEFT_TO_BOTTOM = 'M0,.5 L.5,.5 L.5,1',
  /** ┌ */ RIGHT_TO_BOTTOM = 'M0.5,1 L.5,.5 L1,.5',

  /** ╵ */ MIDDLE_TO_TOP = 'M.5,.5 L.5,0',
  /** ╴ */ MIDDLE_TO_LEFT = 'M.5,.5 L0,.5',
  /** ╶ */ MIDDLE_TO_RIGHT = 'M.5,.5 L1,.5',
  /** ╷ */ MIDDLE_TO_BOTTOM = 'M.5,.5 L.5,1',

  /** ┴ */ T_TOP = 'M0,.5 L1,.5 M.5,.5 L.5,0',
  /** ┤ */ T_LEFT = 'M.5,0 L.5,1 M.5,.5 L0,.5',
  /** ├ */ T_RIGHT = 'M.5,0 L.5,1 M.5,.5 L1,.5',
  /** ┬ */ T_BOTTOM = 'M0,.5 L1,.5 M.5,.5 L.5,1',

  /** ┼ */ CROSS = 'M0,.5 L1,.5 M.5,0 L.5,1',

  /** ╌ */ TWO_DASHES_HORIZONTAL = 'M.1,.5 L.4,.5 M.6,.5 L.9,.5', // .2 empty, .3 filled
  /** ┄ */ THREE_DASHES_HORIZONTAL = 'M.0667,.5 L.2667,.5 M.4,.5 L.6,.5 M.7333,.5 L.9333,.5', // .1333 empty, .2 filled
  /** ┉ */ FOUR_DASHES_HORIZONTAL = 'M.05,.5 L.2,.5 M.3,.5 L.45,.5 M.55,.5 L.7,.5 M.8,.5 L.95,.5', // .1 empty, .15 filled
  /** ╎ */ TWO_DASHES_VERTICAL = 'M.5,.1 L.5,.4 M.5,.6 L.5,.9',
  /** ┆ */ THREE_DASHES_VERTICAL = 'M.5,.0667 L.5,.2667 M.5,.4 L.5,.6 M.5,.7333 L.5,.9333',
  /** ┊ */ FOUR_DASHES_VERTICAL = 'M.5,.05 L.5,.2 M.5,.3 L.5,.45 L.5,.55 M.5,.7 L.5,.95',
}

const enum Style {
  NORMAL = 1,
  BOLD = 3
}


/**
 * This contains the definitions of all box drawing characters in the format of SVG paths (ie. the
 * svg d attribute).
 */
export const boxDrawingDefinitions: { [character: string]: { [fontWeight: number]: string | CustomGlyphDrawFunctionDefinition } | undefined } = {
  // Uniform normal and bold
  '─': { [Style.NORMAL]: Shapes.LEFT_TO_RIGHT },
  '━': { [Style.BOLD]:   Shapes.LEFT_TO_RIGHT },
  '│': { [Style.NORMAL]: Shapes.TOP_TO_BOTTOM },
  '┃': { [Style.BOLD]:   Shapes.TOP_TO_BOTTOM },
  '┌': { [Style.NORMAL]: Shapes.RIGHT_TO_BOTTOM },
  '┏': { [Style.BOLD]:   Shapes.RIGHT_TO_BOTTOM },
  '┐': { [Style.NORMAL]: Shapes.LEFT_TO_BOTTOM },
  '┓': { [Style.BOLD]:   Shapes.LEFT_TO_BOTTOM },
  '└': { [Style.NORMAL]: Shapes.TOP_TO_RIGHT },
  '┗': { [Style.BOLD]:   Shapes.TOP_TO_RIGHT },
  '┘': { [Style.NORMAL]: Shapes.TOP_TO_LEFT },
  '┛': { [Style.BOLD]:   Shapes.TOP_TO_LEFT },
  '├': { [Style.NORMAL]: Shapes.T_RIGHT },
  '┣': { [Style.BOLD]:   Shapes.T_RIGHT },
  '┤': { [Style.NORMAL]: Shapes.T_LEFT },
  '┫': { [Style.BOLD]:   Shapes.T_LEFT },
  '┬': { [Style.NORMAL]: Shapes.T_BOTTOM },
  '┳': { [Style.BOLD]:   Shapes.T_BOTTOM },
  '┴': { [Style.NORMAL]: Shapes.T_TOP },
  '┻': { [Style.BOLD]:   Shapes.T_TOP },
  '┼': { [Style.NORMAL]: Shapes.CROSS },
  '╋': { [Style.BOLD]:   Shapes.CROSS },
  '╴': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT },
  '╸': { [Style.BOLD]:   Shapes.MIDDLE_TO_LEFT },
  '╵': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP },
  '╹': { [Style.BOLD]:   Shapes.MIDDLE_TO_TOP },
  '╶': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT },
  '╺': { [Style.BOLD]:   Shapes.MIDDLE_TO_RIGHT },
  '╷': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM },
  '╻': { [Style.BOLD]:   Shapes.MIDDLE_TO_BOTTOM },

  // Double border
  '═': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp}` },
  '║': { [Style.NORMAL]: (xp, yp) => `M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1` },
  '╒': { [Style.NORMAL]: (xp, yp) => `M.5,1 L.5,${.5 - yp} L1,${.5 - yp} M.5,${.5 + yp} L1,${.5 + yp}` },
  '╓': { [Style.NORMAL]: (xp, yp) => `M${.5 - xp},1 L${.5 - xp},.5 L1,.5 M${.5 + xp},.5 L${.5 + xp},1` },
  '╔': { [Style.NORMAL]: (xp, yp) => `M1,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1` },
  '╕': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L.5,${.5 - yp} L.5,1 M0,${.5 + yp} L.5,${.5 + yp}` },
  '╖': { [Style.NORMAL]: (xp, yp) => `M${.5 + xp},1 L${.5 + xp},.5 L0,.5 M${.5 - xp},.5 L${.5 - xp},1` },
  '╗': { [Style.NORMAL]: (xp, yp) => `M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M0,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},1` },
  '╘': { [Style.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 + yp} L1,${.5 + yp} M.5,${.5 - yp} L1,${.5 - yp}` },
  '╙': { [Style.NORMAL]: (xp, yp) => `M1,.5 L${.5 - xp},.5 L${.5 - xp},0 M${.5 + xp},.5 L${.5 + xp},0` },
  '╚': { [Style.NORMAL]: (xp, yp) => `M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0 M1,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},0` },
  '╛': { [Style.NORMAL]: (xp, yp) => `M0,${.5 + yp} L.5,${.5 + yp} L.5,0 M0,${.5 - yp} L.5,${.5 - yp}` },
  '╜': { [Style.NORMAL]: (xp, yp) => `M0,.5 L${.5 + xp},.5 L${.5 + xp},0 M${.5 - xp},.5 L${.5 - xp},0` },
  '╝': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0 M0,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},0` },
  '╞': { [Style.NORMAL]: (xp, yp) => `${Shapes.TOP_TO_BOTTOM} M.5,${.5 - yp} L1,${.5 - yp} M.5,${.5 + yp} L1,${.5 + yp}` },
  '╟': { [Style.NORMAL]: (xp, yp) => `M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1 M${.5 + xp},.5 L1,.5` },
  '╠': { [Style.NORMAL]: (xp, yp) => `M${.5 - xp},0 L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1 M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0` },
  '╡': { [Style.NORMAL]: (xp, yp) => `${Shapes.TOP_TO_BOTTOM} M0,${.5 - yp} L.5,${.5 - yp} M0,${.5 + yp} L.5,${.5 + yp}` },
  '╢': { [Style.NORMAL]: (xp, yp) => `M0,.5 L${.5 - xp},.5 M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1` },
  '╣': { [Style.NORMAL]: (xp, yp) => `M${.5 + xp},0 L${.5 + xp},1 M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0` },
  '╤': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp} M.5,${.5 + yp} L.5,1` },
  '╥': { [Style.NORMAL]: (xp, yp) => `${Shapes.LEFT_TO_RIGHT} M${.5 - xp},.5 L${.5 - xp},1 M${.5 + xp},.5 L${.5 + xp},1` },
  '╦': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1` },
  '╧': { [Style.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 - yp} M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp}` },
  '╨': { [Style.NORMAL]: (xp, yp) => `${Shapes.LEFT_TO_RIGHT} M${.5 - xp},.5 L${.5 - xp},0 M${.5 + xp},.5 L${.5 + xp},0` },
  '╩': { [Style.NORMAL]: (xp, yp) => `M0,${.5 + yp} L1,${.5 + yp} M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0 M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0` },
  '╪': { [Style.NORMAL]: (xp, yp) => `${Shapes.TOP_TO_BOTTOM} M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp}` },
  '╫': { [Style.NORMAL]: (xp, yp) => `${Shapes.LEFT_TO_RIGHT} M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1` },
  '╬': { [Style.NORMAL]: (xp, yp) => `M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1 M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0 M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0` },

  // Diagonal
  '╱': { [Style.NORMAL]: 'M1,0 L0,1' },
  '╲': { [Style.NORMAL]: 'M0,0 L1,1' },
  '╳': { [Style.NORMAL]: 'M1,0 L0,1 M0,0 L1,1' },

  // Mixed weight
  '╼': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '╽': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '╾': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '╿': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┍': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┎': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┑': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┒': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┕': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┖': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┙': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┚': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┝': { [Style.NORMAL]: Shapes.TOP_TO_BOTTOM,                                 [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┞': { [Style.NORMAL]: Shapes.RIGHT_TO_BOTTOM,                               [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┟': { [Style.NORMAL]: Shapes.TOP_TO_RIGHT,                                  [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┠': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.TOP_TO_BOTTOM },
  '┡': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.TOP_TO_RIGHT },
  '┢': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.RIGHT_TO_BOTTOM },
  '┥': { [Style.NORMAL]: Shapes.TOP_TO_BOTTOM,                                 [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┦': { [Style.NORMAL]: Shapes.LEFT_TO_BOTTOM,                                [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┧': { [Style.NORMAL]: Shapes.TOP_TO_LEFT,                                   [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┨': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.TOP_TO_BOTTOM },
  '┩': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.TOP_TO_LEFT },
  '┪': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.LEFT_TO_BOTTOM },
  '┭': { [Style.NORMAL]: Shapes.RIGHT_TO_BOTTOM,                               [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┮': { [Style.NORMAL]: Shapes.LEFT_TO_BOTTOM,                                [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┯': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.LEFT_TO_RIGHT },
  '┰': { [Style.NORMAL]: Shapes.LEFT_TO_RIGHT,                                 [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┱': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.LEFT_TO_BOTTOM },
  '┲': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.RIGHT_TO_BOTTOM },
  '┵': { [Style.NORMAL]: Shapes.TOP_TO_RIGHT,                                  [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┶': { [Style.NORMAL]: Shapes.TOP_TO_LEFT,                                   [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┷': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.LEFT_TO_RIGHT },
  '┸': { [Style.NORMAL]: Shapes.LEFT_TO_RIGHT,                                 [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┹': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.TOP_TO_LEFT },
  '┺': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.TOP_TO_RIGHT },
  '┽': { [Style.NORMAL]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_RIGHT}`,  [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┾': { [Style.NORMAL]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_LEFT}`,   [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┿': { [Style.NORMAL]: Shapes.TOP_TO_BOTTOM,                                 [Style.BOLD]: Shapes.LEFT_TO_RIGHT },
  '╀': { [Style.NORMAL]: `${Shapes.LEFT_TO_RIGHT} ${Shapes.MIDDLE_TO_BOTTOM}`, [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '╁': { [Style.NORMAL]: `${Shapes.MIDDLE_TO_TOP} ${Shapes.LEFT_TO_RIGHT}`,    [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '╂': { [Style.NORMAL]: Shapes.LEFT_TO_RIGHT,                                 [Style.BOLD]: Shapes.TOP_TO_BOTTOM },
  '╃': { [Style.NORMAL]: Shapes.RIGHT_TO_BOTTOM,                               [Style.BOLD]: Shapes.TOP_TO_LEFT },
  '╄': { [Style.NORMAL]: Shapes.LEFT_TO_BOTTOM,                                [Style.BOLD]: Shapes.TOP_TO_RIGHT },
  '╅': { [Style.NORMAL]: Shapes.TOP_TO_RIGHT,                                  [Style.BOLD]: Shapes.LEFT_TO_BOTTOM },
  '╆': { [Style.NORMAL]: Shapes.TOP_TO_LEFT,                                   [Style.BOLD]: Shapes.RIGHT_TO_BOTTOM },
  '╇': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: `${Shapes.MIDDLE_TO_TOP} ${Shapes.LEFT_TO_RIGHT}` },
  '╈': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: `${Shapes.LEFT_TO_RIGHT} ${Shapes.MIDDLE_TO_BOTTOM}` },
  '╉': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_LEFT}` },
  '╊': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_RIGHT}` },

  // Dashed
  '╌': { [Style.NORMAL]: Shapes.TWO_DASHES_HORIZONTAL },
  '╍': { [Style.BOLD]:   Shapes.TWO_DASHES_HORIZONTAL },
  '┄': { [Style.NORMAL]: Shapes.THREE_DASHES_HORIZONTAL },
  '┅': { [Style.BOLD]:   Shapes.THREE_DASHES_HORIZONTAL },
  '┈': { [Style.NORMAL]: Shapes.FOUR_DASHES_HORIZONTAL },
  '┉': { [Style.BOLD]:   Shapes.FOUR_DASHES_HORIZONTAL },
  '╎': { [Style.NORMAL]: Shapes.TWO_DASHES_VERTICAL },
  '╏': { [Style.BOLD]:   Shapes.TWO_DASHES_VERTICAL },
  '┆': { [Style.NORMAL]: Shapes.THREE_DASHES_VERTICAL  },
  '┇': { [Style.BOLD]:   Shapes.THREE_DASHES_VERTICAL },
  '┊': { [Style.NORMAL]: Shapes.FOUR_DASHES_VERTICAL },
  '┋': { [Style.BOLD]:   Shapes.FOUR_DASHES_VERTICAL },

  // Curved
  '╭': { [Style.NORMAL]: (xp, yp) => `M.5,1 L.5,${.5 + (yp / .15 * .5)} C.5,${.5 + (yp / .15 * .5)},.5,.5,1,.5` },
  '╮': { [Style.NORMAL]: (xp, yp) => `M.5,1 L.5,${.5 + (yp / .15 * .5)} C.5,${.5 + (yp / .15 * .5)},.5,.5,0,.5` },
  '╯': { [Style.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 - (yp / .15 * .5)} C.5,${.5 - (yp / .15 * .5)},.5,.5,0,.5` },
  '╰': { [Style.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 - (yp / .15 * .5)} C.5,${.5 - (yp / .15 * .5)},.5,.5,1,.5` }
};

/**
 * This contains the definitions of the primarily used box drawing characters as vector shapes. The
 * reason these characters are defined specially is to avoid common problems if a user's font has
 * not been patched with powerline characters and also to get pixel perfect rendering as rendering
 * issues can occur around AA/SPAA.
 *
 * The line variants draw beyond the cell and get clipped to ensure the end of the line is not
 * visible.
 *
 * Original symbols defined in https://github.com/powerline/fontpatcher
 */
export const powerlineDefinitions: { [index: string]: ICustomGlyphVectorShape } = {
  // Git branch
  '\u{E0A0}': { d: 'M.3,1 L.03,1 L.03,.88 C.03,.82,.06,.78,.11,.73 C.15,.7,.2,.68,.28,.65 L.43,.6 C.49,.58,.53,.56,.56,.53 C.59,.5,.6,.47,.6,.43 L.6,.27 L.4,.27 L.69,.1 L.98,.27 L.78,.27 L.78,.46 C.78,.52,.76,.56,.72,.61 C.68,.66,.63,.67,.56,.7 L.48,.72 C.42,.74,.38,.76,.35,.78 C.32,.8,.31,.84,.31,.88 L.31,1 M.3,.5 L.03,.59 L.03,.09 L.3,.09 L.3,.655', type: CustomGlyphVectorType.FILL },
  // L N
  '\u{E0A1}': { d: 'M.7,.4 L.7,.47 L.2,.47 L.2,.03 L.355,.03 L.355,.4 L.705,.4 M.7,.5 L.86,.5 L.86,.95 L.69,.95 L.44,.66 L.46,.86 L.46,.95 L.3,.95 L.3,.49 L.46,.49 L.71,.78 L.69,.565 L.69,.5', type: CustomGlyphVectorType.FILL },
  // Lock
  '\u{E0A2}': { d: 'M.25,.94 C.16,.94,.11,.92,.11,.87 L.11,.53 C.11,.48,.15,.455,.23,.45 L.23,.3 C.23,.25,.26,.22,.31,.19 C.36,.16,.43,.15,.51,.15 C.59,.15,.66,.16,.71,.19 C.77,.22,.79,.26,.79,.3 L.79,.45 C.87,.45,.91,.48,.91,.53 L.91,.87 C.91,.92,.86,.94,.77,.94 L.24,.94 M.53,.2 C.49,.2,.45,.21,.42,.23 C.39,.25,.38,.27,.38,.3 L.38,.45 L.68,.45 L.68,.3 C.68,.27,.67,.25,.64,.23 C.61,.21,.58,.2,.53,.2 M.58,.82 L.58,.66 C.63,.65,.65,.63,.65,.6 C.65,.58,.64,.57,.61,.56 C.58,.55,.56,.54,.52,.54 C.48,.54,.46,.55,.43,.56 C.4,.57,.39,.59,.39,.6 C.39,.63,.41,.64,.46,.66 L.46,.82 L.57,.82', type: CustomGlyphVectorType.FILL },
  // Right triangle solid
  '\u{E0B0}': { d: 'M0,0 L1,.5 L0,1', type: CustomGlyphVectorType.FILL, rightPadding: 2 },
  // Right triangle line
  '\u{E0B1}': { d: 'M-1,-.5 L1,.5 L-1,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 },
  // Left triangle solid
  '\u{E0B2}': { d: 'M1,0 L0,.5 L1,1', type: CustomGlyphVectorType.FILL, leftPadding: 2 },
  // Left triangle line
  '\u{E0B3}': { d: 'M2,-.5 L0,.5 L2,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 },
  // Right semi-circle solid
  '\u{E0B4}': { d: 'M0,0 L0,1 C0.552,1,1,0.776,1,.5 C1,0.224,0.552,0,0,0', type: CustomGlyphVectorType.FILL, rightPadding: 1 },
  // Right semi-circle line
  '\u{E0B5}': { d: 'M.2,1 C.422,1,.8,.826,.78,.5 C.8,.174,0.422,0,.2,0', type: CustomGlyphVectorType.STROKE, rightPadding: 1 },
  // Left semi-circle solid
  '\u{E0B6}': { d: 'M1,0 L1,1 C0.448,1,0,0.776,0,.5 C0,0.224,0.448,0,1,0', type: CustomGlyphVectorType.FILL, leftPadding: 1 },
  // Left semi-circle line
  '\u{E0B7}': { d: 'M.8,1 C0.578,1,0.2,.826,.22,.5 C0.2,0.174,0.578,0,0.8,0', type: CustomGlyphVectorType.STROKE, leftPadding: 1 },
  // Lower left triangle
  '\u{E0B8}': { d: 'M-.5,-.5 L1.5,1.5 L-.5,1.5', type: CustomGlyphVectorType.FILL },
  // Backslash separator
  '\u{E0B9}': { d: 'M-.5,-.5 L1.5,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 },
  // Lower right triangle
  '\u{E0BA}': { d: 'M1.5,-.5 L-.5,1.5 L1.5,1.5', type: CustomGlyphVectorType.FILL },
  // Upper left triangle
  '\u{E0BC}': { d: 'M1.5,-.5 L-.5,1.5 L-.5,-.5', type: CustomGlyphVectorType.FILL },
  // Forward slash separator
  '\u{E0BD}': { d: 'M1.5,-.5 L-.5,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 },
  // Upper right triangle
  '\u{E0BE}': { d: 'M-.5,-.5 L1.5,1.5 L1.5,-.5', type: CustomGlyphVectorType.FILL }
};
// Forward slash separator redundant
powerlineDefinitions['\u{E0BB}'] = powerlineDefinitions['\u{E0BD}'];
// Backslash separator redundant
powerlineDefinitions['\u{E0BF}'] = powerlineDefinitions['\u{E0B9}'];
