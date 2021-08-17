
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

const enum Shapes {
  /** │ */ TOP_TO_BOTTOM = 'M.5,0 L.5,1',
  /** ─ */ LEFT_TO_RIGHT = 'M0,.5 L1,.5',

  /** └ */ TOP_TO_RIGHT = 'M.5,0 L.5,.5 L1,.5',
  /** ┘ */ TOP_TO_LEFT = 'M.5,0 L.5,.5 L0,.5',
  /** ┐ */ LEFT_TO_BOTTOM = 'M0,.5 L.5,.5 L.5,1',
  /** ┌ */ RIGHT_TO_BOTTOM = 'M0.5,1 L.5,.5 L1,.5',

  /** ╵ */ MIDDLE_TO_TOP = 'M.5,.5 L.5,0',
  /** ╴ */ MIDDLE_TO_LEFT = 'M.5,.5 L0,.5',
  /** ╶ */ MIDDLE_TO_RIGHT = 'M.5,.5 L1,.5',
  /** ╷ */ MIDDLE_TO_BOTTOM = 'M.5,.5 L.5,1',

  /** ┴ */ T_TOP = 'M0,.5 L1,.5 M.5,.5 L.5,0',
  /** ┤ */ T_LEFT = 'M.5,0 L.5,1 M.5,.5 L0,.5',
  /** ├ */ T_RIGHT = 'M.5,0 L.5,1 M.5,.5 L1,.5',
  /** ┬ */ T_BOTTOM = 'M0,.5 L1,.5 M.5,.5 L.5,1',

  /** ┼ */ CROSS = 'M0,.5 L1,.5 M.5,0 L.5,1',

  /** ╌ */ TWO_DASHES_HORIZONTAL = 'M.1,.5 L.4,.5 M.6,.5 L.9,.5',
  /** ┄ */ THREE_DASHES_HORIZONTAL = 'M.052,.5 L.316,.5 M.0.421,.5 L.6315,.5 M.684,.5 L.947,.5',
  /** ┉ */ FOUR_DASHES_HORIZONTAL = 'M.0588,.5 L.235,.5 M.294,.5 L.4705,.5 M.529,.5 L.7058,.5 M.765,.5 L.947,.5',
  /** ╎ */ TWO_DASHES_VERTICAL = 'M.5,.1 T.5,.4 M.5,.6 T.5,.9',
  /** ┆ */ THREE_DASHES_VERTICAL = 'M.5,.052 L.5,.316 M.5,.0.368 L.5.632 M.5,.684 L.5,.947',
  /** ┊ */ FOUR_DASHES_VERTICAL = 'M.5,.0588 L.5,.235 M.5,.294 L.5,.4705 29 L.5,.7058 M.5,.765 L.5,.947',
}

const enum Style {
  NORMAL = 1,
  BOLD = 3
}

// This contains the definitions of all box drawing characters as SVG paths (ie. the svg d attribute)
export const boxCharacters: { [character: string]: { [fontWeight: number]: string | ((xp: number, yp: number) => string) } } = {
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
  '╼': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '╽': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '╾': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '╿': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┍': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┎': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┑': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┒': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┕': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┖': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┙': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┚': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┝': { [Style.NORMAL]: Shapes.TOP_TO_BOTTOM,                                 [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┞': { [Style.NORMAL]: Shapes.RIGHT_TO_BOTTOM,                               [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┟': { [Style.NORMAL]: Shapes.TOP_TO_RIGHT,                                  [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┠': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.TOP_TO_BOTTOM },
  '┡': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.TOP_TO_RIGHT },
  '┢': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.RIGHT_TO_BOTTOM },
  '┥': { [Style.NORMAL]: Shapes.TOP_TO_BOTTOM,                                 [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┦': { [Style.NORMAL]: Shapes.LEFT_TO_BOTTOM,                                [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┧': { [Style.NORMAL]: Shapes.TOP_TO_LEFT,                                   [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┨': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.TOP_TO_BOTTOM },
  '┩': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.TOP_TO_LEFT },
  '┪': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.LEFT_TO_BOTTOM },
  '┭': { [Style.NORMAL]: Shapes.RIGHT_TO_BOTTOM,                               [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┮': { [Style.NORMAL]: Shapes.LEFT_TO_BOTTOM,                                [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┯': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: Shapes.LEFT_TO_RIGHT },
  '┰': { [Style.NORMAL]: Shapes.LEFT_TO_RIGHT,                                 [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '┱': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.LEFT_TO_BOTTOM },
  '┲': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.RIGHT_TO_BOTTOM },
  '┵': { [Style.NORMAL]: Shapes.TOP_TO_RIGHT,                                  [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┶': { [Style.NORMAL]: Shapes.TOP_TO_LEFT,                                   [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┷': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: Shapes.LEFT_TO_RIGHT },
  '┸': { [Style.NORMAL]: Shapes.LEFT_TO_RIGHT,                                 [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '┹': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: Shapes.TOP_TO_LEFT },
  '┺': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: Shapes.TOP_TO_RIGHT },
  '┽': { [Style.NORMAL]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_RIGHT}`,  [Style.BOLD]: Shapes.MIDDLE_TO_LEFT },
  '┾': { [Style.NORMAL]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_LEFT}`,   [Style.BOLD]: Shapes.MIDDLE_TO_RIGHT },
  '┿': { [Style.NORMAL]: Shapes.TOP_TO_BOTTOM,                                 [Style.BOLD]: Shapes.LEFT_TO_RIGHT },
  '╀': { [Style.NORMAL]: `${Shapes.LEFT_TO_RIGHT} ${Shapes.MIDDLE_TO_BOTTOM}`, [Style.BOLD]: Shapes.MIDDLE_TO_TOP },
  '╁': { [Style.NORMAL]: `${Shapes.MIDDLE_TO_TOP} ${Shapes.LEFT_TO_RIGHT}`,    [Style.BOLD]: Shapes.MIDDLE_TO_BOTTOM },
  '╂': { [Style.NORMAL]: Shapes.LEFT_TO_RIGHT,                                 [Style.BOLD]: Shapes.TOP_TO_BOTTOM },
  '╃': { [Style.NORMAL]: Shapes.RIGHT_TO_BOTTOM,                               [Style.BOLD]: Shapes.TOP_TO_LEFT },
  '╄': { [Style.NORMAL]: Shapes.LEFT_TO_BOTTOM,                                [Style.BOLD]: Shapes.TOP_TO_RIGHT },
  '╅': { [Style.NORMAL]: Shapes.TOP_TO_RIGHT,                                  [Style.BOLD]: Shapes.LEFT_TO_BOTTOM },
  '╆': { [Style.NORMAL]: Shapes.TOP_TO_LEFT,                                   [Style.BOLD]: Shapes.RIGHT_TO_BOTTOM },
  '╇': { [Style.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [Style.BOLD]: `${Shapes.MIDDLE_TO_TOP} ${Shapes.LEFT_TO_RIGHT}` },
  '╈': { [Style.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [Style.BOLD]: `${Shapes.LEFT_TO_RIGHT} ${Shapes.MIDDLE_TO_BOTTOM}` },
  '╉': { [Style.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [Style.BOLD]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_LEFT}` },
  '╊': { [Style.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [Style.BOLD]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_RIGHT}` },

  // Dashed
  // TODO: Spacing dashes evenly, use 1/2 padding on each edge so the line is continuous
  '╌': { [Style.NORMAL]: Shapes.TWO_DASHES_HORIZONTAL },
  '╍': { [Style.BOLD]:   Shapes.TWO_DASHES_HORIZONTAL },
  '┄': { [Style.NORMAL]: Shapes.THREE_DASHES_HORIZONTAL },
  '┅': { [Style.BOLD]:   Shapes.THREE_DASHES_HORIZONTAL },
  '┈': { [Style.NORMAL]: Shapes.FOUR_DASHES_HORIZONTAL },
  '┉': { [Style.BOLD]:   Shapes.FOUR_DASHES_HORIZONTAL },
  '╎': { [Style.NORMAL]: Shapes.TWO_DASHES_VERTICAL },
  '╏': { [Style.BOLD]:   Shapes.TWO_DASHES_VERTICAL },
  '┆': { [Style.NORMAL]: Shapes.THREE_DASHES_VERTICAL  },
  '┇': { [Style.BOLD]:   Shapes.THREE_DASHES_VERTICAL },
  '┊': { [Style.NORMAL]: Shapes.FOUR_DASHES_VERTICAL },
  '┋': { [Style.BOLD]:   Shapes.FOUR_DASHES_VERTICAL },

  // Curved
  '╭': { [Style.NORMAL]: 'C.5,1,.5,.5,1,.5' },
  '╮': { [Style.NORMAL]: 'C.5,1,.5,.5,0,.5' },
  '╯': { [Style.NORMAL]: 'C.5,0,.5,.5,0,.5' },
  '╰': { [Style.NORMAL]: 'C.5,0,.5,.5,1,.5' }
};

export function drawBoxChar(ctx: CanvasRenderingContext2D, c: string, xOffset: number, yOffset: number, cellWidth: number, cellHeight: number): void {
  const match: { [fontWeight: number]: string | ((xp: number, yp: number) => string) } = boxCharacters[c];
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
      const args: string[] = instruction.substring(1).split(',');
      if (!args[0] || !args[1]) {
        continue;
      }
      f(ctx, translateArgs(args, cellWidth, cellHeight, xOffset, yOffset));
    }
    ctx.stroke();
    ctx.closePath();
  }
}

function clamp(value: number, max: number, min: number = 0): number {
  return Math.max(Math.min(value, max), min);
}

const instructionMap: { [index: string]: any } = {
  'C': (ctx: CanvasRenderingContext2D, args: number[]) => ctx.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]),
  'L': (ctx: CanvasRenderingContext2D, args: number[]) => ctx.lineTo(args[0], args[1]),
  'M': (ctx: CanvasRenderingContext2D, args: number[]) => ctx.moveTo(args[0], args[1])
};

function translateArgs(args: string[], cellWidth: number, cellHeight: number, xOffset: number, yOffset: number): number[] {
  const result = args.map(e => parseFloat(e) || parseInt(e));

  if (result.length < 2) {
    throw new Error('Too few arguments for instruction');
  }

  for (let x = 0; x < result.length; x += 2) {
    // Translate from 0-1 to 0-cellWidth
    result[x] *= cellWidth;
    // Ensure coordinate doesn't escape cell bounds and round to the nearest 0.5 to ensure a crisp
    // line at 100% devicePixelRatio
    if (result[x] !== 0) {
      result[x] = clamp(Math.round(result[x] + 0.5) - 0.5, cellWidth, 0);
    }
    // Apply the cell's offset (ie. x*cellWidth)
    result[x] += xOffset;
  }

  for (let y = 1; y < result.length; y += 2) {
    // Translate from 0-1 to 0-cellHeight
    result[y] *= cellHeight;
    // Ensure coordinate doesn't escape cell bounds and round to the nearest 0.5 to ensure a crisp
    // line at 100% devicePixelRatio
    if (result[y] !== 0) {
      result[y] = clamp(Math.round(result[y] + 0.5) - 0.5, cellHeight, 0);
    }
    // Apply the cell's offset (ie. x*cellHeight)
    result[y] += yOffset;
  }

  return result;
}
