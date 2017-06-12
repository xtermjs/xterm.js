import { ITerminal } from './Interfaces';

export class SearchHelper {
  constructor(private _terminal: ITerminal) {

  }

  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The term to search for.
   */
  public findNext(term: string): void {
    if (!term || term.length === 0) {
      return;
    }
    // TODO: Return number of results?

    for (let currentLine = this._terminal.ydisp; currentLine < this._terminal.ybase + this._terminal.rows; currentLine++) {
      const bufferLine = this._terminal.lines.get(currentLine);
      const stringLine = this._translateBufferLineToString(bufferLine, true);
      const searchIndex = stringLine.indexOf(term);
      if (searchIndex >= 0) {
        console.log('found term on line: ' + currentLine);
        console.log(stringLine);
        this._terminal.selectionManager.setSelection(searchIndex, currentLine, term.length);
        break;
      }
    }
  }

  // TODO: Consolidate with SelectionManager function
  private _translateBufferLineToString(line: any, trimRight: boolean, startCol: number = 0, endCol: number = null): string {
    // TODO: This function should live in a buffer or buffer line class

    // TODO: Move these constants elsewhere, they belong in a buffer or buffer
    //       data/line class.
    const LINE_DATA_CHAR_INDEX = 1;
    const LINE_DATA_WIDTH_INDEX = 2;
    // Get full line
    let lineString = '';
    let widthAdjustedStartCol = startCol;
    let widthAdjustedEndCol = endCol;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      lineString += char[LINE_DATA_CHAR_INDEX];
      // Adjust start and end cols for wide characters if they affect their
      // column indexes
      if (char[LINE_DATA_WIDTH_INDEX] === 0) {
        if (startCol >= i) {
          widthAdjustedStartCol--;
        }
        if (endCol >= i) {
          widthAdjustedEndCol--;
        }
      }
    }

    // Calculate the final end col by trimming whitespace on the right of the
    // line if needed.
    let finalEndCol = widthAdjustedEndCol || line.length;
    if (trimRight) {
      const rightWhitespaceIndex = lineString.search(/\s+$/);
      if (rightWhitespaceIndex !== -1) {
        finalEndCol = Math.min(finalEndCol, rightWhitespaceIndex);
      }
      // Return the empty string if only trimmed whitespace is selected
      if (finalEndCol <= widthAdjustedStartCol) {
        return '';
      }
    }

    return lineString.substring(widthAdjustedStartCol, finalEndCol);
  }
}
