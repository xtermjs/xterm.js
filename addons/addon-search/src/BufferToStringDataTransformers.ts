import { Terminal } from '@xterm/xterm';
export type LineCacheEntry = [
  /**
   * The string representation of a line (as opposed to the buffer cell representation).
   */
  lineAsString: string,
  /**
   * The offsets where each line starts when the entry describes a wrapped line.
   */
  lineOffsets: number[]
];
export function stringLengthToBufferSize(terminal: Terminal,row: number, offset: number): number {
  const line = terminal!.buffer.active.getLine(row);
  if (!line) {
    return 0;
  }
  for (let i = 0; i < offset; i++) {
    const cell = line.getCell(i);
    if (!cell) {
      break;
    }
    // Adjust the searchIndex to normalize emoji into single chars
    const char = cell.getChars();
    if (char.length > 1) {
      offset -= char.length - 1;
    }
    // Adjust the searchIndex for empty characters following wide unicode
    // chars (eg. CJK)
    const nextCell = line.getCell(i + 1);
    if (nextCell && nextCell.getWidth() === 0) {
      offset++;
    }
  }
  return offset;
}


export function bufferColsToStringOffset(terminal: Terminal,startRow: number, cols: number): number {
  let lineIndex = startRow;
  let offset = 0;
  let line = terminal.buffer.active.getLine(lineIndex);
  while (cols > 0 && line) {
    for (let i = 0; i < cols && i < terminal.cols; i++) {
      const cell = line.getCell(i);
      if (!cell) {
        break;
      }
      if (cell.getWidth()) {
        // Treat null characters as whitespace to align with the translateToString API
        offset += cell.getCode() === 0 ? 1 : cell.getChars().length;
      }
    }
    lineIndex++;
    line = terminal.buffer.active.getLine(lineIndex);
    if (line && !line.isWrapped) {
      break;
    }
    cols -= terminal.cols;
  }
  return offset;
}


/**
 * Translates a buffer line to a string, including subsequent lines if they are wraps.
 * Wide characters will count as two columns in the resulting string. This
 * function is useful for getting the actual text underneath the raw selection
 * position.
 * @param lineIndex The index of the line being translated.
 * @param trimRight Whether to trim whitespace to the right.
 */
export function translateBufferLineToStringWithWrap(terminal: Terminal,lineIndex: number, trimRight: boolean): LineCacheEntry {
  const strings = [];
  const lineOffsets = [0];
  let line = terminal.buffer.active.getLine(lineIndex);
  while (line) {
    const nextLine = terminal.buffer.active.getLine(lineIndex + 1);
    const lineWrapsToNext = nextLine ? nextLine.isWrapped : false;
    let string = line.translateToString(!lineWrapsToNext && trimRight);
    if (lineWrapsToNext && nextLine) {
      const lastCell = line.getCell(line.length - 1);
      const lastCellIsNull = lastCell && lastCell.getCode() === 0 && lastCell.getWidth() === 1;
      // a wide character wrapped to the next line
      if (lastCellIsNull && nextLine.getCell(0)?.getWidth() === 2) {
        string = string.slice(0, -1);
      }
    }
    strings.push(string);
    if (lineWrapsToNext) {
      lineOffsets.push(lineOffsets[lineOffsets.length - 1] + string.length);
    } else {
      break;
    }
    lineIndex++;
    line = nextLine;
  }
  return [strings.join(''), lineOffsets];
}

