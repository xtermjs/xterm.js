import { CHAR_DATA_ATTR_INDEX, CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from '../Buffer';
import { ITerminal, IBufferLine } from '../Types';
import { ICharacterJoinerRegistry, ICharacterJoiner } from './Types';

export class CharacterJoinerRegistry implements ICharacterJoinerRegistry {

  private _characterJoiners: ICharacterJoiner[] = [];
  private _nextCharacterJoinerId: number = 0;

  constructor(private _terminal: ITerminal) {
  }

  public registerCharacterJoiner(handler: (text: string) => [number, number][]): number {
    const joiner: ICharacterJoiner = {
      id: this._nextCharacterJoinerId++,
      handler
    };

    this._characterJoiners.push(joiner);
    return joiner.id;
  }

  public deregisterCharacterJoiner(joinerId: number): boolean {
    for (let i = 0; i < this._characterJoiners.length; i++) {
      if (this._characterJoiners[i].id === joinerId) {
        this._characterJoiners.splice(i, 1);
        return true;
      }
    }

    return false;
  }

  public getJoinedCharacters(row: number): [number, number][] {
    if (this._characterJoiners.length === 0) {
      return [];
    }

    const line = this._terminal.buffer.lines.get(row);
    if (line.length === 0) {
      return [];
    }

    const ranges: [number, number][] = [];
    const lineStr = this._terminal.buffer.translateBufferLineToString(row, true);

    // Because some cells can be represented by multiple javascript characters,
    // we track the cell and the string indexes separately. This allows us to
    // translate the string ranges we get from the joiners back into cell ranges
    // for use when rendering
    let rangeStartColumn = 0;
    let currentStringIndex = 0;
    let rangeStartStringIndex = 0;
    let rangeAttr = line.get(0)[CHAR_DATA_ATTR_INDEX] >> 9;

    for (let x = 0; x < this._terminal.cols; x++) {
      const charData = line.get(x);
      const chars = charData[CHAR_DATA_CHAR_INDEX];
      const width = charData[CHAR_DATA_WIDTH_INDEX];
      const attr = charData[CHAR_DATA_ATTR_INDEX] >> 9;

      if (width === 0) {
        // If this character is of width 0, skip it.
        continue;
      }

      // End of range
      if (attr !== rangeAttr) {
        // If we ended up with a sequence of more than one character,
        // look for ranges to join.
        if (x - rangeStartColumn > 1) {
          const joinedRanges = this._getJoinedRanges(
            lineStr,
            rangeStartStringIndex,
            currentStringIndex,
            line,
            rangeStartColumn
          );
          for (let i = 0; i < joinedRanges.length; i++) {
            ranges.push(joinedRanges[i]);
          }
        }

        // Reset our markers for a new range.
        rangeStartColumn = x;
        rangeStartStringIndex = currentStringIndex;
        rangeAttr = attr;
      }

      currentStringIndex += chars.length;
    }

    // Process any trailing ranges.
    if (this._terminal.cols - rangeStartColumn > 1) {
      const joinedRanges = this._getJoinedRanges(
        lineStr,
        rangeStartStringIndex,
        currentStringIndex,
        line,
        rangeStartColumn
      );
      for (let i = 0; i < joinedRanges.length; i++) {
        ranges.push(joinedRanges[i]);
      }
    }

    return ranges;
  }

  /**
   * Given a segment of a line of text, find all ranges of text that should be
   * joined in a single rendering unit. Ranges are internally converted to
   * column ranges, rather than string ranges.
   * @param line String representation of the full line of text
   * @param startIndex Start position of the range to search in the string (inclusive)
   * @param endIndex End position of the range to search in the string (exclusive)
   */
  private _getJoinedRanges(line: string, startIndex: number, endIndex: number, lineData: IBufferLine, startCol: number): [number, number][] {
    const text = line.substring(startIndex, endIndex);
    // At this point we already know that there is at least one joiner so
    // we can just pull its value and assign it directly rather than
    // merging it into an empty array, which incurs unnecessary writes.
    const joinedRanges: [number, number][] = this._characterJoiners[0].handler(text);
    for (let i = 1; i < this._characterJoiners.length; i++) {
      // We merge any overlapping ranges across the different joiners
      const joinerRanges = this._characterJoiners[i].handler(text);
      for (let j = 0; j < joinerRanges.length; j++) {
        CharacterJoinerRegistry._mergeRanges(joinedRanges, joinerRanges[j]);
      }
    }
    this._stringRangesToCellRanges(joinedRanges, lineData, startCol);
    return joinedRanges;
  }

  /**
   * Modifies the provided ranges in-place to adjust for variations between
   * string length and cell width so that the range represents a cell range,
   * rather than the string range the joiner provides.
   * @param ranges String ranges containing start (inclusive) and end (exclusive) index
   * @param line Cell data for the relevant line in the terminal
   * @param startCol Offset within the line to start from
   */
  private _stringRangesToCellRanges(ranges: [number, number][], line: IBufferLine, startCol: number): void {
    let currentRangeIndex = 0;
    let currentRangeStarted = false;
    let currentStringIndex = 0;
    let currentRange = ranges[currentRangeIndex];

    // If we got through all of the ranges, stop searching
    if (!currentRange) {
      return;
    }

    for (let x = startCol; x < this._terminal.cols; x++) {
      const charData = line.get(x);
      const width = charData[CHAR_DATA_WIDTH_INDEX];
      const length = charData[CHAR_DATA_CHAR_INDEX].length;

      // We skip zero-width characters when creating the string to join the text
      // so we do the same here
      if (width === 0) {
        continue;
      }

      // Adjust the start of the range
      if (!currentRangeStarted && currentRange[0] <= currentStringIndex) {
        currentRange[0] = x;
        currentRangeStarted = true;
      }

      // Adjust the end of the range
      if (currentRange[1] <= currentStringIndex) {
        currentRange[1] = x;

        // We're finished with this range, so we move to the next one
        currentRange = ranges[++currentRangeIndex];

        // If there are no more ranges left, stop searching
        if (!currentRange) {
          break;
        }

        // Ranges can be on adjacent characters. Because the end index of the
        // ranges are exclusive, this means that the index for the start of a
        // range can be the same as the end index of the previous range. To
        // account for the start of the next range, we check here just in case.
        if (currentRange[0] <= currentStringIndex) {
          currentRange[0] = x;
          currentRangeStarted = true;
        } else {
          currentRangeStarted = false;
        }
      }

      // Adjust the string index based on the character length to line up with
      // the column adjustment
      currentStringIndex += length;
    }

    // If there is still a range left at the end, it must extend all the way to
    // the end of the line.
    if (currentRange) {
      currentRange[1] = this._terminal.cols;
    }
  }

  /**
   * Merges the range defined by the provided start and end into the list of
   * existing ranges. The merge is done in place on the existing range for
   * performance and is also returned.
   * @param ranges Existing range list
   * @param newRange Tuple of two numbers representing the new range to merge in.
   * @returns The ranges input with the new range merged in place
   */
  private static _mergeRanges(ranges: [number, number][], newRange: [number, number]): [number, number][] {
    let inRange = false;
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      if (!inRange) {
        if (newRange[1] <= range[0]) {
          // Case 1: New range is before the search range
          ranges.splice(i, 0, newRange);
          return ranges;
        }

        if (newRange[1] <= range[1]) {
          // Case 2: New range is either wholly contained within the
          // search range or overlaps with the front of it
          range[0] = Math.min(newRange[0], range[0]);
          return ranges;
        }

        if (newRange[0] < range[1]) {
          // Case 3: New range either wholly contains the search range
          // or overlaps with the end of it
          range[0] = Math.min(newRange[0], range[0]);
          inRange = true;
        }

        // Case 4: New range starts after the search range
        continue;
      } else {
        if (newRange[1] <= range[0]) {
          // Case 5: New range extends from previous range but doesn't
          // reach the current one
          ranges[i - 1][1] = newRange[1];
          return ranges;
        }

        if (newRange[1] <= range[1]) {
          // Case 6: New range extends from prvious range into the
          // current range
          ranges[i - 1][1] = Math.max(newRange[1], range[1]);
          ranges.splice(i, 1);
          inRange = false;
          return ranges;
        }

        // Case 7: New range extends from previous range past the
        // end of the current range
        ranges.splice(i, 1);
        i--;
      }
    }

    if (inRange) {
      // Case 8: New range extends past the last existing range
      ranges[ranges.length - 1][1] = newRange[1];
    } else {
      // Case 9: New range starts after the last existing range
      ranges.push(newRange);
    }

    return ranges;
  }
}
