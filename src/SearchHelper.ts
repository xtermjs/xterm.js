import { ITerminal } from './Interfaces';

interface ISearchResult {
  term: string;
  col: number;
  row: number;
}

export class SearchHelper {
  constructor(private _terminal: ITerminal) {
  }

  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The term to search for.
   * @return Whether a result was found.
   */
  public findNext(term: string): boolean {
    if (!term || term.length === 0) {
      return;
    }
    // TODO: Return number of results?

    let result: ISearchResult;

    let startRow = this._terminal.ydisp;
    if (this._terminal.selectionManager.selectionEnd) {
      // Start from the selection end if there is a selection
      startRow = this._terminal.selectionManager.selectionEnd[1];
    }

    // Search from ydisp + 1 to end
    for (let y = startRow + 1; y < this._terminal.ybase + this._terminal.rows; y++) {
      result = this._findInLine(term, y);
      if (result) {
        break;
      }
    }

    // Search from the top to the current ydisp
    if (!result) {
      for (let y = 0; y < startRow; y++) {
        result = this._findInLine(term, y);
        if (result) {
          break;
        }
      }
    }

    // Set selection and scroll if a result was found
    return this._selectResult(result);
  }

  private _findInLine(term: string, y: number): ISearchResult {
    const bufferLine = this._terminal.lines.get(y);
    const stringLine = this._translateBufferLineToString(bufferLine, true);
    const searchIndex = stringLine.indexOf(term);
    if (searchIndex >= 0) {
      return {
        term,
        col: searchIndex,
        row: y
      };
    }
  }

  private _selectResult(result: ISearchResult): boolean {
    if (!result) {
      return;
    }
    this._terminal.selectionManager.setSelection(result.col, result.row, result.term.length);
    const scrollAmount = Math.max(Math.min(result.row - this._terminal.ydisp, this._terminal.ybase), 0);
    this._terminal.scrollDisp(scrollAmount, false);
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
