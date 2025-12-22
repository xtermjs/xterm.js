/// <reference path="../typings/xterm.d.ts"/>

import { Terminal } from '@xterm/xterm';

export type UnicodeRangeDefinition = [
  label: string,
  start: number,
  end: number,
];

/**
 * Write a unicode table to the terminal from start to end code points.
 *
 * Beware: Vibe coding ahead
 */
export function writeUnicodeTable(term: Terminal, name: string, start: number, end: number, definitions?: UnicodeRangeDefinition[]): void {
  function bold(text: string): string {
    return '\x1b[1m' + text + '\x1b[22m';
  }
  function faint(text: string): string {
    return '\x1b[2m' + text + '\x1b[22m';
  }
  // Rotating colors: Red, Green, Yellow, Blue, Magenta, Cyan
  const colors = [31, 32, 33, 34, 35, 36];
  function color(text: string, colorIndex: number): string {
    const c = colors[colorIndex % colors.length];
    return '\x1b[' + c + 'm' + text + '\x1b[39m';
  }

  term.write('\n\r');
  term.write('\n\r');
  term.write(`${bold(name)} (${start.toString(16).toUpperCase()}-${end.toString(16).toUpperCase()})\n\r`);
  term.write('\n\r');
  term.write(bold('         0 1 2 3 4 5 6 7 8 9 A B C D E F') + '\n\r');

  const startRow = Math.floor(start / 16);

  // Build a map of codepoint -> label and colorIndex for start positions
  const labelStartMap = new Map<number, { label: string, colorIndex: number }>();
  // Build a map of codepoint -> colorIndex for all codepoints in each range
  const codePointColorMap = new Map<number, number>();
  let lastDefinitionEnd = start; // Track the last definition's end to stop printing there
  if (definitions) {
    for (let i = 0; i < definitions.length; i++) {
      const [label, labelStart, labelEnd] = definitions[i];
      labelStartMap.set(labelStart, { label, colorIndex: i });
      // Map all codepoints in the range to this color
      for (let cp = labelStart; cp <= labelEnd; cp++) {
        codePointColorMap.set(cp, i);
      }
      if (labelEnd > lastDefinitionEnd) {
        lastDefinitionEnd = labelEnd;
      }
    }
  }

  const effectiveEnd = definitions ? lastDefinitionEnd : end;
  const endRow = Math.floor(effectiveEnd / 16);

  for (let row = startRow; row <= endRow; row++) {
    // Collect labels for this row with their column positions and color
    const rowLabels: { col: number, label: string, colorIndex: number }[] = [];
    for (let col = 0; col < 16; col++) {
      const codePoint = row * 16 + col;
      const labelInfo = labelStartMap.get(codePoint);
      if (labelInfo) {
        rowLabels.push({ col, label: labelInfo.label, colorIndex: labelInfo.colorIndex });
      }
    }

    // If labels exist and don't start at column 0, first output chars before first label
    if (rowLabels.length > 0 && rowLabels[0].col > 0) {
      const rowHex = row.toString(16).toUpperCase();
      const rowPrefix = `U+${rowHex}x`.padEnd(8, ' ');
      term.write(bold(rowPrefix));
      for (let col = 0; col < rowLabels[0].col; col++) {
        const codePoint = row * 16 + col;
        term.write(' ');
        if (codePoint >= start && codePoint <= end) {
          const charColorIndex = codePointColorMap.get(codePoint);
          if (charColorIndex !== undefined) {
            term.write(color(String.fromCodePoint(codePoint), charColorIndex));
          } else {
            term.write(String.fromCodePoint(codePoint));
          }
        } else {
          term.write(' ');
        }
      }
      term.write('\n\r');
    }

    // If labels exist, render them above the row
    if (rowLabels.length > 0) {
      // Render label lines from top to bottom (first label on top, last label closest to row)
      for (let i = 0; i < rowLabels.length; i++) {
        const prefix = ' '.repeat(8); // Same width as "U+1FB0x  "
        let line = '';
        let visualLen = 0; // Track visual length separately from string length (escape codes don't count)
        for (let col = 0; col < 16; col++) {
          const colPos = col * 2; // Each char takes 2 positions (char + space)
          const labelAtCol = rowLabels.findIndex(l => l.col === col);
          if (labelAtCol === i) {
            // This is where we show the label
            const padding = ' '.repeat(colPos - visualLen);
            line += padding + color('┌' + rowLabels[i].label, rowLabels[i].colorIndex);
            break;
          } else if (labelAtCol !== -1 && labelAtCol < i) {
            // Show vertical line for labels that were already rendered above
            const padding = ' '.repeat(colPos - visualLen);
            line += padding + color('│', rowLabels[labelAtCol].colorIndex);
            visualLen = colPos + 1;
          }
        }
        term.write(faint(prefix + line) + '\n\r');
      }
    }

    // Row prefix (e.g., "U+1FB0x  ")
    const rowHex = row.toString(16).toUpperCase();
    const rowPrefix = `U+${rowHex}x`.padEnd(8, ' ');
    const isSecondPrint = rowLabels.length > 0 && rowLabels[0].col > 0;
    term.write(isSecondPrint ? ' '.repeat(rowPrefix.length) : bold(rowPrefix));

    // Determine starting column (skip chars already output if we had labels not at col 0)
    const startCol = isSecondPrint ? rowLabels[0].col : 0;

    // Determine ending column (stop at effectiveEnd on the last row)
    const endCol = (row === endRow) ? (effectiveEnd % 16) + 1 : 16;

    // Pad for skipped columns
    for (let col = 0; col < startCol; col++) {
      term.write('  ');
    }

    // Characters in this row
    for (let col = startCol; col < endCol; col++) {
      const codePoint = row * 16 + col;

      // Check if a label starts here
      const labelInfo = labelStartMap.get(codePoint);
      if (labelInfo) {
        term.write(faint(color('└', labelInfo.colorIndex)));
      } else {
        term.write(' ');
      }

      if (codePoint >= start && codePoint <= effectiveEnd) {
        // Color the character if it's part of a definition range
        const charColorIndex = codePointColorMap.get(codePoint);
        if (charColorIndex !== undefined) {
          term.write(color(String.fromCodePoint(codePoint), charColorIndex));
        } else {
          term.write(String.fromCodePoint(codePoint));
        }
      } else {
        term.write(' ');
      }
    }

    term.write('\n\r');
  }
}
