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

const enum Shapes {
  /** │ */ TOP_TO_BOTTOM = 'M.5,0 L.5,1',
  /** ─ */ LEFT_TO_RIGHT = 'M0,.5 L1,.5',

  /** └ */ TOP_TO_RIGHT = 'M.5,0 L.5,.5 L1,.5',
  /** ┘ */ TOP_TO_LEFT = 'M.5,0 L.5,.5 L0,.5',
  /** ┐ */ LEFT_TO_BOTTOM = 'M0,.5 L.5,.5 L.5,1',
  /** ┌ */ RIGHT_TO_BOTTOM = 'M0.5,1 L.5,.5 L1,.5',

  /** ╵ */ MIDDLE_TO_TOP = 'M.5,.5 L0,.5',
  /** ╴ */ MIDDLE_TO_LEFT = 'M.5,.5 L.5,0',
  /** ╶ */ MIDDLE_TO_RIGHT = 'M.5,.5 L1,.5',
  /** ╷ */ MIDDLE_TO_BOTTOM = 'M.5,.5 L.5,1',

  /** ┴ */ T_TOP = 'M0,.5 L1,.5 M.5,.5 L.5,0',
  /** ┤ */ T_LEFT = 'M.5,0 L.5,1 M.5,.5 L0,.5',
  /** ├ */ T_RIGHT = 'M.5,0 L.5,1 M.5,.5 L1,.5',
  /** ┬ */ T_BOTTOM = 'M0,.5 L1,.5 M.5,.5 L.5,1',

  /** ┼ */ CROSS = 'M0,.5 L1,.5 M.5,0 L.5,1',
}

const enum Style {
  NORMAL = 1,
  BOLD = 2
}

// TODO: Tweak normal and bold weights
const map: { [character: string]: { [fontWeight: number]: string | ((xp: number, yp: number) => string) } } = {
  // Uniform normal and bold
  '─': { [Style.NORMAL]: Shapes.LEFT_TO_RIGHT },
  '━': { [Style.BOLD]:   Shapes.LEFT_TO_RIGHT },
  '│': { [Style.NORMAL]: Shapes.TOP_TO_BOTTOM },
  '┃': { [Style.BOLD]:   Shapes.TOP_TO_BOTTOM },
  '┌': { [Style.NORMAL]: Shapes.RIGHT_TO_BOTTOM },
  '┏': { [Style.BOLD]:   Shapes.RIGHT_TO_BOTTOM },
  '┐': { [Style.NORMAL]: Shapes.LEFT_TO_BOTTOM },
  '┓': { [Style.BOLD]:   Shapes.LEFT_TO_BOTTOM },
  '└': { [Style.NORMAL]: Shapes.TOP_TO_RIGHT },
  '┗': { [Style.BOLD]:   Shapes.TOP_TO_RIGHT },
  '┘': { [Style.NORMAL]: Shapes.TOP_TO_LEFT },
  '┛': { [Style.BOLD]:   Shapes.TOP_TO_LEFT },
  '├': { [Style.NORMAL]: Shapes.T_RIGHT },
  '┣': { [Style.BOLD]:   Shapes.T_RIGHT },
  '┤': { [Style.NORMAL]: Shapes.T_LEFT },
  '┫': { [Style.BOLD]:   Shapes.T_LEFT },
  '┬': { [Style.NORMAL]: Shapes.T_BOTTOM },
  '┳': { [Style.BOLD]:   Shapes.T_BOTTOM },
  '┴': { [Style.NORMAL]: Shapes.T_TOP },
  '┻': { [Style.BOLD]:   Shapes.T_TOP },
  '┼': { [Style.NORMAL]: Shapes.CROSS },
  '╋': { [Style.BOLD]:   Shapes.CROSS },
  '╴': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT },
  '╸': { [Style.BOLD]:   Shapes.MIDDLE_TO_LEFT },
  '╵': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP },
  '╹': { [Style.BOLD]:   Shapes.MIDDLE_TO_TOP },
  '╶': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT },
  '╺': { [Style.BOLD]:   Shapes.MIDDLE_TO_RIGHT },
  '╷': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM },
  '╻': { [Style.BOLD]:   Shapes.MIDDLE_TO_BOTTOM },

  // Mixed normal/bold
  '┍': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM, [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┎': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,  [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },

  // Double border
  '═': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp}` },
  '║': { [Style.NORMAL]: (xp, yp) => `M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1` },
  '╒': { [Style.NORMAL]: (xp, yp) => `M.5,1 L.5,${.5 - yp} L1,${.5 - yp} M.5,${.5 + yp} L1,${.5 + yp}` },
  '╓': { [Style.NORMAL]: (xp, yp) => `M${.5 - xp},1 L${.5 - xp},.5 L1,.5 M${.5 + xp},.5 L${.5 + xp},1` },
  '╔': { [Style.NORMAL]: (xp, yp) => `M1,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1` },
  '╕': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L.5,${.5 - yp} L.5,1 M0,${.5 + yp} L.5,${.5 + yp}` },
  '╖': { [Style.NORMAL]: (xp, yp) => `M${.5 + xp},1 L${.5 + xp},.5 L0,.5 M${.5 - xp},.5 L${.5 - xp},1` },
  '╗': { [Style.NORMAL]: (xp, yp) => `M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M0,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},1` },
  '╘': { [Style.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 + yp} L1,${.5 + yp} M.5,${.5 - yp} L1,${.5 - yp}` },
  '╙': { [Style.NORMAL]: (xp, yp) => `M1,.5 L${.5 - xp},.5 L${.5 - xp},0 M${.5 + xp},.5 L${.5 + xp},0` },
  '╚': { [Style.NORMAL]: (xp, yp) => `M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0 M1,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},0` },
  '╛': { [Style.NORMAL]: (xp, yp) => `M0,${.5 + yp} L.5,${.5 + yp} L.5,0 M0,${.5 - yp} L.5,${.5 - yp}` },
  '╜': { [Style.NORMAL]: (xp, yp) => `M0,.5 L${.5 + xp},.5 L${.5 + xp},0 M${.5 - xp},.5 L${.5 - xp},0 ` },
  '╝': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0 M0,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},0` },
  '╞': { [Style.NORMAL]: (xp, yp) => `${Shapes.TOP_TO_BOTTOM} M.5,${.5 - yp} L1,${.5 - yp} M.5,${.5 + yp} L1,${.5 + yp}` },
  '╟': { [Style.NORMAL]: (xp, yp) => `M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1 M${.5 + xp},.5 L1,.5` },
  '╠': { [Style.NORMAL]: (xp, yp) => `M${.5 - xp},0 L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1 M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0` },
  '╡': { [Style.NORMAL]: (xp, yp) => `${Shapes.TOP_TO_BOTTOM} M0,${.5 - yp} L.5,${.5 - yp} M0,${.5 + yp} L.5,${.5 + yp}` },
  '╢': { [Style.NORMAL]: (xp, yp) => `M0,.5 L${.5 - xp},.5 M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1` },
  '╣': { [Style.NORMAL]: (xp, yp) => `M${.5 + xp},0 L${.5 + xp},1 M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0` },
  '╤': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp} M.5,${.5 + yp} L.5,1` },
  '╥': { [Style.NORMAL]: (xp, yp) => `${Shapes.LEFT_TO_RIGHT} M${.5 - xp},.5 L${.5 - xp},1 M${.5 + xp},.5 L${.5 + xp},1` },
  '╦': { [Style.NORMAL]: (xp, yp) => `M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1` },
  '╧': { [Style.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 - yp} M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp}` },
  '╨': { [Style.NORMAL]: (xp, yp) => `${Shapes.LEFT_TO_RIGHT} M${.5 - xp},.5 L${.5 - xp},0 M${.5 + xp},.5 L${.5 + xp},0` },
  '╩': { [Style.NORMAL]: (xp, yp) => `M0,${.5 + yp} L1,${.5 + yp} M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0 M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0` },
  '╪': { [Style.NORMAL]: (xp, yp) => `${Shapes.TOP_TO_BOTTOM} M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp}` },
  '╫': { [Style.NORMAL]: (xp, yp) => `${Shapes.LEFT_TO_RIGHT} M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1` },
  '╬': { [Style.NORMAL]: (xp, yp) => `M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1 M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0 M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0` },

  // Diagonal
  '╱': { [Style.NORMAL]: 'M1,0 L0,1' },
  '╲': { [Style.NORMAL]: 'M0,0 L1,1' },
  '╳': { [Style.NORMAL]: 'M1,0 L0,1 M0,0 L1,1' },

  // Mixed weight
  '┑': { [Style.NORMAL]: `${bottomYAxisFromBottom}`, [Style.BOLD]: `${leftMiddleXAxis}` },
  '┒': { [Style.NORMAL]: `${leftMiddleXAxis}`, [Style.BOLD]: `${bottomYAxisFromBottom}` },
  '┕': { [Style.NORMAL]: `${topYAxisFromTop}`, [Style.BOLD]: `${rightMiddleXAxis}` },
  '┖': { [Style.NORMAL]: `${rightMiddleXAxis}`, [Style.BOLD]: `${topYAxisFromTop}` },
  '┙': { [Style.NORMAL]: `${topYAxisFromTop}`, [Style.BOLD]: `${leftMiddleXAxis}` },
  '┚': { [Style.NORMAL]: `${leftMiddleXAxis}`, [Style.BOLD]: `${topYAxisFromTop}` },
  '┝': { [Style.NORMAL]: `${yAxis}`, [Style.BOLD]: `${rightMiddleXAxis}` },
  '┞': { [Style.NORMAL]: `${bottomYAxisFromMiddle} ${rightMiddleXAxis}`, [Style.BOLD]: `${topYAxisFromTop}` },
  '┟': { [Style.NORMAL]: `${topYAxisFromMiddle} ${rightMiddleXAxis}`, [Style.BOLD]: `${bottomYAxisFromBottom}` },
  '┠': { [Style.NORMAL]: `${rightMiddleXAxis}`, [Style.BOLD]: `${yAxis}` },
  '┡': { [Style.NORMAL]: `${bottomYAxisFromBottom}`, [Style.BOLD]: `${topYAxisFromMiddle} ${rightMiddleXAxis}` },
  '┢': { [Style.NORMAL]: `${topYAxisFromMiddle}`, [Style.BOLD]: `${bottomYAxisFromBottom} ${rightMiddleXAxis}` },
  '┥': { [Style.NORMAL]: `${yAxis}`, [Style.BOLD]: `${leftMiddleXAxis}` },
  '┦': { [Style.NORMAL]: `${bottomYAxisFromMiddle} ${leftMiddleXAxis}`, [Style.BOLD]: `${topYAxisFromTop}` },
  '┧': { [Style.NORMAL]: `${topYAxisFromMiddle}`, [Style.BOLD]: `${bottomYAxisFromBottom} ${leftMiddleXAxis}` },
  '┨': { [Style.NORMAL]: `${leftMiddleXAxis}`, [Style.BOLD]: `${yAxis}` },
  '┩': { [Style.NORMAL]: `${bottomYAxisFromMiddle}`, [Style.BOLD]: `${topYAxisFromMiddle} ${leftMiddleXAxis}` },
  '┪': { [Style.NORMAL]: `${topYAxisFromMiddle}`, [Style.BOLD]: `${bottomYAxisFromBottom} ${leftMiddleXAxis}` },
  '┭': { [Style.NORMAL]: `${bottomYAxisFromBottom} ${rightMiddleXAxis}`, [Style.BOLD]: `${leftMiddleXAxis}` },
  '┮': { [Style.NORMAL]: `${bottomYAxisFromBottom} ${leftMiddleXAxis}`, [Style.BOLD]: `${rightMiddleXAxis}` },
  '┯': { [Style.NORMAL]: `${bottomYAxisFromBottom}`, [Style.BOLD]: `${leftMiddleXAxis} ${rightMiddleXAxis}` },
  '┰': { [Style.NORMAL]: `${xAxis}`, [Style.BOLD]: `${bottomYAxisFromBottom}` },
  '┱': { [Style.NORMAL]: `${rightMiddleXAxis}`, [Style.BOLD]: `${bottomYAxisFromBottom} ${leftMiddleXAxis}` },
  '┲': { [Style.NORMAL]: `${bottomYAxisFromBottom} ${leftMiddleXAxis}`, [Style.BOLD]: `${rightMiddleXAxis}` },
  '┵': { [Style.NORMAL]: `${topYAxisFromMiddle} ${rightMiddleXAxis}`, [Style.BOLD]: `${leftMiddleXAxis}` },
  '┶': { [Style.NORMAL]: `${topYAxisFromMiddle} ${leftMiddleXAxis}`, [Style.BOLD]: `${rightMiddleXAxis}` },
  '┷': { [Style.NORMAL]: `${topYAxisFromMiddle}`, [Style.BOLD]: `${leftMiddleXAxis} ${rightMiddleXAxis}` },
  '┸': { [Style.NORMAL]: `${xAxis}`, [Style.BOLD]: `${topYAxisFromMiddle}` },
  '┹': { [Style.NORMAL]: `${rightMiddleXAxis}`, [Style.BOLD]: `${topYAxisFromMiddle} ${leftMiddleXAxis}` },
  '┺': { [Style.NORMAL]: `${topYAxisFromMiddle} ${leftMiddleXAxis}`, [Style.BOLD]: `${rightMiddleXAxis}` },
  '┽': { [Style.NORMAL]: `${yAxis} ${rightMiddleXAxis}`, [Style.BOLD]: `${leftMiddleXAxis}` },
  '┾': { [Style.NORMAL]: `${yAxis} ${leftMiddleXAxis}`, [Style.BOLD]: `${rightMiddleXAxis}` },
  '┿': { [Style.NORMAL]: `${yAxis}`, [Style.BOLD]: `${leftMiddleXAxis} ${rightMiddleXAxis}` },
  '╀': { [Style.NORMAL]: `${xAxis}`, [Style.BOLD]: `${yAxis}` },
  '╁': { [Style.NORMAL]: `${rightMiddleXAxis}`, [Style.BOLD]: `${yAxis} ${leftMiddleXAxis}` },
  '╂': { [Style.NORMAL]: `${yAxis} ${leftMiddleXAxis}`, [Style.BOLD]: `${rightMiddleXAxis}` },
  '╃': { [Style.NORMAL]: `${bottomYAxisFromBottom} ${rightMiddleXAxis}`, [Style.BOLD]: `${topYAxisFromTop} ${leftMiddleXAxis}` },
  '╄': { [Style.NORMAL]: `${topYAxisFromTop} ${leftMiddleXAxis}`, [Style.BOLD]: `${bottomYAxisFromBottom} ${rightMiddleXAxis}` },
  '╅': { [Style.NORMAL]: `${topYAxisFromTop} ${rightMiddleXAxis}`, [Style.BOLD]: `${bottomYAxisFromBottom} ${leftMiddleXAxis}` },
  '╆': { [Style.NORMAL]: `${topYAxisFromTop} ${leftMiddleXAxis}`, [Style.BOLD]: `${bottomYAxisFromBottom} ${rightMiddleXAxis}` },
  '╇': { [Style.NORMAL]: `${bottomYAxisFromBottom}`, [Style.BOLD]: `${leftMiddleXAxis} ${topYAxisFromTop} ${rightMiddleXAxis}` },
  '╈': { [Style.NORMAL]: `${topYAxisFromTop}`, [Style.BOLD]: `${leftMiddleXAxis} ${bottomYAxisFromBottom} ${rightMiddleXAxis}` },
  '╉': { [Style.NORMAL]: `${rightMiddleXAxis}`, [Style.BOLD]: `${leftMiddleXAxis} ${yAxis}` },
  '╊': { [Style.NORMAL]: `${leftMiddleXAxis}`, [Style.BOLD]: `${rightMiddleXAxis} ${yAxis}` },
  '╼': { [Style.NORMAL]: `${leftMiddleXAxis}`, [Style.BOLD]: `${rightMiddleXAxis}` },
  '╽': { [Style.NORMAL]: `${topYAxisFromMiddle}`, [Style.BOLD]: `${bottomYAxisFromBottom}` },
  '╾': { [Style.NORMAL]: `${rightMiddleXAxis}`, [Style.BOLD]: `${leftMiddleXAxis}` },
  '╿': { [Style.NORMAL]: `${bottomYAxisFromBottom}`, [Style.BOLD]: `${topYAxisFromMiddle}` },

  // Dashed
  '╌': { [Style.NORMAL]: `${MOVE}${LEFT.MIDDLE} ${TO}${'.4,.5'} ${MOVE}${'.6,.5'} ${TO}${RIGHT.MIDDLE}` },
  '╍': { [Style.BOLD]:   `${MOVE}${LEFT.MIDDLE} ${TO}${'.4,.5'} ${MOVE}${'.6,.5'} ${TO}${RIGHT.MIDDLE}` },
  '┄': { [Style.NORMAL]: `` },
  '┅': { [Style.BOLD]:   `` },
  '┈': { [Style.NORMAL]: `` },
  '┉': { [Style.BOLD]:   `` },
  '╎': { [Style.NORMAL]: `${MOVE}${CENTER.TOP} ${TO}${'.5,.45'} ${MOVE}${'.5,.55'} ${TO}${CENTER.BOTTOM}` },
  '╏': { [Style.BOLD]:   `${MOVE}${CENTER.TOP} ${TO}${'.5,.45'} ${MOVE}${'.5,.55'} ${TO}${CENTER.BOTTOM}` },
  '┆': { [Style.NORMAL]: `` },
  '┇': { [Style.BOLD]:   `` },
  '┊': { [Style.NORMAL]: `` },
  '┋': { [Style.BOLD]:   `` }
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

// Give more specific name
export function draw(ctx: CanvasRenderingContext2D, c: string, xOffset: number, yOffset: number, cellWidth: number, cellHeight: number): void {
  const match: { [fontWeight: number]: string | ((xp: number, yp: number) => string) } = map[c];
  if (!match) {
    return;
  }
  for (const [fontWeight, instructions] of Object.entries(match)) {
    ctx.beginPath();
    ctx.lineWidth = window.devicePixelRatio * Number.parseInt(fontWeight);
    let actualInstructions: string;
    if (typeof instructions === 'function') {
      const xp = .15;
      const yp = .15 / cellHeight * cellWidth;
      actualInstructions = instructions(xp, yp);
    } else {
      actualInstructions = instructions;
    }
    for (const instruction of actualInstructions.split(' ')) {
      const type = instruction[0];
      const f = instructionMap[type];
      if (!f) {
        console.error(`Could not find drawing instructions for "${type}"`);
        continue;
      }
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
    ctx.moveTo(x, y); },
  'L': (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.lineTo(x, y);
  }
};
