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

const topXLine = `${MOVE}${'0,.45'} ${TO}${'1,.45'}`;
const bottomXLine = `${MOVE}${'0,.55'} ${TO}${'1,.55'}`;
const leftYLine = `${MOVE}${'.35,0'} ${TO}${'.35,1'}`;
const rightYLine = `${MOVE}${'.65,0'} ${TO}${'.65,1'}`;

const leftTopXLine = `${MOVE}${'0,.45'} ${TO}${'.5,.45'}`;
const rightTopXLine = `${MOVE}${'.5,.45'} ${TO}${'1,.45'}`;

const leftBottomXLine = `${MOVE}${'0,.55'} ${TO}${'.5,.55'}`;
const rightBottomXLine = `${MOVE}${'.5,.55'} ${TO}${'1,.55'}`;

const bottomLeftYLine = `${MOVE}${'.35,.5'} ${TO}${'.35,1'}`;
const topLeftYLine = `${MOVE}${'.35,0'} ${TO}${'.35,.5'}`;

const bottomRightYLine = `${MOVE}${'.65,.5'} ${TO}${'.65,1'}`;
const topRightYLine = `${MOVE}${'.65,0'} ${TO}${'.65,.5'}`;


const map: { [character: string]: { [fontWeight: number]: string } } = {
  '━': {
    1: `${xAxis}`
  },
  '│': {
    1: `${yAxis}`
  },
  '┃': {
    2: `${yAxis}`
  },
  '┌': {
    1: `${bottomYAxisFromBottom} ${TO}${RIGHT.MIDDLE}`
  },
  '┍': {
    1: `${bottomYAxisFromBottom}`,
    2: `${rightMiddleXAxis}`
  },
  '┎': {
    1: `${rightMiddleXAxis}`,
    2: `${bottomYAxisFromBottom}`
  },
  '┏': {
    2: `${bottomYAxisFromBottom} ${TO}${RIGHT.MIDDLE}`
  },
  '┐': {
    1: `${bottomYAxisFromBottom} ${TO}${LEFT.MIDDLE}`
  },
  '┑': {
    1: `${bottomYAxisFromBottom}`,
    2: `${leftMiddleXAxis}`
  },
  '┒': {
    1: `${leftMiddleXAxis}`,
    2: `${bottomYAxisFromBottom}`
  },
  '┓': {
    2: `${bottomYAxisFromBottom} ${TO}${LEFT.MIDDLE}`
  },
  '└': {
    1: `${topYAxisFromTop} ${TO}${RIGHT.MIDDLE}`
  },
  '┕': {
    1: `${topYAxisFromTop}`,
    2: `${rightMiddleXAxis}`
  },
  '┖': {
    1: `${rightMiddleXAxis}`,
    2: `${topYAxisFromTop}`
  },
  '┗': {
    2: `${topYAxisFromTop} ${TO}${RIGHT.MIDDLE}`
  },
  '┘': {
    1: `${topYAxisFromTop} ${TO}${LEFT.MIDDLE}`
  },
  '┙': {
    1: `${topYAxisFromTop}`,
    2: `${leftMiddleXAxis}`
  },
  '┚': {
    1: `${leftMiddleXAxis}`,
    2: `${topYAxisFromTop}`
  },
  '┛': {
    2: `${topYAxisFromTop} ${TO}${LEFT.MIDDLE}`
  },
  '├': {
    1: `${yAxis} ${rightMiddleXAxis}`
  },
  '┝': {
    1: `${yAxis}`,
    2: `${rightMiddleXAxis}`
  },
  '┞': {
    1: `${bottomYAxisFromMiddle} ${rightMiddleXAxis}`,
    2: `${topYAxisFromTop}`
  },
  '┟': {
    1: `${topYAxisFromMiddle} ${rightMiddleXAxis}`,
    2: `${bottomYAxisFromBottom}`
  },
  '┠': {
    1: `${rightMiddleXAxis}`,
    2: `${yAxis}`
  },
  '┡': {
    1: `${bottomYAxisFromBottom}`,
    2: `${topYAxisFromMiddle} ${rightMiddleXAxis}`
  },
  '┢': {
    1: `${topYAxisFromMiddle}`,
    2: `${bottomYAxisFromBottom} ${rightMiddleXAxis}`
  },
  '┣': {
    2: `${yAxis} ${rightMiddleXAxis}`
  },
  '┤': {
    1: `${yAxis} ${leftMiddleXAxis}`
  },
  '┥': {
    1: `${yAxis}`,
    2: `${leftMiddleXAxis}`
  },
  '┦': {
    1: `${bottomYAxisFromMiddle} ${leftMiddleXAxis}`,
    2: `${topYAxisFromTop}`
  },
  '┧': {
    1: `${topYAxisFromMiddle}`,
    2: `${bottomYAxisFromBottom} ${leftMiddleXAxis}`
  },
  '┨': {
    1: `${leftMiddleXAxis}`,
    2: `${yAxis}`
  },
  '┩': {
    2: `${topYAxisFromMiddle} ${leftMiddleXAxis}`,
    1: `${bottomYAxisFromMiddle}`
  },
  '┪': {
    1: `${topYAxisFromMiddle}`,
    2: `${bottomYAxisFromBottom} ${leftMiddleXAxis}`
  },
  '┫': {
    2: `${yAxis} ${leftMiddleXAxis}`
  },
  '┬': {
    1: `${bottomYAxisFromBottom} ${xAxis}`
  },
  '┭': {
    1: `${bottomYAxisFromBottom} ${rightMiddleXAxis}`,
    2: `${leftMiddleXAxis}`
  },
  '┮': {
    1: `${bottomYAxisFromBottom} ${leftMiddleXAxis}`,
    2: `${rightMiddleXAxis}`
  },
  '┯': {
    1: `${bottomYAxisFromBottom}`,
    2: `${leftMiddleXAxis} ${rightMiddleXAxis}`
  },
  '┰': {
    1: `${xAxis}`,
    2: `${bottomYAxisFromBottom}`
  },
  '┱': {
    1: `${rightMiddleXAxis}`,
    2: `${bottomYAxisFromBottom} ${leftMiddleXAxis}`
  },
  '┲': {
    1: `${bottomYAxisFromBottom} ${leftMiddleXAxis}`,
    2: `${rightMiddleXAxis}`
  },
  '┳': {
    2: `${bottomYAxisFromBottom} ${xAxis}`
  },
  '┴': {
    1: `${topYAxisFromMiddle} ${xAxis}`
  },
  '┵': {
    1: `${topYAxisFromMiddle} ${rightMiddleXAxis}`,
    2: `${leftMiddleXAxis}`
  },
  '┶': {
    1: `${topYAxisFromMiddle} ${leftMiddleXAxis}`,
    2: `${rightMiddleXAxis}`
  },
  '┷': {
    1: `${topYAxisFromMiddle}`,
    2: `${leftMiddleXAxis} ${rightMiddleXAxis}`
  },
  '┸': {
    1: `${xAxis}`,
    2: `${topYAxisFromMiddle}`
  },
  '┹': {
    1: `${rightMiddleXAxis}`,
    2: `${topYAxisFromMiddle} ${leftMiddleXAxis}`
  },
  '┺': {
    1: `${topYAxisFromMiddle} ${leftMiddleXAxis}`,
    2: `${rightMiddleXAxis}`
  },
  '┻': {
    2: `${topYAxisFromMiddle} ${xAxis}`
  },
  '┼': {
    1: `${yAxis} ${xAxis}`
  },
  '┽': {
    1: `${yAxis} ${rightMiddleXAxis}`,
    2: `${leftMiddleXAxis}`
  },
  '┾': {
    1: `${yAxis} ${leftMiddleXAxis}`,
    2: `${rightMiddleXAxis}`
  },
  '┿': {
    1: `${yAxis}`,
    2: `${leftMiddleXAxis} ${rightMiddleXAxis}`
  },
  '╀': {
    1: `${xAxis}`,
    2: `${yAxis}`
  },
  '╁': {
    1: `${rightMiddleXAxis}`,
    2: `${yAxis} ${leftMiddleXAxis}`
  },
  '╂': {
    1: `${yAxis} ${leftMiddleXAxis}`,
    2: `${rightMiddleXAxis}`
  },
  '╃': {
    1: `${bottomYAxisFromBottom} ${rightMiddleXAxis}`,
    2: `${topYAxisFromTop} ${leftMiddleXAxis}`
  },
  '╄': {
    1: `${topYAxisFromTop} ${leftMiddleXAxis}`,
    2: `${bottomYAxisFromBottom} ${rightMiddleXAxis}`
  },
  '╅': {
    1: `${topYAxisFromTop} ${rightMiddleXAxis}`,
    2: `${bottomYAxisFromBottom} ${leftMiddleXAxis}`
  },
  '╆': {
    1: `${topYAxisFromTop} ${leftMiddleXAxis}`,
    2: `${bottomYAxisFromBottom} ${rightMiddleXAxis}`
  },
  '╇': {
    1: `${bottomYAxisFromBottom}`,
    2: `${leftMiddleXAxis} ${topYAxisFromTop} ${rightMiddleXAxis}`
  },
  '╈': {
    1: `${topYAxisFromTop}`,
    2: `${leftMiddleXAxis} ${bottomYAxisFromBottom} ${rightMiddleXAxis}`
  },
  '╉': {
    1: `${rightMiddleXAxis}`,
    2: `${leftMiddleXAxis} ${yAxis}`
  },
  '╊': {
    1: `${leftMiddleXAxis}`,
    2: `${rightMiddleXAxis} ${yAxis}`
  },
  '╋': {
    2: `${yAxis} ${xAxis}`
  },
  '╌': {
    1: `${MOVE}${LEFT.MIDDLE} ${TO}${'.4,.5'} ${MOVE}${'.6,.5'} ${TO}${RIGHT.MIDDLE}`
  },
  '╍': {
    2: `${MOVE}${LEFT.MIDDLE} ${TO}${'.4,.5'} ${MOVE}${'.6,.5'} ${TO}${RIGHT.MIDDLE}`
  },
  '╎': {
    1: `${MOVE}${CENTER.TOP} ${TO}${'.5,.45'} ${MOVE}${'.5,.55'} ${TO}${CENTER.BOTTOM}`
  },
  '╏': {
    2: `${MOVE}${CENTER.TOP} ${TO}${'.5,.45'} ${MOVE}${'.5,.55'} ${TO}${CENTER.BOTTOM}`
  },
  '═': {
    1: `${MOVE}${'0,.45'} ${TO}${'1,.45'} ${MOVE}${'0,.55'} ${TO}${'1,.55'}`
  },
  '║': {
    1: `${MOVE}${'.35,0'} ${TO}${'.35,1'} ${MOVE}${'.65,0'} ${TO}${'.65,1'}`
  },
  '╒': {
    1: `${rightTopXLine} ${rightBottomXLine} ${MOVE}${'.55,1'} ${TO}${'.55,.45'}`
  },
  '╓': {
    1: `${bottomLeftYLine} ${bottomRightYLine} ${MOVE}${'.3,.5'} ${TO}${'1,.5'}`
  },
  '╔': {
    1: `${MOVE}${'.35,.45'} ${TO}${'1,.45'} ${MOVE}${'.35,.45'} ${TO}${'.35,1'} ${MOVE}${'.65,.65'} ${TO}${'1,.65'} ${MOVE}${'.65,.625'} ${TO}${'.65,1'}`
  },
  '╕': {
    1: `${leftTopXLine} ${leftBottomXLine} ${MOVE}${'.55,1'} ${TO}${'.55,.45'}`
  },
  '╖': {
    1: `${bottomLeftYLine} ${bottomRightYLine} ${MOVE}${'0,.5'} ${TO}${'.7,.5'}`
  },
  '╗': {
    1: `${MOVE}${'.35,.45'} ${TO}${'1,.45'} ${MOVE}${'1,.45'} ${TO}${'1,1'} ${MOVE}${'.35,.65'} ${TO}${'.7,.65'} ${MOVE}${'.7,.65'} ${TO}${'.7,1'}`
  },
  '╘': {
    1: `${MOVE}${'0,.85'} ${TO}${'.5,.85'} ${MOVE}${'0,1'} ${TO}${'.5,1'} ${MOVE}${'0,.5'} ${TO}${'0,1'}`
  },
  '╙': {
    1: `${MOVE}${'0,.5'} ${TO}${'0,1'} ${MOVE}${'.35,.5'} ${TO}${'.35,1'} ${MOVE}${'0,1'} ${TO}${'.7,1'}`
  },
  '╚': {
    1: `${MOVE}${'0,.5'} ${TO}${'0,1'} ${MOVE}${'.35,.5'} ${TO}${'.35,.85'} ${MOVE}${'0,1'} ${TO}${'.7,1'} ${MOVE}${'.5,.85'} ${TO}${'1,.85'}`
  },
  '╛': {
    1: `${MOVE}${'0,.85'} ${TO}${'.5,.85'} ${MOVE}${'0,1'} ${TO}${'.5,1'} ${MOVE}${'.55,1'} ${TO}${'.55,.45'}`
  },
  '╜': {
    1: `${bottomLeftYLine} ${bottomRightYLine} ${MOVE}${'0,1'} ${TO}${'.7,1'}`
  },
  '╝': {
    1: `${MOVE}${'.35,.45'} ${TO}${'.35,.85'} ${MOVE}${'.65,.45'} ${TO} ${'.65,1'} ${MOVE}${'0,.85'} ${TO}${'.45,.85'} ${MOVE}${'0,1'} ${TO}${'.65,1'}`
  },
  '╴': {
    1: `${leftMiddleXAxis}`
  },
  '╵': {
    1: `${topYAxisFromMiddle}`
  },
  '╶': {
    1: `${rightMiddleXAxis}`
  },
  '╷': {
    1: `${bottomYAxisFromMiddle}`
  },
  '╸': {
    2: `${leftMiddleXAxis}`
  },
  '╹': {
    2: `${topYAxisFromMiddle}`
  },
  '╺': {
    2: `${rightMiddleXAxis}`
  },
  '╻': {
    2: `${bottomYAxisFromMiddle}`
  },
  '╼': {
    1: `${leftMiddleXAxis}`,
    2: `${rightMiddleXAxis}`
  },
  '╽': {
    1: `${topYAxisFromMiddle}`,
    2: `${bottomYAxisFromBottom}`
  },
  '╾': {
    1: `${rightMiddleXAxis}`,
    2: `${leftMiddleXAxis}`
  },
  '╿': {
    1: `${bottomYAxisFromBottom}`,
    2: `${topYAxisFromMiddle}`
  }
};

const chars: { [index: string]: string } = {
//   // '╞': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╟': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╠': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╡': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╢': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╣': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╤': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╥': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╦': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╧': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╨': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╩': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╪': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╫': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╬': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╭': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╮': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╯': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╰': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╱': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╲': `${MOVE}${} ${TO}${} ${TO}${}`,
//   // '╳': `${MOVE}${} ${TO}${} ${TO}${}`,
};

export function draw(ctx: CanvasRenderingContext2D, c: string, xOffset: number, yOffset: number, cellWidth: number, cellHeight: number): void {
  const match: { [fontWeight: number]: string } = map[c];
  if (!match) {
    return;
  }
  for (const [fontWeight, instructions] of Object.entries(match)) {
    ctx.beginPath();
    ctx.lineWidth = window.devicePixelRatio * Number.parseInt(fontWeight);
    for (const instruction of instructions.split(' ')) {
      const type = instruction[0];
      const f = instructionMap[type];
      const coords: string[] = instruction.substring(1).split(',');
      if (!coords[0] || !coords[1]) {
        continue;
      }
      let x = Number.parseFloat(coords[0].toString()) || Number.parseInt(coords[0].toString());
      let y = Number.parseFloat(coords[1].toString()) || Number.parseInt(coords[1].toString());

      x *= cellWidth;
      y *= cellHeight;

      if (y !== 0) {
        y = clamp(Math.round(y + .5) - .5, cellHeight, 0);
      }
      if (x !== 0) {
        x = clamp(Math.round(x + .5) - .5, cellWidth, 0);
      }
      f(ctx, xOffset + x, yOffset + y);
    }
    ctx.stroke();
    ctx.closePath();
  }
}

function clamp(value: number, max: number, min: number = 0): number {
  return Math.max(Math.min(value, max), min);
}

const instructionMap: { [index: string]: any } = {
  'M': (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.moveTo(x, y);
  },
  'L': (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.lineTo(x, y);
  }
};
