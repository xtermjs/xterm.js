/**
 * @license MIT
 */

type Char = [number, string, number];
type Line = Char[];  // Array of characters in tuple format

export class Lines {
  private data: Line[];  // Array of lines

  constructor(data: Line[] = []) {
    this.data = data;
  }

  get length() {
    return this.data.length;
  }

  get(index: number) {
    return this.data[index];
  }

  set(index: number, value: Line) {
    return this.data[index] = value;
  }

  pop() {
    return this.data.pop();
  }

  push(line: Line) {
    return this.data.push(line);
  }

  slice(begin: number, end?: number) {
    return this.data.slice(begin, end);
  }

  splice(start: number, deleteCount: number, ...items: Line[]) {
    return this.data.splice.apply(this.data, [start, deleteCount, ...items]);
  }
}
