import { CircularList } from './CircularList';
import { RowData } from '../Types';

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
  public reflow(width: number, oldWidth: number): void {
    const temp = [];
    const tempWrapped = [];
    const wrappedLines = this.wrappedLines;
    let masterIndex = 0;
    let len = this.length;
    let line;
    let trim;
    let isWidthDecreasing = width < oldWidth;

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
        fastForeach(chunkArray(width, line), (chunk, i, chunks) => {
          temp.push(chunk);
          if (i < chunks.length - 1) {
            tempWrapped.push(temp.length - 1);
          }
        });
      } else {
        if (isWidthDecreasing) {
          line.length = width;
        }
        temp.push(line);
      }
    }

    // Reset the list internals using the reflowed lines
    const scrollback = temp.length > this.maxLength ? temp.length : this.maxLength;
    this._length = temp.length;
    this._array = temp;
    this._array.length = scrollback;
    this.wrappedLines = tempWrapped;
    this._startIndex = 0;
  }
}
