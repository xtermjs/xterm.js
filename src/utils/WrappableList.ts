import { CircularList } from './CircularList';

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

function trimmedLength(line, min) {
  let i = line.length - 1;
  for (i; i >= 0; i--) {
    if (line[i] && line[i][1] !== null) {
      break;
    }
  }

  if (i < min) {
   // i = min;
  } else {
    // 2 extra blank chars allows for cursor and ensures at least one element is in array (in case
    // of intentional blank rows)
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

export class WrappableList<T> extends CircularList<any[]> {
  public wrappedLines: number[] = [];

  constructor(maxLength: number) {
    super(maxLength);
  }

  // Need to make sure wrappedlines move when CircularList wraps around
  public push(value: any[]): void {
    if (this._length + 1 === this.maxLength) {
      this.wrappedLines = this.wrappedLines.map(x => x - 1);
    }
    this._array[this._getCyclicIndex(this._length)] = value;
    if (this._length === this.maxLength) {
      this._startIndex++;
      if (this._startIndex === this.maxLength) {
        this._startIndex = 0;
      }
    } else {
      this._length++;
    }
  }

  public transform(width) {
    let wrappedLines = this.wrappedLines;

    let temp = [];
    let tempWrapped = [];
    let skip = [];

    const previouslyWrapped = (i) => wrappedLines.indexOf(i) > -1;

    const concatWrapped = (line, index) => {
      line = standardFilter(line, notNull).concat(this._array[index + 1]);
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

    let cachedStartIndex = this._startIndex;
    const scrollback = temp.length > this.maxLength ? temp.length : this.maxLength;
    this.maxLength = scrollback;
    this._length = temp.length;
    this._array = temp;
    this._array.length = scrollback;
    this.wrappedLines = tempWrapped;
    this._startIndex = 0;
  }
}
