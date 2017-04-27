import { CircularList } from './CircularList';
import { RowData } from '../Types';

// Much faster than native filter
// https://jsperf.com/function-loops/4
function standardFilter(array, fn) {
  let results = [];
  let item;
  let i;
  let len;
  for (i = 0, len = array.length; i < len; i++) {
    item = array[i];
    if (fn(item)) results.push(item);
  }
  return results;
}

function fastForeach(array, fn) {
  let i = 0;
  let len = array.length;
  for (i; i < len; i++) {
    fn(array[i]);
  }
}

function trimmedLength(line, min) {
  let i = line.length - 1;
  for (i; i >= 0; i--) {
    if (line[i] && line[i][1] !== null) {
      break;
    }
  }

  if (i >= min) {
    i++;
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

function notNull(value) {
  return value !== null;
}

export class WrappableList extends CircularList<RowData> {
  private _wrappedLineIncrement: number[] = [];
  public wrappedLines: number[] = [];

  constructor(maxLength: number) {
    super(maxLength);
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

  /**
   * Reflow lines to a new max width.
   * A record of which lines are wrapped is stored in `wrappedLines` and is used to join and split
   * lines correctly.
   */
  public reflow(width: number): void {
    this._adjustWrappedLines();
    const wrappedLines = this.wrappedLines;

    const temp = [];
    const tempWrapped = [];
    const skip = [];

    const previouslyWrapped = (i) => wrappedLines.indexOf(i) > -1;

    const concatWrapped = (line, index) => {
      line = standardFilter(line, notNull).concat(this.get(index + 1));
      skip.push(index + 1);
      if (previouslyWrapped(index + 1)) {
        return concatWrapped(line, index + 1);
      } else {
        return line;
      }
    };

    this.forEach((line, index) => {
      if (!line) {
        return;
      }
      if (skip.indexOf(index) > -1) {
        return;
      }

      if (previouslyWrapped(index)) {
        line = concatWrapped(line, index);
      }

      const trim = trimmedLength(line, width);
      if (trim > width) {
        chunkArray(width, line.slice(0, trim)).forEach((line, i, chunks) => {
          temp.push(line);
          if (i < chunks.length - 1) {
            tempWrapped.push(temp.length - 1);
          }
        });
      } else {
        temp.push(line.slice(0, width));
      }
    });

    // Reset the list internals using the reflowed lines
    const scrollback = temp.length > this.maxLength ? temp.length : this.maxLength;
    this._length = temp.length;
    this._array = temp;
    this._array.length = scrollback;
    this.wrappedLines = tempWrapped;
    this._startIndex = 0;
  }
}
