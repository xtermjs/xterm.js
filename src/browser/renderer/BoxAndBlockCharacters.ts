export const boxDrawingLineSegments: { [index: string]: any } = {
  '─': [{ x1: 0, y1: 3, x2: 6, y2: 3 }],
  '━': [{ x1: 0, y1: 2, x2: 6, y2: 2 }, { x1: 0, y1: 4, x2: 6, y2: 4 }],
  '│': [{ x1: 3, y1: 0, x2: 3, y2: 6 }],
  '┃': [{ x1: 2, y1: 0, x2: 2, y2: 6 }, { x1: 4, y1: 0, x2: 4, y2: 6 }],
  '┌': [{ x1: 6, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 6 }],
  '┍': [{ x1: 6, y1: 2, x2: 3, y2: 2 }, { x1: 3, y1: 2, x2: 3, y2: 6 }, { x1: 6, y1: 4, x2: 3, y2: 4 }],
  '┎': [{ x1: 6, y1: 3, x2: 2, y2: 3 }, { x1: 2, y1: 3, x2: 2, y2: 6 }, { x1: 4, y1: 3, x2: 4, y2: 6 }],
  '┏': [{ x1: 6, y1: 2, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 2, y2: 6 }, { x1: 6, y1: 4, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 4, y2: 6 }],
  '┐': [{ x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 6 }],
  '┑': [{ x1: 0, y1: 2, x2: 3, y2: 2 }, { x1: 3, y1: 2, x2: 3, y2: 6 }, { x1: 0, y1: 4, x2: 3, y2: 4 }],
  '┒': [{ x1: 0, y1: 3, x2: 4, y2: 3 }, { x1: 4, y1: 3, x2: 4, y2: 6 }, { x1: 2, y1: 3, x2: 2, y2: 6 }],
  '┓': [{ x1: 0, y1: 2, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 4, y2: 6 }, { x1: 0, y1: 4, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 2, y2: 6 }],
  '└': [{ x1: 3, y1: 0, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 6, y2: 3 }],
  '┕': [{ x1: 3, y1: 0, x2: 3, y2: 4 }, { x1: 3, y1: 4, x2: 6, y2: 4 }, { x1: 3, y1: 2, x2: 6, y2: 2 }],
  '┖': [{ x1: 2, y1: 0, x2: 2, y2: 3 }, { x1: 2, y1: 3, x2: 6, y2: 3 }, { x1: 4, y1: 0, x2: 4, y2: 3 }],
  '┗': [{ x1: 2, y1: 0, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 6, y2: 4 }, { x1: 4, y1: 0, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 6, y2: 2 }],
  '┘': [{ x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 0 }],
  '┙': [{ x1: 0, y1: 4, x2: 3, y2: 4 }, { x1: 3, y1: 4, x2: 3, y2: 0 }, { x1: 0, y1: 2, x2: 3, y2: 2 }],
  '┚': [{ x1: 0, y1: 3, x2: 4, y2: 3 }, { x1: 4, y1: 3, x2: 4, y2: 0 }, { x1: 2, y1: 3, x2: 2, y2: 0 }],
  '┛': [{ x1: 0, y1: 4, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 4, y2: 0 }, { x1: 0, y1: 2, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 2, y2: 0 }],
  '├': [{ x1: 3, y1: 0, x2: 3, y2: 6 }, { x1: 3, y1: 3, x2: 6, y2: 3 }],
  '┝': [{ x1: 3, y1: 0, x2: 3, y2: 6 }, { x1: 3, y1: 2, x2: 6, y2: 2 }, { x1: 3, y1: 4, x2: 6, y2: 4 }],
  '┞': [{ x1: 2, y1: 0, x2: 2, y2: 3 }, { x1: 4, y1: 0, x2: 4, y2: 3 }, { x1: 4, y1: 3, x2: 6, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 6 }],
  '┟': [{ x1: 3, y1: 0, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 6, y2: 3 }, { x1: 2, y1: 3, x2: 2, y2: 6 }, { x1: 4, y1: 3, x2: 4, y2: 6 }],
  '┠': [{ x1: 2, y1: 0, x2: 2, y2: 6 }, { x1: 4, y1: 0, x2: 4, y2: 6 }, { x1: 4, y1: 3, x2: 6, y2: 3 }],
  '┡': [{ x1: 2, y1: 0, x2: 2, y2: 3 }, { x1: 2, y1: 3, x2: 6, y2: 3 }, { x1: 4, y1: 0, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 6, y2: 2 }, { x1: 3, y1: 3, x2: 3, y2: 6 }],
  '┢': [{ x1: 3, y1: 0, x2: 3, y2: 3 }, { x1: 2, y1: 6, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 6, y2: 2 }, { x1: 4, y1: 6, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 6, y2: 4 }],
  '┣': [{ x1: 2, y1: 0, x2: 2, y2: 6 }, { x1: 4, y1: 0, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 6, y2: 2 }, { x1: 6, y1: 4, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 4, y2: 6 }],
  '┤': [{ x1: 3, y1: 0, x2: 3, y2: 6 }, { x1: 0, y1: 3, x2: 3, y2: 3 }],
  '┥': [{ x1: 3, y1: 0, x2: 3, y2: 6 }, { x1: 0, y1: 2, x2: 3, y2: 2 }, { x1: 0, y1: 4, x2: 3, y2: 4 }],
  '┦': [{ x1: 2, y1: 0, x2: 2, y2: 3 }, { x1: 4, y1: 0, x2: 4, y2: 3 }, { x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 6 }],
  '┧': [{ x1: 3, y1: 0, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 0, y2: 3 }, { x1: 2, y1: 3, x2: 2, y2: 6 }, { x1: 4, y1: 3, x2: 4, y2: 6 }],
  '┨': [{ x1: 0, y1: 3, x2: 2, y2: 3 }, { x1: 2, y1: 0, x2: 2, y2: 6 }, { x1: 4, y1: 0, x2: 4, y2: 6 }],
  '┩': [{ x1: 2, y1: 0, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 0, y2: 2 }, { x1: 4, y1: 0, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 0, y2: 4 }, { x1: 3, y1: 3, x2: 3, y2: 6 }],
  '┪': [{ x1: 0, y1: 2, x2: 3, y2: 2 }, { x1: 3, y1: 2, x2: 3, y2: 6 }, { x1: 0, y1: 4, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 2, y2: 6 }, { x1: 3, y1: 0, x2: 3, y2: 3 }],
  '┫': [{ x1: 0, y1: 2, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 2, y2: 0 }, { x1: 0, y1: 4, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 2, y2: 6 }, { x1: 4, y1: 0, x2: 4, y2: 6 }],
  '┬': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 6 }],
  '┭': [{ x1: 0, y1: 2, x2: 3, y2: 2 }, { x1: 0, y1: 4, x2: 3, y2: 4 }, { x1: 3, y1: 6, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 6, y2: 3 }],
  '┮': [{ x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 6 }, { x1: 3, y1: 2, x2: 6, y2: 2 }, { x1: 3, y1: 4, x2: 6, y2: 4 }],
  '┯': [{ x1: 0, y1: 2, x2: 6, y2: 2 }, { x1: 0, y1: 4, x2: 6, y2: 4 }, { x1: 3, y1: 4, x2: 3, y2: 6 }],
  '┰': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 2, y1: 3, x2: 2, y2: 6 }, { x1: 4, y1: 3, x2: 4, y2: 6 }],
  '┱': [{ x1: 0, y1: 2, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 4, y2: 6 }, { x1: 0, y1: 4, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 2, y2: 6 }, { x1: 3, y1: 3, x2: 6, y2: 3 }],
  '┲': [{ x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 2, y1: 6, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 6, y2: 2 }, { x1: 4, y1: 6, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 6, y2: 4 }],
  '┳': [{ x1: 0, y1: 2, x2: 6, y2: 2 }, { x1: 0, y1: 4, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 2, y2: 6 }, { x1: 4, y1: 6, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 6, y2: 4 }],
  '┴': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 3, y1: 0, x2: 3, y2: 3 }],
  '┵': [{ x1: 3, y1: 0, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 6, y2: 3 }, { x1: 0, y1: 2, x2: 3, y2: 2 }, { x1: 0, y1: 4, x2: 3, y2: 4 }],
  '┶': [{ x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 0 }, { x1: 3, y1: 2, x2: 6, y2: 2 }, { x1: 3, y1: 4, x2: 6, y2: 4 }],
  '┷': [{ x1: 0, y1: 2, x2: 6, y2: 2 }, { x1: 0, y1: 4, x2: 6, y2: 4 }, { x1: 3, y1: 0, x2: 3, y2: 3 }],
  '┸': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 2, y1: 0, x2: 2, y2: 3 }, { x1: 4, y1: 0, x2: 4, y2: 3 }],
  '┹': [{ x1: 0, y1: 2, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 2, y2: 0 }, { x1: 0, y1: 4, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 4, y2: 0 }, { x1: 3, y1: 3, x2: 6, y2: 3 }],
  '┺': [{ x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 2, y1: 0, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 6, y2: 4 }, { x1: 3, y1: 0, x2: 3, y2: 2 }, { x1: 3, y1: 2, x2: 6, y2: 2 }],
  '┻': [{ x1: 0, y1: 4, x2: 6, y2: 4 }, { x1: 0, y1: 2, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 2, y2: 0 }, { x1: 4, y1: 0, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 6, y2: 2 }],
  '┼': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 3, y1: 0, x2: 3, y2: 6 }],
  '┽': [{ x1: 3, y1: 0, x2: 3, y2: 6 }, { x1: 3, y1: 3, x2: 6, y2: 3 }, { x1: 0, y1: 2, x2: 3, y2: 2 }, { x1: 0, y1: 4, x2: 3, y2: 4 }],
  '┾': [{ x1: 3, y1: 0, x2: 3, y2: 6 }, { x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 2, x2: 6, y2: 2 }, { x1: 3, y1: 4, x2: 6, y2: 4 }],
  '┿': [{ x1: 3, y1: 0, x2: 3, y2: 6 }, { x1: 0, y1: 2, x2: 6, y2: 2 }, { x1: 0, y1: 4, x2: 6, y2: 4 }],
  '╀': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 6 }, { x1: 2, y1: 0, x2: 2, y2: 3 }, { x1: 4, y1: 0, x2: 4, y2: 3 }],
  '╁': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 3, y1: 0, x2: 3, y2: 3 }, { x1: 2, y1: 3, x2: 2, y2: 6 }, { x1: 4, y1: 3, x2: 4, y2: 6 }],
  '╂': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 2, y1: 0, x2: 2, y2: 6 }, { x1: 4, y1: 0, x2: 4, y2: 6 }],
  '╃': [{ x1: 0, y1: 2, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 2, y2: 0 }, { x1: 0, y1: 4, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 4, y2: 0 }, { x1: 3, y1: 6, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 6, y2: 3 }],
  '╄': [{ x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 6 }, { x1: 2, y1: 0, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 6, y2: 4 }, { x1: 4, y1: 0, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 6, y2: 2 }],
  '╅': [{ x1: 3, y1: 0, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 6, y2: 3 }, { x1: 0, y1: 2, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 4, y2: 6 }, { x1: 0, y1: 4, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 2, y2: 6 }],
  '╆': [{ x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 0 }, { x1: 2, y1: 6, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 6, y2: 2 }, { x1: 4, y1: 6, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 6, y2: 4 }],
  '╇': [{ x1: 0, y1: 4, x2: 6, y2: 4 }, { x1: 0, y1: 2, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 2, y2: 0 }, { x1: 4, y1: 0, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 6, y2: 2 }, { x1: 3, y1: 3, x2: 3, y2: 6 }],
  '╈': [{ x1: 3, y1: 0, x2: 3, y2: 3 }, { x1: 0, y1: 2, x2: 6, y2: 2 }, { x1: 0, y1: 4, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 2, y2: 6 }, { x1: 4, y1: 6, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 6, y2: 4 }],
  '╉': [{ x1: 0, y1: 2, x2: 2, y2: 2 }, { x1: 2, y1: 2, x2: 2, y2: 0 }, { x1: 0, y1: 4, x2: 2, y2: 4 }, { x1: 2, y1: 4, x2: 2, y2: 6 }, { x1: 4, y1: 0, x2: 4, y2: 6 }, { x1: 3, y1: 3, x2: 6, y2: 3 }],
  '╊': [{ x1: 0, y1: 3, x2: 2, y2: 3 }, { x1: 2, y1: 0, x2: 2, y2: 6 }, { x1: 4, y1: 0, x2: 4, y2: 2 }, { x1: 4, y1: 2, x2: 6, y2: 2 }, { x1: 4, y1: 6, x2: 4, y2: 4 }, { x1: 4, y1: 4, x2: 6, y2: 4 }],
  '╋': [{ x1: 0, y1: 2, x2: 6, y2: 2 }, { x1: 0, y1: 4, x2: 6, y2: 4 }, { x1: 2, y1: 0, x2: 2, y2: 6 }, { x1: 4, y1: 0, x2: 4, y2: 6 }],
  '╌': [{ x1: 0, y1: 3, x2: 2, y2: 3 }, { x1: 4, y1: 3, x2: 6, y2: 3 }],
  '╍': [{ x1: 0, y1: 2, x2: 2, y2: 2 }, { x1: 0, y1: 4, x2: 2, y2: 4 }, { x1: 4, y1: 2, x2: 6, y2: 2 }, { x1: 4, y1: 4, x2: 6, y2: 4 }],
  '╎': [{ x1: 3, y1: 0, x2: 3, y2: 2 }, { x1: 3, y1: 4, x2: 3, y2: 6 }],
  '╏': [{ x1: 2, y1: 0, x2: 2, y2: 2 }, { x1: 4, y1: 0, x2: 4, y2: 2 }, { x1: 2, y1: 3, x2: 2, y2: 6 }, { x1: 4, y1: 3, x2: 4, y2: 6 }],
  '═': [{ x1: 0, y1: 1, x2: 6, y2: 1 }, { x1: 0, y1: 5, x2: 6, y2: 5 }],
  '║': [{ x1: 1, y1: 0, x2: 1, y2: 6 }, { x1: 5, y1: 0, x2: 5, y2: 6 }],
  '╒': [{ x1: 6, y1: 1, x2: 3, y2: 1 }, { x1: 3, y1: 1, x2: 3, y2: 6 }, { x1: 6, y1: 5, x2: 3, y2: 5 }],
  '╓': [{ x1: 6, y1: 3, x2: 1, y2: 3 }, { x1: 1, y1: 3, x2: 1, y2: 6 }, { x1: 5, y1: 3, x2: 5, y2: 6 }],
  '╔': [{ x1: 6, y1: 1, x2: 1, y2: 1 }, { x1: 1, y1: 1, x2: 1, y2: 6 }, { x1: 6, y1: 5, x2: 5, y2: 5 }, { x1: 5, y1: 5, x2: 5, y2: 6 }],
  '╕': [{ x1: 0, y1: 1, x2: 3, y2: 1 }, { x1: 3, y1: 1, x2: 3, y2: 6 }, { x1: 0, y1: 5, x2: 3, y2: 5 }],
  '╖': [{ x1: 0, y1: 3, x2: 5, y2: 3 }, { x1: 5, y1: 3, x2: 5, y2: 6 }, { x1: 1, y1: 3, x2: 1, y2: 6 }],
  '╗': [{ x1: 0, y1: 1, x2: 5, y2: 1 }, { x1: 5, y1: 1, x2: 5, y2: 6 }, { x1: 0, y1: 5, x2: 1, y2: 5 }, { x1: 1, y1: 5, x2: 1, y2: 6 }],
  '╘': [{ x1: 3, y1: 0, x2: 3, y2: 5 }, { x1: 3, y1: 5, x2: 6, y2: 5 }, { x1: 3, y1: 1, x2: 6, y2: 1 }],
  '╙': [{ x1: 1, y1: 0, x2: 1, y2: 3 }, { x1: 1, y1: 3, x2: 6, y2: 3 }, { x1: 5, y1: 0, x2: 5, y2: 3 }],
  '╚': [{ x1: 1, y1: 0, x2: 1, y2: 5 }, { x1: 1, y1: 5, x2: 6, y2: 5 }, { x1: 5, y1: 0, x2: 5, y2: 1 }, { x1: 5, y1: 1, x2: 6, y2: 1 }],
  '╛': [{ x1: 0, y1: 1, x2: 3, y2: 1 }, { x1: 0, y1: 5, x2: 3, y2: 5 }, { x1: 3, y1: 5, x2: 3, y2: 0 }],
  '╜': [{ x1: 0, y1: 3, x2: 5, y2: 3 }, { x1: 5, y1: 3, x2: 5, y2: 0 }, { x1: 1, y1: 3, x2: 1, y2: 0 }],
  '╝': [{ x1: 0, y1: 1, x2: 1, y2: 1 }, { x1: 1, y1: 1, x2: 1, y2: 0 }, { x1: 0, y1: 5, x2: 5, y2: 5 }, { x1: 5, y1: 5, x2: 5, y2: 0 }],
  '╞': [{ x1: 3, y1: 0, x2: 3, y2: 6 }, { x1: 3, y1: 1, x2: 6, y2: 1 }, { x1: 3, y1: 5, x2: 6, y2: 5 }],
  '╟': [{ x1: 1, y1: 0, x2: 1, y2: 6 }, { x1: 5, y1: 0, x2: 5, y2: 6 }, { x1: 5, y1: 3, x2: 6, y2: 3 }],
  '╠': [{ x1: 1, y1: 0, x2: 1, y2: 6 }, { x1: 5, y1: 0, x2: 5, y2: 1 }, { x1: 5, y1: 1, x2: 6, y2: 1 }, { x1: 5, y1: 6, x2: 5, y2: 5 }, { x1: 5, y1: 5, x2: 6, y2: 5 }],
  '╡': [{ x1: 3, y1: 0, x2: 3, y2: 6 }, { x1: 0, y1: 1, x2: 3, y2: 1 }, { x1: 0, y1: 5, x2: 3, y2: 5 }],
  '╢': [{ x1: 0, y1: 3, x2: 1, y2: 3 }, { x1: 1, y1: 0, x2: 1, y2: 6 }, { x1: 5, y1: 0, x2: 5, y2: 6 }],
  '╣': [{ x1: 0, y1: 1, x2: 1, y2: 1 }, { x1: 1, y1: 1, x2: 1, y2: 0 }, { x1: 0, y1: 5, x2: 1, y2: 5 }, { x1: 1, y1: 5, x2: 1, y2: 6 }, { x1: 5, y1: 0, x2: 5, y2: 6 }],
  '╤': [{ x1: 0, y1: 1, x2: 6, y2: 1 }, { x1: 0, y1: 5, x2: 6, y2: 5 }, { x1: 3, y1: 5, x2: 3, y2: 6 }],
  '╥': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 1, y1: 3, x2: 1, y2: 6 }, { x1: 5, y1: 3, x2: 5, y2: 6 }],
  '╦': [{ x1: 0, y1: 1, x2: 6, y2: 1 }, { x1: 0, y1: 5, x2: 1, y2: 5 }, { x1: 1, y1: 5, x2: 1, y2: 6 }, { x1: 5, y1: 6, x2: 5, y2: 5 }, { x1: 5, y1: 5, x2: 6, y2: 5 }],
  '╧': [{ x1: 0, y1: 5, x2: 6, y2: 5 }, { x1: 0, y1: 1, x2: 6, y2: 1 }, { x1: 3, y1: 0, x2: 3, y2: 1 }],
  '╨': [{ x1: 0, y1: 3, x2: 6, y2: 3 }, { x1: 1, y1: 0, x2: 1, y2: 3 }, { x1: 5, y1: 0, x2: 5, y2: 3 }],
  '╩': [{ x1: 0, y1: 1, x2: 1, y2: 1 }, { x1: 1, y1: 1, x2: 1, y2: 0 }, { x1: 5, y1: 0, x2: 5, y2: 1 }, { x1: 5, y1: 1, x2: 6, y2: 1 }, { x1: 0, y1: 5, x2: 6, y2: 5 }],
  '╪': [{ x1: 0, y1: 1, x2: 6, y2: 1 }, { x1: 0, y1: 5, x2: 6, y2: 5 }, { x1: 3, y1: 0, x2: 3, y2: 6 }],
  '╫': [{ x1: 1, y1: 0, x2: 1, y2: 6 }, { x1: 5, y1: 0, x2: 5, y2: 6 }, { x1: 0, y1: 3, x2: 6, y2: 3 }],
  '╬': [{ x1: 0, y1: 1, x2: 1, y2: 1 }, { x1: 1, y1: 1, x2: 1, y2: 0 }, { x1: 5, y1: 0, x2: 5, y2: 1 }, { x1: 5, y1: 1, x2: 6, y2: 1 }, { x1: 6, y1: 5, x2: 5, y2: 5 }, { x1: 5, y1: 5, x2: 5, y2: 6 }, { x1: 1, y1: 6, x2: 1, y2: 5 }, { x1: 1, y1: 5, x2: 0, y2: 5 }],
  '╭': [{ x1: 6, y1: 3, x2: 3, y2: 6, cx1: 3, cy1: 3, cx2: 3, cy2: 3 }],
  '╮': [{ x1: 0, y1: 3, x2: 3, y2: 6, cx1: 3, cy1: 3, cx2: 3, cy2: 3 }],
  '╯': [{ x1: 0, y1: 3, x2: 3, y2: 0, cx1: 3, cy1: 3, cx2: 3, cy2: 3 }],
  '╰': [{ x1: 3, y1: 0, x2: 6, y2: 3, cx1: 3, cy1: 3, cx2: 3, cy2: 3 }],
  '╱': [{ x1: 0, y1: 6, x2: 6, y2: 0 }],
  '╲': [{ x1: 0, y1: 0, x2: 6, y2: 6 }],
  '╳': [{ x1: 0, y1: 6, x2: 6, y2: 0 }, { x1: 0, y1: 0, x2: 6, y2: 6 }],
  '╴': [{ x1: 0, y1: 3, x2: 3, y2: 3 }],
  '╵': [{ x1: 3, y1: 0, x2: 3, y2: 3 }],
  '╶': [{ x1: 3, y1: 3, x2: 6, y2: 3 }],
  '╷': [{ x1: 3, y1: 3, x2: 3, y2: 6 }],
  '╸': [{ x1: 0, y1: 2, x2: 3, y2: 2 }, { x1: 0, y1: 4, x2: 3, y2: 4 }],
  '╹': [{ x1: 2, y1: 0, x2: 2, y2: 3 }, { x1: 4, y1: 0, x2: 4, y2: 3 }],
  '╺': [{ x1: 3, y1: 2, x2: 6, y2: 2 }, { x1: 3, y1: 4, x2: 6, y2: 4 }],
  '╻': [{ x1: 2, y1: 3, x2: 2, y2: 6 }, { x1: 4, y1: 3, x2: 4, y2: 6 }],
  '╼': [{ x1: 0, y1: 3, x2: 3, y2: 3 }, { x1: 3, y1: 2, x2: 6, y2: 2 }, { x1: 3, y1: 4, x2: 6, y2: 4 }],
  '╽': [{ x1: 3, y1: 0, x2: 3, y2: 3 }, { x1: 2, y1: 3, x2: 2, y2: 6 }, { x1: 4, y1: 3, x2: 4, y2: 6 }],
  '╾': [{ x1: 0, y1: 2, x2: 3, y2: 2 }, { x1: 0, y1: 4, x2: 3, y2: 4 }, { x1: 3, y1: 3, x2: 6, y2: 3 }],
  '╿': [{ x1: 2, y1: 0, x2: 2, y2: 3 }, { x1: 4, y1: 0, x2: 4, y2: 3 }, { x1: 3, y1: 3, x2: 3, y2: 6 }]
};

export const boxDrawingBoxes: { [index: string]: any } = {
  '▀': [{ x: 0, y: 0, w: 8, h: 4 }],
  '█': [{ x: 0, y: 0, w: 8, h: 8 }],
  '▇': [{ x: 0, y: 1, w: 8, h: 7 }],
  '▆': [{ x: 0, y: 2, w: 8, h: 6 }],
  '▅': [{ x: 0, y: 3, w: 8, h: 5 }],
  '▄': [{ x: 0, y: 4, w: 8, h: 4 }],
  '▃': [{ x: 0, y: 5, w: 8, h: 3 }],
  '▂': [{ x: 0, y: 6, w: 8, h: 2 }],
  '▁': [{ x: 0, y: 7, w: 8, h: 1 }],
  '▉': [{ x: 0, y: 0, w: 7, h: 8 }],
  '▊': [{ x: 0, y: 0, w: 6, h: 8 }],
  '▋': [{ x: 0, y: 0, w: 5, h: 8 }],
  '▌': [{ x: 0, y: 0, w: 4, h: 8 }],
  '▍': [{ x: 0, y: 0, w: 3, h: 8 }],
  '▎': [{ x: 0, y: 0, w: 2, h: 8 }],
  '▏': [{ x: 0, y: 0, w: 1, h: 8 }],

  // VERTICAL ONE EIGHTH BLOCK-2 through VERTICAL ONE EIGHTH BLOCK-7
  '\u{1FB70}': [{ x: 1, y: 0, w: 1, h: 8 }],
  '\u{1FB71}': [{ x: 2, y: 0, w: 1, h: 8 }],
  '\u{1FB72}': [{ x: 3, y: 0, w: 1, h: 8 }],
  '\u{1FB73}': [{ x: 4, y: 0, w: 1, h: 8 }],
  '\u{1FB74}': [{ x: 5, y: 0, w: 1, h: 8 }],
  '\u{1FB75}': [{ x: 6, y: 0, w: 1, h: 8 }],
  // RIGHT ONE EIGHTH BLOCK
  '▕': [{ x: 7, y: 0, w: 1, h: 8 }],

  // UPPER ONE EIGHTH BLOCK
  '▔': [{ x: 0, y: 0, w: 8, h: 1 }],
  // HORIZONTAL ONE EIGHTH BLOCK-2 through HORIZONTAL ONE EIGHTH BLOCK-7
  '\u{1FB76}': [{ x: 0, y: 1, w: 8, h: 1 }],
  '\u{1FB77}': [{ x: 0, y: 2, w: 8, h: 1 }],
  '\u{1FB78}': [{ x: 0, y: 3, w: 8, h: 1 }],
  '\u{1FB79}': [{ x: 0, y: 4, w: 8, h: 1 }],
  '\u{1FB7A}': [{ x: 0, y: 5, w: 8, h: 1 }],
  '\u{1FB7B}': [{ x: 0, y: 6, w: 8, h: 1 }],

  // LEFT AND LOWER ONE EIGHTH BLOCK
  '\u{1FB7C}': [{ x: 0, y: 0, w: 1, h: 8 }, { x: 0, y: 7, w: 8, h: 1 }],
  // LEFT AND UPPER ONE EIGHTH BLOCK
  '\u{1FB7D}': [{ x: 0, y: 0, w: 1, h: 8 }, { x: 0, y: 0, w: 8, h: 1 }],
  // RIGHT AND UPPER ONE EIGHTH BLOCK
  '\u{1FB7E}': [{ x: 7, y: 0, w: 1, h: 8 }, { x: 0, y: 0, w: 8, h: 1 }],
  // RIGHT AND LOWER ONE EIGHTH BLOCK
  '\u{1FB7F}': [{ x: 7, y: 0, w: 1, h: 8 }, { x: 0, y: 7, w: 8, h: 1 }],
  // UPPER AND LOWER ONE EIGHTH BLOCK
  '\u{1FB80}': [{ x: 0, y: 0, w: 8, h: 1 }, { x: 0, y: 7, w: 8, h: 1 }],
  // HORIZONTAL ONE EIGHTH BLOCK-1358
  '\u{1FB81}': [{ x: 0, y: 0, w: 8, h: 1 }, { x: 0, y: 2, w: 8, h: 1 }, { x: 0, y: 4, w: 8, h: 1 }, { x: 0, y: 7, w: 8, h: 1 }],

  // UPPER ONE QUARTER BLOCK
  '\u{1FB82}': [{ x: 0, y: 0, w: 8, h: 2 }],
  // UPPER THREE EIGHTHS BLOCK
  '\u{1FB83}': [{ x: 0, y: 0, w: 8, h: 3 }],
  // UPPER FIVE EIGHTHS BLOCK
  '\u{1FB84}': [{ x: 0, y: 0, w: 8, h: 5 }],
  // UPPER THREE QUARTERS BLOCK
  '\u{1FB85}': [{ x: 0, y: 0, w: 8, h: 6 }],
  // UPPER SEVEN EIGHTHS BLOCK
  '\u{1FB86}': [{ x: 0, y: 0, w: 8, h: 7 }],

  // RIGHT ONE QUARTER BLOCK
  '\u{1FB87}': [{ x: 6, y: 0, w: 2, h: 8 }],
  // RIGHT THREE EIGHTHS B0OCK
  '\u{1FB88}': [{ x: 5, y: 0, w: 3, h: 8 }],
  // RIGHT FIVE EIGHTHS BL0CK
  '\u{1FB89}': [{ x: 3, y: 0, w: 5, h: 8 }],
  // RIGHT THREE QUARTERS 0LOCK
  '\u{1FB8A}': [{ x: 2, y: 0, w: 6, h: 8 }],
  // RIGHT SEVEN EIGHTHS B0OCK
  '\u{1FB8B}': [{ x: 1, y: 0, w: 7, h: 8 }],

  // CHECKER BOARD FILL
  '\u{1FB95}': [
    { x: 0, y: 0, w: 2, h: 2 }, { x: 4, y: 0, w: 2, h: 2 },
    { x: 2, y: 2, w: 2, h: 2 }, { x: 6, y: 2, w: 2, h: 2 },
    { x: 0, y: 4, w: 2, h: 2 }, { x: 4, y: 4, w: 2, h: 2 },
    { x: 2, y: 6, w: 2, h: 2 }, { x: 6, y: 6, w: 2, h: 2 }
  ],
  // INVERSE CHECKER BOARD FILL
  '\u{1FB96}': [
    { x: 2, y: 0, w: 2, h: 2 }, { x: 6, y: 0, w: 2, h: 2 },
    { x: 0, y: 2, w: 2, h: 2 }, { x: 4, y: 2, w: 2, h: 2 },
    { x: 2, y: 4, w: 2, h: 2 }, { x: 6, y: 4, w: 2, h: 2 },
    { x: 0, y: 6, w: 2, h: 2 }, { x: 4, y: 6, w: 2, h: 2 }
  ],
  // HEAVY HORIZONTAL FILL (upper middle and lower one quarter block)
  '\u{1FB97}': [{ x: 0, y: 2, w: 8, h: 2 }, { x: 0, y: 6, w: 8, h: 2 }]
};

export const enum CENTER {
  BOTTOM ='.5,1',
  TOP = '.5,0',
  MIDDLE = '.5,.5'
}

export const enum LEFT {
  BOTTOM = '0,1',
  TOP = '0,0',
  MIDDLE = '0,.5'
}

export const enum RIGHT {
  BOTTOM = '1,1',
  TOP = '1,0',
  MIDDLE = '1,.5'
}

const MOVE = 'M';
const TO = 'L';
const THICK = '!';

const yAxis = `${MOVE}${CENTER.TOP} ${TO}${CENTER.BOTTOM}`;
const xAxis = `${MOVE}${LEFT.MIDDLE} ${TO}${RIGHT.MIDDLE}`;
const bottomYAxisFromBottom = `${MOVE}${CENTER.BOTTOM} ${TO}${CENTER.MIDDLE}`;
const bottomYAxisFromMiddle = `${MOVE}${CENTER.MIDDLE} ${TO}${CENTER.BOTTOM}`;
const topYAxisFromTop = `${MOVE}${CENTER.TOP} ${TO}${CENTER.MIDDLE}`;
const topYAxisFromMiddle = `${MOVE}${CENTER.TOP} ${TO}${CENTER.MIDDLE}`;
const rightMiddleXAxis = `${MOVE}${CENTER.MIDDLE} ${TO}${RIGHT.MIDDLE}`;
const leftMiddleXAxis = `${MOVE}${CENTER.MIDDLE} ${TO}${LEFT.MIDDLE}`;

export const chars: { [index: string]: string } = {
  '━': `${xAxis}`,
  '│': `${yAxis}`,
  '┃': `${yAxis}${THICK}`,
  '┌': `${bottomYAxisFromBottom} ${TO}${RIGHT.MIDDLE}`,
  '┍': `${bottomYAxisFromBottom} ${TO}${RIGHT.MIDDLE}${THICK}`,
  '┎': `${bottomYAxisFromBottom}${THICK} ${TO}${RIGHT.MIDDLE}`,
  '┏': `${bottomYAxisFromBottom}${THICK} ${TO}${RIGHT.MIDDLE}${THICK}`,
  '┐': `${bottomYAxisFromBottom} ${TO}${LEFT.MIDDLE}`,
  '┑': `${bottomYAxisFromBottom} ${TO}${LEFT.MIDDLE}${THICK}`,
  '┒': `${bottomYAxisFromBottom}${THICK} ${TO}${LEFT.MIDDLE}`,
  '┓': `${bottomYAxisFromBottom}${THICK} ${TO}${LEFT.MIDDLE}${THICK}`,
  '└': `${topYAxisFromTop} ${TO}${RIGHT.MIDDLE}`,
  '┕': `${topYAxisFromTop} ${TO}${RIGHT.MIDDLE}${THICK}`,
  '┖': `${topYAxisFromTop}${THICK} ${TO}${RIGHT.MIDDLE}`,
  '┗': `${topYAxisFromTop}${THICK} ${TO}${RIGHT.MIDDLE}${THICK}`,
  '┘': `${topYAxisFromTop} ${TO}${LEFT.MIDDLE}`,
  '┙': `${topYAxisFromTop} ${TO}${LEFT.MIDDLE}${THICK}`,
  '┚': `${topYAxisFromTop}${THICK} ${TO}${LEFT.MIDDLE}`,
  '┛': `${topYAxisFromTop}${THICK} ${TO}${LEFT.MIDDLE}${THICK}`,
  '├': `${yAxis} ${rightMiddleXAxis}`,
  '┝': `${yAxis} ${rightMiddleXAxis}${THICK}`,
  '┞': `${topYAxisFromTop}${THICK} ${bottomYAxisFromMiddle} ${rightMiddleXAxis}`,
  '┟': `${bottomYAxisFromBottom}${THICK} ${topYAxisFromMiddle} ${rightMiddleXAxis}${THICK}`,
  '┠': `${yAxis}${THICK} ${rightMiddleXAxis}`,
  '┡': `${bottomYAxisFromBottom} ${topYAxisFromMiddle}${THICK} ${rightMiddleXAxis}${THICK}`,
  '┢': `${bottomYAxisFromBottom}${THICK} ${topYAxisFromMiddle} ${rightMiddleXAxis}${THICK}`,
  '┣': `${yAxis}${THICK} ${rightMiddleXAxis}${THICK}`,
  '┤': `${yAxis} ${leftMiddleXAxis}`,
  '┥': `${yAxis} ${leftMiddleXAxis}${THICK}`,
  '┦': `${topYAxisFromTop}${THICK} ${bottomYAxisFromMiddle} ${leftMiddleXAxis}`,
  '┧': `${bottomYAxisFromBottom}${THICK} ${topYAxisFromMiddle} ${leftMiddleXAxis}${THICK}`,
  '┨': `${yAxis}${THICK} ${leftMiddleXAxis}`,
  '┩': `${bottomYAxisFromBottom} ${topYAxisFromMiddle}${THICK} ${leftMiddleXAxis}${THICK}`,
  '┪': `${bottomYAxisFromBottom}${THICK} ${topYAxisFromMiddle} ${leftMiddleXAxis}${THICK}`,
  '┫': `${yAxis}${THICK} ${leftMiddleXAxis}${THICK}`,
  '┬': `${bottomYAxisFromBottom} ${xAxis}`,
  '┭': `${bottomYAxisFromBottom} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}`,
  '┮': `${bottomYAxisFromBottom} ${leftMiddleXAxis} ${rightMiddleXAxis}${THICK}`,
  '┯': `${bottomYAxisFromBottom} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}${THICK}`,
  '┰': `${bottomYAxisFromBottom}${THICK} ${xAxis}`,
  '┱': `${bottomYAxisFromBottom}${THICK} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}`,
  '┲': `${bottomYAxisFromBottom} ${leftMiddleXAxis} ${rightMiddleXAxis}${THICK}`,
  '┳': `${bottomYAxisFromBottom}${THICK} ${xAxis}${THICK}`,
  '┴': `${topYAxisFromTop} ${xAxis}`,
  '┵': `${topYAxisFromTop} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}`,
  '┶': `${topYAxisFromTop} ${leftMiddleXAxis} ${rightMiddleXAxis}${THICK}`,
  '┷': `${topYAxisFromTop} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}${THICK}`,
  '┸': `${topYAxisFromTop}${THICK} ${xAxis}`,
  '┹': `${topYAxisFromTop}${THICK} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}`,
  '┺': `${topYAxisFromTop} ${leftMiddleXAxis} ${rightMiddleXAxis}${THICK}`,
  '┻': `${topYAxisFromTop}${THICK} ${xAxis}${THICK}`,
  '┼': `${yAxis} ${xAxis}`,
  '┽': `${yAxis} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}`,
  '┾': `${yAxis} ${leftMiddleXAxis} ${rightMiddleXAxis}${THICK}`,
  '┿': `${yAxis} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}${THICK}`,
  '╀': `${yAxis}${THICK} ${xAxis}`,
  '╁': `${yAxis}${THICK} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}`,
  '╂': `${yAxis} ${leftMiddleXAxis} ${rightMiddleXAxis}${THICK}`,
  '╃': `${yAxis}${THICK} ${xAxis}${THICK}`,
  '╄': `${yAxis} ${xAxis}`,
  '╅': `${yAxis} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}`,
  '╆': `${yAxis} ${leftMiddleXAxis} ${rightMiddleXAxis}${THICK}`,
  '╇': `${yAxis} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}${THICK}`,
  '╈': `${yAxis}${THICK} ${xAxis}`,
  '╉': `${yAxis}${THICK} ${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}`,
  '╊': `${yAxis} ${leftMiddleXAxis} ${rightMiddleXAxis}${THICK}`,
  '╋': `${yAxis}${THICK} ${xAxis}${THICK}`,
  '╌': `${MOVE}${LEFT.MIDDLE} ${TO}${'.47,.5'} ${MOVE}${'.53,.5'} ${TO}${RIGHT.MIDDLE}`,
  '╍': `${MOVE}${LEFT.MIDDLE} ${TO}${'.47,.5'}${THICK} ${MOVE}${'.53,.5'} ${TO}${RIGHT.MIDDLE}${THICK}`,
  '╎':`${MOVE}${CENTER.TOP} ${TO}${'.5,.47'} ${MOVE}${'.5,.53'} ${TO}${CENTER.BOTTOM}`,
  '╏':`${MOVE}${CENTER.TOP} ${TO}${'.5,.47'}${THICK} ${MOVE}${'.5,.53'} ${TO}${CENTER.BOTTOM}${THICK}`,
  // '═': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '║': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╒': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╓': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╔': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╕': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╖': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╗': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╘': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╙': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╚': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╛': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╜': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╝': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╞': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╟': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╠': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╡': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╢': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╣': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╤': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╥': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╦': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╧': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╨': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╩': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╪': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╫': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╬': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╭': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╮': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╯': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╰': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╱': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╲': `${MOVE}${} ${TO}${} ${TO}${}`,
  // '╳': `${MOVE}${} ${TO}${} ${TO}${}`,
  '╴': `${leftMiddleXAxis}`,
  '╵': `${topYAxisFromMiddle}`,
  '╶': `${rightMiddleXAxis}`,
  '╷': `${bottomYAxisFromMiddle}`,
  '╸': `${leftMiddleXAxis}${THICK}`,
  '╹': `${topYAxisFromMiddle}${THICK}`,
  '╺': `${rightMiddleXAxis}${THICK}`,
  '╻': `${bottomYAxisFromMiddle}${THICK}`,
  '╼': `${leftMiddleXAxis} ${rightMiddleXAxis}${THICK}`,
  '╽': `${bottomYAxisFromBottom}${THICK} ${topYAxisFromMiddle}`,
  '╾': `${leftMiddleXAxis}${THICK} ${rightMiddleXAxis}`,
  '╿': `${bottomYAxisFromBottom} ${topYAxisFromMiddle}${THICK}`
};

export function draw(ctx: CanvasRenderingContext2D, c: string, xOffset: number, yOffset: number, cellWidth: number, cellHeight: number): void {
  const entry = chars[c];
  if (!entry) {
    return;
  }
  const lineWidth = ctx.lineWidth;
  const instructions = entry.split(' ');

  for (const instruction of instructions) {
    const type = instruction[0];
    const spec = instructionMap[type];
    const coords: string[] = instruction.substring(1).split(',');
    if (!coords[0] || !coords[1]) {
      continue;
    }
    let numX = Number.parseFloat(coords[0].toString()) || Number.parseInt(coords[0].toString());
    let numY = Number.parseFloat(coords[1].toString()) || Number.parseInt(coords[1].toString());
    if (instruction.endsWith(THICK)) {
      ctx.lineWidth = window.devicePixelRatio * 2;
    } else {
      ctx.lineWidth = window.devicePixelRatio;
    }

    numX *= cellWidth;
    numY *= cellHeight;

    if (numY !== 0) {
      numY = clamp(Math.round(numY + .5) - .5, cellHeight, 0);
    }
    if (numX !== 0) {
      numX = clamp(Math.round(numX + .5) - .5, cellWidth, 0);
    }
    spec(ctx, xOffset + numX, yOffset + numY);
  }
}

function clamp(value: number, max: number, min: number = 0): number {
  return Math.max(Math.min(value, max), min);
}

const instructionMap: { [index: string]: any } = {
  'M': (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
  },
  'L': (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
};
