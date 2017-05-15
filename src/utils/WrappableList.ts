import { CircularList } from './CircularList';
import { RowData } from '../Types';

import { IWrappableList } from '../Interfaces';

function fastForeach(array, fn) {
  let i = 0;
  let len = array.length;
  for (i; i < len; i++) {
    fn(array[i], i, array);
  }
}

function trimmedLength(line) {
  let i = 0;
  let len = line.length;
  for (i; i < len; i++) {
    if (!line[i] || (line[i] && line[i][1] === null)) {
      break;
    }
  }

  return i;
}

function chunkArray(chunkSize, array) {
  let temparray = [];
  let i = 0;
  let j = array.length;
  for (i; i < j; i += chunkSize) {
    temparray.push(array.slice(i, i + chunkSize));
  }

  return temparray;
}

function fastCeil(n: number): number {
  let f = (n << 0);
  return f === n ? f : f + 1;
}

export class WrappableList extends CircularList<RowData> {
  private _wrappedLineIncrement: number[] = [];
  private _blankline: RowData;
  public wrappedLines: number[] = [];

  constructor(maxLength: number, private _terminal) {
    super(maxLength);

    this._blankline = this._terminal.blankLine();
  }

  public push(value: RowData): void {
    // Need to make sure wrappedlines move when CircularList wraps around, but without increasing
    // the time complexity of `push`. We push the number of `wrappedLines` that should be
    // incremented so that it can be calculated later.
    if (this._length + 1 === this.maxLength) {
      this._wrappedLineIncrement.push(this.wrappedLines.length);
    }
    super.push(value);
  }

  public addWrappedLine(row: number): void {
    this.wrappedLines.push(row);
  }

  // Adjusts `wrappedLines` using `_wrappedLineIncrement`
  private _adjustWrappedLines(): void {
    fastForeach(this._wrappedLineIncrement, (end) => {
      let i = 0;
      for (i; i < end; i++) {
        this.wrappedLines[i] -= 1;
      }
    });
    this._wrappedLineIncrement = [];
  }

  private _numArrayToObject(array: number[]) {
    let i = 0;
    let len = array.length;
    let returnObject = {};
    for (i; i < len; i++) {
      returnObject[array[i]] = null;
    }
    return returnObject;
  }

  /**
   * Reflow lines to a new max width.
   * A record of which lines are wrapped is stored in `wrappedLines` and is used to join and split
   * lines correctly.
   */
  public reflow(width: number, oldWidth: number) {
    const temp = [];
    const tempWrapped = [];
    const wrappedLines = this.wrappedLines;
    let masterIndex = 0;
    let len = this.length;
    let line;
    let trim;
    let isWidthDecreasing = width < oldWidth;
    let i = 0;
    let xj;

    this._adjustWrappedLines();
    // Using in index accessor is much quicker when we need to calculate previouslyWrapped many times
    const wrappedLinesObject = this._numArrayToObject(this.wrappedLines);

    const concatWrapped = (data, index) => {
      let next = index;
      while (wrappedLinesObject[next] !== undefined) {
        next++;
        masterIndex++;
        Array.prototype.push.apply(data, this.get(next));
      }
      return data;
    };

    // A for loop is used here so that masterIndex can be advanced when concatting lines in
    // the 'concatWrapped' method
    for (masterIndex; masterIndex < len; masterIndex++) {
      line = concatWrapped(this.get(masterIndex), masterIndex);
      trim = trimmedLength(line);

      if (trim > width) {
        line.length = trim;
        xj = fastCeil(trim / width) - 1;
        for (i = 0; i < trim; i += width) {
          if (width > line.length) {
            temp.push(line);
          } else {
            temp.push(line.splice(0, width));
          }

          if (xj-- > 0) {
            tempWrapped.push(temp.length - 1);
          }
        }
      } else {
        if (isWidthDecreasing) {
          line.length = width;
        }
        temp.push(line);
      }
    }

    // Chop the reflow list to length and push it into a new CircularList, also compensate wrapped
    // lines for new start point of list
    const scrollback = this.maxLength;
    let pushStart = temp.length > scrollback ?
      temp.length - scrollback :
      0;
    if (pushStart > 0) {
      for (i = 0; i < tempWrapped.length; i++) {
        tempWrapped[i] -= pushStart;
      }
    }
    let newList = new WrappableList(scrollback, this._terminal);
    for (i = pushStart; i < temp.length; i++) {
      newList.push(temp[i]);
    }
    newList.wrappedLines = tempWrapped;

    return newList;
  }
}
