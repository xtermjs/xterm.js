/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CustomGlyphDefinitionType, CustomGlyphVectorType, type CustomGlyphCharacterDefinition, type CustomGlyphPathDrawFunctionDefinition } from './Types';

/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */

export const customGlyphDefinitions: { [index: string]: CustomGlyphCharacterDefinition | undefined } = {
  // #region Box Drawing (2500-257F)

  // https://www.unicode.org/charts/PDF/U2500.pdf

  // Light and heavy solid lines (2500-2503)
  '─': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.LEFT_TO_RIGHT } },
  '━': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.LEFT_TO_RIGHT } },
  '│': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_BOTTOM } },
  '┃': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.TOP_TO_BOTTOM } },

  // Light and heavy dashed lines (2504-250B)
  '┄': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.THREE_DASHES_HORIZONTAL } },
  '┅': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.THREE_DASHES_HORIZONTAL } },
  '┆': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.THREE_DASHES_VERTICAL  } },
  '┇': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.THREE_DASHES_VERTICAL } },
  '┈': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.FOUR_DASHES_HORIZONTAL } },
  '┉': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.FOUR_DASHES_HORIZONTAL } },
  '┊': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.FOUR_DASHES_VERTICAL } },
  '┋': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.FOUR_DASHES_VERTICAL } },

  // Light and heavy line box components (250C-254B)
  '┌': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.RIGHT_TO_BOTTOM } },
  '┍': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [FontWeight.BOLD]: Shapes.MIDDLE_TO_RIGHT } },
  '┎': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [FontWeight.BOLD]: Shapes.MIDDLE_TO_BOTTOM } },
  '┏': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.RIGHT_TO_BOTTOM } },
  '┐': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.LEFT_TO_BOTTOM } },
  '┑': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [FontWeight.BOLD]: Shapes.MIDDLE_TO_LEFT } },
  '┒': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [FontWeight.BOLD]: Shapes.MIDDLE_TO_BOTTOM } },
  '┓': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.LEFT_TO_BOTTOM } },
  '└': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_RIGHT } },
  '┕': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [FontWeight.BOLD]: Shapes.MIDDLE_TO_RIGHT } },
  '┖': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [FontWeight.BOLD]: Shapes.MIDDLE_TO_TOP } },
  '┗': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.TOP_TO_RIGHT } },
  '┘': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_LEFT } },
  '┙': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [FontWeight.BOLD]: Shapes.MIDDLE_TO_LEFT } },
  '┚': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [FontWeight.BOLD]: Shapes.MIDDLE_TO_TOP } },
  '┛': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.TOP_TO_LEFT } },
  '├': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.T_RIGHT } },
  '┝': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_BOTTOM,                                 [FontWeight.BOLD]: Shapes.MIDDLE_TO_RIGHT } },
  '┞': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.RIGHT_TO_BOTTOM,                               [FontWeight.BOLD]: Shapes.MIDDLE_TO_TOP } },
  '┟': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_RIGHT,                                  [FontWeight.BOLD]: Shapes.MIDDLE_TO_BOTTOM } },
  '┠': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [FontWeight.BOLD]: Shapes.TOP_TO_BOTTOM } },
  '┡': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [FontWeight.BOLD]: Shapes.TOP_TO_RIGHT } },
  '┢': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [FontWeight.BOLD]: Shapes.RIGHT_TO_BOTTOM } },
  '┣': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.T_RIGHT } },
  '┤': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.T_LEFT } },
  '┥': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_BOTTOM,                                 [FontWeight.BOLD]: Shapes.MIDDLE_TO_LEFT } },
  '┦': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.LEFT_TO_BOTTOM,                                [FontWeight.BOLD]: Shapes.MIDDLE_TO_TOP } },
  '┧': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_LEFT,                                   [FontWeight.BOLD]: Shapes.MIDDLE_TO_BOTTOM } },
  '┨': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [FontWeight.BOLD]: Shapes.TOP_TO_BOTTOM } },
  '┩': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [FontWeight.BOLD]: Shapes.TOP_TO_LEFT } },
  '┪': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [FontWeight.BOLD]: Shapes.LEFT_TO_BOTTOM } },
  '┫': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.T_LEFT } },
  '┬': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.T_BOTTOM } },
  '┭': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.RIGHT_TO_BOTTOM,                               [FontWeight.BOLD]: Shapes.MIDDLE_TO_LEFT } },
  '┮': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.LEFT_TO_BOTTOM,                                [FontWeight.BOLD]: Shapes.MIDDLE_TO_RIGHT } },
  '┯': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [FontWeight.BOLD]: Shapes.LEFT_TO_RIGHT } },
  '┰': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.LEFT_TO_RIGHT,                                 [FontWeight.BOLD]: Shapes.MIDDLE_TO_BOTTOM } },
  '┱': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [FontWeight.BOLD]: Shapes.LEFT_TO_BOTTOM } },
  '┲': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [FontWeight.BOLD]: Shapes.RIGHT_TO_BOTTOM } },
  '┳': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.T_BOTTOM } },
  '┴': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.T_TOP } },
  '┵': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_RIGHT,                                  [FontWeight.BOLD]: Shapes.MIDDLE_TO_LEFT } },
  '┶': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_LEFT,                                   [FontWeight.BOLD]: Shapes.MIDDLE_TO_RIGHT } },
  '┷': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [FontWeight.BOLD]: Shapes.LEFT_TO_RIGHT } },
  '┸': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.LEFT_TO_RIGHT,                                 [FontWeight.BOLD]: Shapes.MIDDLE_TO_TOP } },
  '┹': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [FontWeight.BOLD]: Shapes.TOP_TO_LEFT } },
  '┺': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [FontWeight.BOLD]: Shapes.TOP_TO_RIGHT } },
  '┻': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.T_TOP } },
  '┼': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.CROSS } },
  '┽': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_RIGHT}`,  [FontWeight.BOLD]: Shapes.MIDDLE_TO_LEFT } },
  '┾': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_LEFT}`,   [FontWeight.BOLD]: Shapes.MIDDLE_TO_RIGHT } },
  '┿': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_BOTTOM,                                 [FontWeight.BOLD]: Shapes.LEFT_TO_RIGHT } },
  '╀': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: `${Shapes.LEFT_TO_RIGHT} ${Shapes.MIDDLE_TO_BOTTOM}`, [FontWeight.BOLD]: Shapes.MIDDLE_TO_TOP } },
  '╁': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: `${Shapes.MIDDLE_TO_TOP} ${Shapes.LEFT_TO_RIGHT}`,    [FontWeight.BOLD]: Shapes.MIDDLE_TO_BOTTOM } },
  '╂': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.LEFT_TO_RIGHT,                                 [FontWeight.BOLD]: Shapes.TOP_TO_BOTTOM } },
  '╃': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.RIGHT_TO_BOTTOM,                               [FontWeight.BOLD]: Shapes.TOP_TO_LEFT } },
  '╄': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.LEFT_TO_BOTTOM,                                [FontWeight.BOLD]: Shapes.TOP_TO_RIGHT } },
  '╅': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_RIGHT,                                  [FontWeight.BOLD]: Shapes.LEFT_TO_BOTTOM } },
  '╆': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TOP_TO_LEFT,                                   [FontWeight.BOLD]: Shapes.RIGHT_TO_BOTTOM } },
  '╇': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [FontWeight.BOLD]: `${Shapes.MIDDLE_TO_TOP} ${Shapes.LEFT_TO_RIGHT}` } },
  '╈': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [FontWeight.BOLD]: `${Shapes.LEFT_TO_RIGHT} ${Shapes.MIDDLE_TO_BOTTOM}` } },
  '╉': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [FontWeight.BOLD]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_LEFT}` } },
  '╊': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [FontWeight.BOLD]: `${Shapes.TOP_TO_BOTTOM} ${Shapes.MIDDLE_TO_RIGHT}` } },
  '╋': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.CROSS } },

  // Light and heavy dashed lines (254C-254F)
  '╌': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TWO_DASHES_HORIZONTAL } },
  '╍': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.TWO_DASHES_HORIZONTAL } },
  '╎': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.TWO_DASHES_VERTICAL } },
  '╏': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.TWO_DASHES_VERTICAL } },

  // Double lines (2550-2551)
  '═': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp}` } },
  '║': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1` } },

  // Light and double line box components (2552-256C)
  '╒': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M.5,1 L.5,${.5 - yp} L1,${.5 - yp} M.5,${.5 + yp} L1,${.5 + yp}` } },
  '╓': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M${.5 - xp},1 L${.5 - xp},.5 L1,.5 M${.5 + xp},.5 L${.5 + xp},1` } },
  '╔': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M1,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1` } },
  '╕': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,${.5 - yp} L.5,${.5 - yp} L.5,1 M0,${.5 + yp} L.5,${.5 + yp}` } },
  '╖': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M${.5 + xp},1 L${.5 + xp},.5 L0,.5 M${.5 - xp},.5 L${.5 - xp},1` } },
  '╗': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M0,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},1` } },
  '╘': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 + yp} L1,${.5 + yp} M.5,${.5 - yp} L1,${.5 - yp}` } },
  '╙': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M1,.5 L${.5 - xp},.5 L${.5 - xp},0 M${.5 + xp},.5 L${.5 + xp},0` } },
  '╚': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0 M1,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},0` } },
  '╛': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,${.5 + yp} L.5,${.5 + yp} L.5,0 M0,${.5 - yp} L.5,${.5 - yp}` } },
  '╜': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,.5 L${.5 + xp},.5 L${.5 + xp},0 M${.5 - xp},.5 L${.5 - xp},0` } },
  '╝': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0 M0,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},0` } },
  '╞': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `${Shapes.TOP_TO_BOTTOM} M.5,${.5 - yp} L1,${.5 - yp} M.5,${.5 + yp} L1,${.5 + yp}` } },
  '╟': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1 M${.5 + xp},.5 L1,.5` } },
  '╠': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M${.5 - xp},0 L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1 M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0` } },
  '╡': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `${Shapes.TOP_TO_BOTTOM} M0,${.5 - yp} L.5,${.5 - yp} M0,${.5 + yp} L.5,${.5 + yp}` } },
  '╢': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,.5 L${.5 - xp},.5 M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1` } },
  '╣': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M${.5 + xp},0 L${.5 + xp},1 M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0` } },
  '╤': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp} M.5,${.5 + yp} L.5,1` } },
  '╥': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `${Shapes.LEFT_TO_RIGHT} M${.5 - xp},.5 L${.5 - xp},1 M${.5 + xp},.5 L${.5 + xp},1` } },
  '╦': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1` } },
  '╧': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 - yp} M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp}` } },
  '╨': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `${Shapes.LEFT_TO_RIGHT} M${.5 - xp},.5 L${.5 - xp},0 M${.5 + xp},.5 L${.5 + xp},0` } },
  '╩': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,${.5 + yp} L1,${.5 + yp} M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0 M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0` } },
  '╪': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `${Shapes.TOP_TO_BOTTOM} M0,${.5 - yp} L1,${.5 - yp} M0,${.5 + yp} L1,${.5 + yp}` } },
  '╫': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `${Shapes.LEFT_TO_RIGHT} M${.5 - xp},0 L${.5 - xp},1 M${.5 + xp},0 L${.5 + xp},1` } },
  '╬': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M0,${.5 + yp} L${.5 - xp},${.5 + yp} L${.5 - xp},1 M1,${.5 + yp} L${.5 + xp},${.5 + yp} L${.5 + xp},1 M0,${.5 - yp} L${.5 - xp},${.5 - yp} L${.5 - xp},0 M1,${.5 - yp} L${.5 + xp},${.5 - yp} L${.5 + xp},0` } },

  // Character cell arcs (256D-2570)
  '╭': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M.5,1 L.5,${.5 + (yp / .15 * .5)} C.5,${.5 + (yp / .15 * .5)},.5,.5,1,.5` } },
  '╮': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M.5,1 L.5,${.5 + (yp / .15 * .5)} C.5,${.5 + (yp / .15 * .5)},.5,.5,0,.5` } },
  '╯': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 - (yp / .15 * .5)} C.5,${.5 - (yp / .15 * .5)},.5,.5,0,.5` } },
  '╰': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: (xp, yp) => `M.5,0 L.5,${.5 - (yp / .15 * .5)} C.5,${.5 - (yp / .15 * .5)},.5,.5,1,.5` } },

  // Character cell diagonals (2571-2573)
  '╱': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M1,0 L0,1' } },
  '╲': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,0 L1,1' } },
  '╳': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M1,0 L0,1 M0,0 L1,1' } },

  // Light and heavy half lines (2574-257B)
  '╴': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_LEFT } },
  '╵': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_TOP } },
  '╶': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_RIGHT } },
  '╷': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_BOTTOM } },
  '╸': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.MIDDLE_TO_LEFT } },
  '╹': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.MIDDLE_TO_TOP } },
  '╺': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.MIDDLE_TO_RIGHT } },
  '╻': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.BOLD]:   Shapes.MIDDLE_TO_BOTTOM } },

  // Mixed light and heavy lines (257C-257F)
  '╼': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_LEFT,                                [FontWeight.BOLD]: Shapes.MIDDLE_TO_RIGHT } },
  '╽': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_TOP,                                 [FontWeight.BOLD]: Shapes.MIDDLE_TO_BOTTOM } },
  '╾': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_RIGHT,                               [FontWeight.BOLD]: Shapes.MIDDLE_TO_LEFT } },
  '╿': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: Shapes.MIDDLE_TO_BOTTOM,                              [FontWeight.BOLD]: Shapes.MIDDLE_TO_TOP } },

  // #endregion

  // #region Block elements (2580-259F)

  // https://www.unicode.org/charts/PDF/U2580.pdf

  // Block elements (2580-2590)
  '▀': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 4 }] }, // UPPER HALF BLOCK
  '▁': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 7, w: 8, h: 1 }] }, // LOWER ONE EIGHTH BLOCK
  '▂': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 6, w: 8, h: 2 }] }, // LOWER ONE QUARTER BLOCK
  '▃': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 5, w: 8, h: 3 }] }, // LOWER THREE EIGHTHS BLOCK
  '▄': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 4, w: 8, h: 4 }] }, // LOWER HALF BLOCK
  '▅': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 3, w: 8, h: 5 }] }, // LOWER FIVE EIGHTHS BLOCK
  '▆': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 2, w: 8, h: 6 }] }, // LOWER THREE QUARTERS BLOCK
  '▇': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 1, w: 8, h: 7 }] }, // LOWER SEVEN EIGHTHS BLOCK
  '█': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 8 }] }, // FULL BLOCK (=solid -> 25A0=black square)
  '▉': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 7, h: 8 }] }, // LEFT SEVEN EIGHTHS BLOCK
  '▊': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 6, h: 8 }] }, // LEFT THREE QUARTERS BLOCK
  '▋': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 5, h: 8 }] }, // LEFT FIVE EIGHTHS BLOCK
  '▌': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 4, h: 8 }] }, // LEFT HALF BLOCK
  '▍': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 3, h: 8 }] }, // LEFT THREE EIGHTHS BLOCK
  '▎': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 2, h: 8 }] }, // LEFT ONE QUARTER BLOCK
  '▏': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 1, h: 8 }] }, // LEFT ONE EIGHTH BLOCK
  '▐': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 4, y: 0, w: 4, h: 8 }] }, // RIGHT HALF BLOCK

  // Shade characters (2591-2593)
  '░': { type: CustomGlyphDefinitionType.BLOCK_PATTERN, data: [ // LIGHT SHADE (25%)
    [1, 0],
    [0, 0]
  ] },
  '▒': { type: CustomGlyphDefinitionType.BLOCK_PATTERN, data: [ // MEDIUM SHADE (=speckles fill, dotted fill, 50%, used in mapping to cp949, -> 1FB90 inverse medium shade)
    [1, 0],
    [0, 1]
  ] },
  '▓': { type: CustomGlyphDefinitionType.BLOCK_PATTERN, data: [ // DARK SHADE (75%)
    [1, 1],
    [1, 0]
  ] },

  // Block elements (2594-2595)
  '▔': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 1 }] }, // UPPER ONE EIGHTH BLOCK
  '▕': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 7, y: 0, w: 1, h: 8 }] }, // RIGHT ONE EIGHTH BLOCK

  // Terminal graphic characters (2596-259F)
  '▖': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 4, w: 4, h: 4 }] },                             // QUADRANT LOWER LEFT
  '▗': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 4, y: 4, w: 4, h: 4 }] },                             // QUADRANT LOWER RIGHT
  '▘': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 4, h: 4 }] },                             // QUADRANT UPPER LEFT
  '▙': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 4, h: 8 }, { x: 0, y: 4, w: 8, h: 4 }] }, // QUADRANT UPPER LEFT AND LOWER LEFT AND LOWER RIGHT (-> 1F67F reverse checker board, -> 1FB95 checker board fill)
  '▚': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 4, h: 4 }, { x: 4, y: 4, w: 4, h: 4 }] }, // QUADRANT UPPER LEFT AND LOWER RIGHT
  '▛': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 4, h: 8 }, { x: 4, y: 0, w: 4, h: 4 }] }, // QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER LEFT
  '▜': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 4 }, { x: 4, y: 0, w: 4, h: 8 }] }, // QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER RIGHT
  '▝': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 4, y: 0, w: 4, h: 4 }] },                             // QUADRANT UPPER RIGHT
  '▞': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 4, y: 0, w: 4, h: 4 }, { x: 0, y: 4, w: 4, h: 4 }] }, // QUADRANT UPPER RIGHT AND LOWER LEFT (-> 1F67E checker board, 1FB96 inverse checker board fill)
  '▟': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 4, y: 0, w: 4, h: 8 }, { x: 0, y: 4, w: 8, h: 4 }] }, // QUADRANT UPPER RIGHT AND LOWER LEFT AND LOWER RIGHT

  // #endregion

  // #region Powerline Symbols (E0A0-E0BF)

  // This contains the definitions of the primarily used box drawing characters as vector shapes.
  // The reason these characters are defined specially is to avoid common problems if a user's font
  // has not been patched with powerline characters and also to get pixel perfect rendering as
  // rendering issues can occur around AA/SPAA.
  //
  // The line variants draw beyond the cell and get clipped to ensure the end of the line is not
  // visible.
  //
  // Original symbols defined in https://github.com/powerline/fontpatcher

  // Git branch
  '\u{E0A0}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.3,1 L.03,1 L.03,.88 C.03,.82,.06,.78,.11,.73 C.15,.7,.2,.68,.28,.65 L.43,.6 C.49,.58,.53,.56,.56,.53 C.59,.5,.6,.47,.6,.43 L.6,.27 L.4,.27 L.69,.1 L.98,.27 L.78,.27 L.78,.46 C.78,.52,.76,.56,.72,.61 C.68,.66,.63,.67,.56,.7 L.48,.72 C.42,.74,.38,.76,.35,.78 C.32,.8,.31,.84,.31,.88 L.31,1 M.3,.5 L.03,.59 L.03,.09 L.3,.09 L.3,.655', type: CustomGlyphVectorType.FILL } },
  // LN (Line Number)
  '\u{E0A1}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.7,.4 L.7,.47 L.2,.47 L.2,.03 L.355,.03 L.355,.4 L.705,.4 M.7,.5 L.86,.5 L.86,.95 L.69,.95 L.44,.66 L.46,.86 L.46,.95 L.3,.95 L.3,.49 L.46,.49 L.71,.78 L.69,.565 L.69,.5', type: CustomGlyphVectorType.FILL } },
  // Lock
  '\u{E0A2}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.25,.94 C.16,.94,.11,.92,.11,.87 L.11,.53 C.11,.48,.15,.455,.23,.45 L.23,.3 C.23,.25,.26,.22,.31,.19 C.36,.16,.43,.15,.51,.15 C.59,.15,.66,.16,.71,.19 C.77,.22,.79,.26,.79,.3 L.79,.45 C.87,.45,.91,.48,.91,.53 L.91,.87 C.91,.92,.86,.94,.77,.94 L.24,.94 M.53,.2 C.49,.2,.45,.21,.42,.23 C.39,.25,.38,.27,.38,.3 L.38,.45 L.68,.45 L.68,.3 C.68,.27,.67,.25,.64,.23 C.61,.21,.58,.2,.53,.2 M.58,.82 L.58,.66 C.63,.65,.65,.63,.65,.6 C.65,.58,.64,.57,.61,.56 C.58,.55,.56,.54,.52,.54 C.48,.54,.46,.55,.43,.56 C.4,.57,.39,.59,.39,.6 C.39,.63,.41,.64,.46,.66 L.46,.82 L.57,.82', type: CustomGlyphVectorType.FILL } },
  // CN (Column Number)
  '\u{E0A3}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.7,.4 L.7,.47 L.2,.47 L.2,.03 L.7,.03 L.7,.1 L.355,.1 L.355,.4 L.705,.4 M.7,.5 L.86,.5 L.86,.95 L.69,.95 L.44,.66 L.46,.86 L.46,.95 L.3,.95 L.3,.49 L.46,.49 L.71,.78 L.69,.565 L.69,.5', type: CustomGlyphVectorType.FILL } },
  // Right triangle solid
  '\u{E0B0}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 L1,.5 L0,1', type: CustomGlyphVectorType.FILL, rightPadding: 2 } },
  // Right triangle line
  '\u{E0B1}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M-1,-.5 L1,.5 L-1,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 } },
  // Left triangle solid
  '\u{E0B2}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1,0 L0,.5 L1,1', type: CustomGlyphVectorType.FILL, leftPadding: 2 } },
  // Left triangle line
  '\u{E0B3}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M2,-.5 L0,.5 L2,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 } },

  // Powerline Extra Symbols

  // Right semi-circle solid
  '\u{E0B4}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 L0,1 C0.552,1,1,0.776,1,.5 C1,0.224,0.552,0,0,0', type: CustomGlyphVectorType.FILL, rightPadding: 1 } },
  // Right semi-circle line
  '\u{E0B5}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.2,1 C.422,1,.8,.826,.78,.5 C.8,.174,0.422,0,.2,0', type: CustomGlyphVectorType.STROKE, rightPadding: 1 } },
  // Left semi-circle solid
  '\u{E0B6}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1,0 L1,1 C0.448,1,0,0.776,0,.5 C0,0.224,0.448,0,1,0', type: CustomGlyphVectorType.FILL, leftPadding: 1 } },
  // Left semi-circle line
  '\u{E0B7}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.8,1 C0.578,1,0.2,.826,.22,.5 C0.2,0.174,0.578,0,0.8,0', type: CustomGlyphVectorType.STROKE, leftPadding: 1 } },
  // Lower left triangle
  '\u{E0B8}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M-.5,-.5 L1.5,1.5 L-.5,1.5', type: CustomGlyphVectorType.FILL } },
  // Backslash separator
  '\u{E0B9}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M-.5,-.5 L1.5,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 } },
  // Lower right triangle
  '\u{E0BA}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1.5,-.5 L-.5,1.5 L1.5,1.5', type: CustomGlyphVectorType.FILL } },
  // Forward slash separator redundant (identical to E0BD)
  '\u{E0BB}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1.5,-.5 L-.5,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 } },
  // Upper left triangle
  '\u{E0BC}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1.5,-.5 L-.5,1.5 L-.5,-.5', type: CustomGlyphVectorType.FILL } },
  // Forward slash separator
  '\u{E0BD}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1.5,-.5 L-.5,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 } },
  // Upper right triangle
  '\u{E0BE}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M-.5,-.5 L1.5,1.5 L1.5,-.5', type: CustomGlyphVectorType.FILL } },
  // Backslash separator redundant (identical to E0B9)
  '\u{E0BF}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M-.5,-.5 L1.5,1.5', type: CustomGlyphVectorType.STROKE, leftPadding: 1, rightPadding: 1 } },

  // #endregion

  // #region Symbols for Legacy Computing (1FB00-1FB3B)

  // https://www.unicode.org/charts/PDF/U1FB00.pdf

  // Block mosaic terminal graphic characters (1FB00-1FB3B)
  // The term "sextant" refers to block mosaics divided into six parts.
  '\u{1FB00}': sextant(0b000001), // BLOCK SEXTANT-1
  '\u{1FB01}': sextant(0b000010), // BLOCK SEXTANT-2
  '\u{1FB02}': sextant(0b000011), // BLOCK SEXTANT-12 (upper one third block)
  '\u{1FB03}': sextant(0b000100), // BLOCK SEXTANT-3
  '\u{1FB04}': sextant(0b000101), // BLOCK SEXTANT-13
  '\u{1FB05}': sextant(0b000110), // BLOCK SEXTANT-23
  '\u{1FB06}': sextant(0b000111), // BLOCK SEXTANT-123
  '\u{1FB07}': sextant(0b001000), // BLOCK SEXTANT-4
  '\u{1FB08}': sextant(0b001001), // BLOCK SEXTANT-14
  '\u{1FB09}': sextant(0b001010), // BLOCK SEXTANT-24
  '\u{1FB0A}': sextant(0b001011), // BLOCK SEXTANT-124
  '\u{1FB0B}': sextant(0b001100), // BLOCK SEXTANT-34 (middle one third block)
  '\u{1FB0C}': sextant(0b001101), // BLOCK SEXTANT-134
  '\u{1FB0D}': sextant(0b001110), // BLOCK SEXTANT-234
  '\u{1FB0E}': sextant(0b001111), // BLOCK SEXTANT-1234 (upper two thirds block)
  '\u{1FB0F}': sextant(0b010000), // BLOCK SEXTANT-5
  '\u{1FB10}': sextant(0b010001), // BLOCK SEXTANT-15
  '\u{1FB11}': sextant(0b010010), // BLOCK SEXTANT-25
  '\u{1FB12}': sextant(0b010011), // BLOCK SEXTANT-125
  '\u{1FB13}': sextant(0b010100), // BLOCK SEXTANT-35
  '\u{1FB14}': sextant(0b010110), // BLOCK SEXTANT-235
  '\u{1FB15}': sextant(0b010111), // BLOCK SEXTANT-1235
  '\u{1FB16}': sextant(0b011000), // BLOCK SEXTANT-45
  '\u{1FB17}': sextant(0b011001), // BLOCK SEXTANT-145
  '\u{1FB18}': sextant(0b011010), // BLOCK SEXTANT-245
  '\u{1FB19}': sextant(0b011011), // BLOCK SEXTANT-1245
  '\u{1FB1A}': sextant(0b011100), // BLOCK SEXTANT-345
  '\u{1FB1B}': sextant(0b011101), // BLOCK SEXTANT-1345
  '\u{1FB1C}': sextant(0b011110), // BLOCK SEXTANT-2345
  '\u{1FB1D}': sextant(0b011111), // BLOCK SEXTANT-12345
  '\u{1FB1E}': sextant(0b100000), // BLOCK SEXTANT-6
  '\u{1FB1F}': sextant(0b100001), // BLOCK SEXTANT-16
  '\u{1FB20}': sextant(0b100010), // BLOCK SEXTANT-26
  '\u{1FB21}': sextant(0b100011), // BLOCK SEXTANT-126
  '\u{1FB22}': sextant(0b100100), // BLOCK SEXTANT-36
  '\u{1FB23}': sextant(0b100101), // BLOCK SEXTANT-136
  '\u{1FB24}': sextant(0b100110), // BLOCK SEXTANT-236
  '\u{1FB25}': sextant(0b100111), // BLOCK SEXTANT-1236
  '\u{1FB26}': sextant(0b101000), // BLOCK SEXTANT-46
  '\u{1FB27}': sextant(0b101001), // BLOCK SEXTANT-146
  '\u{1FB28}': sextant(0b101011), // BLOCK SEXTANT-1246
  '\u{1FB29}': sextant(0b101100), // BLOCK SEXTANT-346
  '\u{1FB2A}': sextant(0b101101), // BLOCK SEXTANT-1346
  '\u{1FB2B}': sextant(0b101110), // BLOCK SEXTANT-2346
  '\u{1FB2C}': sextant(0b101111), // BLOCK SEXTANT-12346
  '\u{1FB2D}': sextant(0b110000), // BLOCK SEXTANT-56 (lower one third block)
  '\u{1FB2E}': sextant(0b110001), // BLOCK SEXTANT-156
  '\u{1FB2F}': sextant(0b110010), // BLOCK SEXTANT-256
  '\u{1FB30}': sextant(0b110011), // BLOCK SEXTANT-1256 (upper and lower one third block)
  '\u{1FB31}': sextant(0b110100), // BLOCK SEXTANT-356
  '\u{1FB32}': sextant(0b110101), // BLOCK SEXTANT-1356
  '\u{1FB33}': sextant(0b110110), // BLOCK SEXTANT-2356
  '\u{1FB34}': sextant(0b110111), // BLOCK SEXTANT-12356
  '\u{1FB35}': sextant(0b111000), // BLOCK SEXTANT-456
  '\u{1FB36}': sextant(0b111001), // BLOCK SEXTANT-1456
  '\u{1FB37}': sextant(0b111010), // BLOCK SEXTANT-2456
  '\u{1FB38}': sextant(0b111011), // BLOCK SEXTANT-12456
  '\u{1FB39}': sextant(0b111100), // BLOCK SEXTANT-3456 (lower two thirds block)
  '\u{1FB3A}': sextant(0b111101), // BLOCK SEXTANT-13456
  '\u{1FB3B}': sextant(0b111110), // BLOCK SEXTANT-23456

  // Smooth mosaic terminal graphic characters (1FB3C-1FB6F)
  '\u{1FB3C}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L0,1 L0.5,1 Z' },           // LOWER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER CENTRE
  '\u{1FB3D}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L0,1 L1,1 Z' },             // LOWER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER RIGHT
  '\u{1FB3E}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L0,1 L0.5,1 Z' },           // LOWER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER CENTRE
  '\u{1FB3F}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L0,1 L1,1 Z' },             // LOWER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER RIGHT
  '\u{1FB40}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L0,1 L0.5,1 Z' },                // LOWER LEFT BLOCK DIAGONAL UPPER LEFT TO LOWER CENTRE
  '\u{1FB41}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L0.5,0 L1,0 L1,1 L0,1 Z' }, // LOWER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER CENTRE
  '\u{1FB42}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L1,0 L1,1 L0,1 Z' },        // LOWER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER RIGHT
  '\u{1FB43}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L0.5,0 L1,0 L1,1 L0,1 Z' }, // LOWER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER CENTRE
  '\u{1FB44}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L1,0 L1,1 L0,1 Z' },        // LOWER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER RIGHT
  '\u{1FB45}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,1 L0.5,0 L1,0 L1,1 Z' },           // LOWER RIGHT BLOCK DIAGONAL LOWER LEFT TO UPPER CENTRE
  '\u{1FB46}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L1,0.3333 L1,1 L0,1 Z' },   // LOWER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB47}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,1 L1,0.6667 L1,1 Z' },           // LOWER RIGHT BLOCK DIAGONAL LOWER CENTRE TO LOWER MIDDLE RIGHT
  '\u{1FB48}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,1 L1,0.6667 L1,1 Z' },             // LOWER RIGHT BLOCK DIAGONAL LOWER LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB49}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,1 L1,0.3333 L1,1 Z' },           // LOWER RIGHT BLOCK DIAGONAL LOWER CENTRE TO UPPER MIDDLE RIGHT
  '\u{1FB4A}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,1 L1,0.3333 L1,1 Z' },             // LOWER RIGHT BLOCK DIAGONAL LOWER LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB4B}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,1 L1,0 L1,1 Z' },                // LOWER RIGHT BLOCK DIAGONAL LOWER CENTRE TO UPPER RIGHT
  '\u{1FB4C}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,0 L0,0 L0,1 L1,1 L1,0.3333 Z' }, // LOWER LEFT BLOCK DIAGONAL UPPER CENTRE TO UPPER MIDDLE RIGHT
  '\u{1FB4D}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L0,1 L1,1 L1,0.3333 Z' },        // LOWER LEFT BLOCK DIAGONAL UPPER LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB4E}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,0 L0,0 L0,1 L1,1 L1,0.6667 Z' }, // LOWER LEFT BLOCK DIAGONAL UPPER CENTRE TO LOWER MIDDLE RIGHT
  '\u{1FB4F}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L0,1 L1,1 L1,0.6667 Z' },        // LOWER LEFT BLOCK DIAGONAL UPPER LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB50}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,0 L0,0 L0,1 L1,1 Z' },           // LOWER LEFT BLOCK DIAGONAL UPPER CENTRE TO LOWER RIGHT
  '\u{1FB51}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L0,1 L1,1 L1,0.6667 Z' },   // LOWER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB52}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L0.5,1 L1,1 L1,0 L0,0 Z' }, // UPPER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER CENTRE
  '\u{1FB53}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L1,1 L1,0 L0,0 Z' },        // UPPER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER RIGHT
  '\u{1FB54}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L0.5,1 L1,1 L1,0 L0,0 Z' }, // UPPER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER CENTRE
  '\u{1FB55}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L1,1 L1,0 L0,0 Z' },        // UPPER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER RIGHT
  '\u{1FB56}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L0.5,1 L1,1 L1,0 Z' },           // UPPER RIGHT BLOCK DIAGONAL UPPER LEFT TO LOWER CENTRE
  '\u{1FB57}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L0,0 L0.5,0 Z' },           // UPPER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER CENTRE
  '\u{1FB58}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L0,0 L1,0 Z' },             // UPPER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER RIGHT
  '\u{1FB59}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L0,0 L0.5,0 Z' },           // UPPER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER CENTRE
  '\u{1FB5A}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L0,0 L1,0 Z' },             // UPPER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER RIGHT
  '\u{1FB5B}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,1 L0,0 L0.5,0 Z' },                // UPPER LEFT BLOCK DIAGONAL LOWER LEFT TO UPPER CENTRE
  '\u{1FB5C}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.6667 L0,0 L1,0 L1,0.3333 Z' },   // UPPER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB5D}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,1 L0,1 L0,0 L1,0 L1,0.6667 Z' }, // UPPER LEFT BLOCK DIAGONAL LOWER CENTRE TO LOWER MIDDLE RIGHT
  '\u{1FB5E}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,1 L0,0 L1,0 L1,0.6667 Z' },        // UPPER LEFT BLOCK DIAGONAL LOWER LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB5F}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,1 L0,1 L0,0 L1,0 L1,0.3333 Z' }, // UPPER LEFT BLOCK DIAGONAL LOWER CENTRE TO UPPER MIDDLE RIGHT
  '\u{1FB60}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,1 L0,0 L1,0 L1,0.3333 Z' },        // UPPER LEFT BLOCK DIAGONAL LOWER LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB61}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,1 L0,1 L0,0 L1,0 Z' },           // UPPER LEFT BLOCK DIAGONAL LOWER CENTRE TO UPPER RIGHT
  '\u{1FB62}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,0 L1,0 L1,0.3333 Z' },           // UPPER RIGHT BLOCK DIAGONAL UPPER CENTRE TO UPPER MIDDLE RIGHT
  '\u{1FB63}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L1,0 L1,0.3333 Z' },             // UPPER RIGHT BLOCK DIAGONAL UPPER LEFT TO UPPER MIDDLE RIGHT
  '\u{1FB64}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,0 L1,0 L1,0.6667 Z' },           // UPPER RIGHT BLOCK DIAGONAL UPPER CENTRE TO LOWER MIDDLE RIGHT
  '\u{1FB65}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L1,0 L1,0.6667 Z' },             // UPPER RIGHT BLOCK DIAGONAL UPPER LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB66}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.5,0 L1,0 L1,1 Z' },                // UPPER RIGHT BLOCK DIAGONAL UPPER CENTRE TO LOWER RIGHT
  '\u{1FB67}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.3333 L1,0.6667 L1,0 L0,0 Z' },   // UPPER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER MIDDLE RIGHT
  '\u{1FB68}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L1,0 L1,1 L0,1 L0.5,0.5 Z' },    // UPPER AND RIGHT AND LOWER TRIANGULAR THREE QUARTERS BLOCK (missing left)
  '\u{1FB69}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L0.5,0.5 L1,0 L1,1 L0,1 Z' },    // LEFT AND LOWER AND RIGHT TRIANGULAR THREE QUARTERS BLOCK (missing upper)
  '\u{1FB6A}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L1,0 L0.5,0.5 L1,1 L0,1 Z' },    // UPPER AND LEFT AND LOWER TRIANGULAR THREE QUARTERS BLOCK (missing right)
  '\u{1FB6B}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L1,0 L1,1 L0.5,0.5 L0,1 Z' },    // LEFT AND UPPER AND RIGHT TRIANGULAR THREE QUARTERS BLOCK (missing lower)
  '\u{1FB6C}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L0.5,0.5 L0,1 Z' },              // LEFT TRIANGULAR ONE QUARTER BLOCK
  '\u{1FB6D}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L1,0 L0.5,0.5 Z' },              // UPPER TRIANGULAR ONE QUARTER BLOCK
  '\u{1FB6E}': { type: CustomGlyphDefinitionType.PATH, data: 'M1,0 L1,1 L0.5,0.5 Z' },              // RIGHT TRIANGULAR ONE QUARTER BLOCK
  '\u{1FB6F}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,1 L1,1 L0.5,0.5 Z' },              // LOWER TRIANGULAR ONE QUARTER BLOCK

  // Block elements (1FB70-1FB80)
  '\u{1FB70}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 1, y: 0, w: 1, h: 8 }] },                             // VERTICAL ONE EIGHTH BLOCK-2
  '\u{1FB71}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 2, y: 0, w: 1, h: 8 }] },                             // VERTICAL ONE EIGHTH BLOCK-3
  '\u{1FB72}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 3, y: 0, w: 1, h: 8 }] },                             // VERTICAL ONE EIGHTH BLOCK-4
  '\u{1FB73}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 4, y: 0, w: 1, h: 8 }] },                             // VERTICAL ONE EIGHTH BLOCK-5
  '\u{1FB74}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 5, y: 0, w: 1, h: 8 }] },                             // VERTICAL ONE EIGHTH BLOCK-6
  '\u{1FB75}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 6, y: 0, w: 1, h: 8 }] },                             // VERTICAL ONE EIGHTH BLOCK-7
  '\u{1FB76}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 1, w: 8, h: 1 }] },                             // HORIZONTAL ONE EIGHTH BLOCK-2
  '\u{1FB77}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 2, w: 8, h: 1 }] },                             // HORIZONTAL ONE EIGHTH BLOCK-3
  '\u{1FB78}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 3, w: 8, h: 1 }] },                             // HORIZONTAL ONE EIGHTH BLOCK-4
  '\u{1FB79}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 4, w: 8, h: 1 }] },                             // HORIZONTAL ONE EIGHTH BLOCK-5
  '\u{1FB7A}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 5, w: 8, h: 1 }] },                             // HORIZONTAL ONE EIGHTH BLOCK-6
  '\u{1FB7B}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 6, w: 8, h: 1 }] },                             // HORIZONTAL ONE EIGHTH BLOCK-7
  '\u{1FB7C}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 1, h: 8 }, { x: 0, y: 7, w: 8, h: 1 }] }, // LEFT AND LOWER ONE EIGHTH BLOCK
  '\u{1FB7D}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 1, h: 8 }, { x: 0, y: 0, w: 8, h: 1 }] }, // LEFT AND UPPER ONE EIGHTH BLOCK
  '\u{1FB7E}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 7, y: 0, w: 1, h: 8 }, { x: 0, y: 0, w: 8, h: 1 }] }, // RIGHT AND UPPER ONE EIGHTH BLOCK
  '\u{1FB7F}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 7, y: 0, w: 1, h: 8 }, { x: 0, y: 7, w: 8, h: 1 }] }, // RIGHT AND LOWER ONE EIGHTH BLOCK
  '\u{1FB80}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 1 }, { x: 0, y: 7, w: 8, h: 1 }] }, // UPPER AND LOWER ONE EIGHTH BLOCK

  // Window title bar (1FB81-1FB81)
  '\u{1FB81}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 1 }, { x: 0, y: 2, w: 8, h: 1 }, { x: 0, y: 4, w: 8, h: 1 }, { x: 0, y: 7, w: 8, h: 1 }] }, // HORIZONTAL ONE EIGHTH BLOCK-1358

  // Block elements (1FB82-1FB8B)
  '\u{1FB82}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 2 }] }, // UPPER ONE QUARTER BLOCK
  '\u{1FB83}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 3 }] }, // UPPER THREE EIGHTHS BLOCK
  '\u{1FB84}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 5 }] }, // UPPER FIVE EIGHTHS BLOCK
  '\u{1FB85}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 6 }] }, // UPPER THREE QUARTERS BLOCK
  '\u{1FB86}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 7 }] }, // UPPER SEVEN EIGHTHS BLOCK
  '\u{1FB87}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 6, y: 0, w: 2, h: 8 }] }, // RIGHT ONE QUARTER BLOCK
  '\u{1FB88}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 5, y: 0, w: 3, h: 8 }] }, // RIGHT THREE EIGHTHS B0OCK
  '\u{1FB89}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 3, y: 0, w: 5, h: 8 }] }, // RIGHT FIVE EIGHTHS BL0CK
  '\u{1FB8A}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 2, y: 0, w: 6, h: 8 }] }, // RIGHT THREE QUARTERS 0LOCK
  '\u{1FB8B}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 1, y: 0, w: 7, h: 8 }] }, // RIGHT SEVEN EIGHTHS B0OCK

  // Rectangular shade characters (1FB8C-1FB94)
  '\u{1FB8C}': { type: CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION, data: [[ // LEFT HALF MEDIUM SHADE
    [1, 0],
    [0, 1]
  ], [0, 0, 0.5, 1]] },
  '\u{1FB8D}': { type: CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION, data: [[  // RIGHT HALF MEDIUM SHADE
    [1, 0],
    [0, 1]
  ], [0.5, 0, 0.5, 1]] },
  '\u{1FB8E}': { type: CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION, data: [[  // UPPER HALF MEDIUM SHADE
    [1, 0],
    [0, 1]
  ], [0, 0, 1, 0.5]] },
  '\u{1FB8F}': { type: CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION, data: [[  // LOWER HALF MEDIUM SHADE
    [1, 0],
    [0, 1]
  ], [0, 0.5, 1, 0.5]] },
  '\u{1FB90}': { type: CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION, data: [[  // INVERSE MEDIUM SHADE
    [0, 1],
    [1, 0]
  ], [0, 0, 1, 1]] },
  '\u{1FB91}': [ // UPPER HALF BLOCK AND LOWER HALF INVERSE MEDIUM SHADE
    { type: CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION, data: [[
      [0, 1],
      [1, 0]
    ], [0, 0.5, 1, 0.5]] },
    { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 0, w: 8, h: 4 }] }
  ],
  '\u{1FB92}': [ // UPPER HALF INVERSE MEDIUM SHADE AND LOWER HALF BLOCK
    { type: CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION, data: [[
      [0, 1],
      [1, 0]
    ], [0, 0, 1, 0.5]] },
    { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 4, w: 8, h: 4 }] }
  ],
  // 1FB93 is <reserved>
  '\u{1FB94}': [ // LEFT HALF INVERSE MEDIUM SHADE AND RIGHT HALF BLOCK
    { type: CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION, data: [[
      [0, 1],
      [1, 0]
    ], [0, 0, 0.5, 1]] },
    { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 4, y: 0, w: 4, h: 8 }] }
  ],

  // Fill characters (1FB95-1FB97)
  '\u{1FB95}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [ // CHECKER BOARD FILL
    { x: 0, y: 0, w: 2, h: 2 }, { x: 4, y: 0, w: 2, h: 2 },
    { x: 2, y: 2, w: 2, h: 2 }, { x: 6, y: 2, w: 2, h: 2 },
    { x: 0, y: 4, w: 2, h: 2 }, { x: 4, y: 4, w: 2, h: 2 },
    { x: 2, y: 6, w: 2, h: 2 }, { x: 6, y: 6, w: 2, h: 2 }
  ] },
  '\u{1FB96}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [ // INVERSE CHECKER BOARD FILL
    { x: 2, y: 0, w: 2, h: 2 }, { x: 6, y: 0, w: 2, h: 2 },
    { x: 0, y: 2, w: 2, h: 2 }, { x: 4, y: 2, w: 2, h: 2 },
    { x: 2, y: 4, w: 2, h: 2 }, { x: 6, y: 4, w: 2, h: 2 },
    { x: 0, y: 6, w: 2, h: 2 }, { x: 4, y: 6, w: 2, h: 2 }
  ] },
  '\u{1FB97}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [ // HEAVY HORIZONTAL FILL (upper middle and lower one quarter block)
    { x: 0, y: 2, w: 8, h: 2 }, { x: 0, y: 6, w: 8, h: 2 }
  ] },

  // Diagonal fill characters (1FB98-1FB99)
  '\u{1FB98}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,0 L1,1 M0,.25 L.75,1 M0,.5 L.5,1 M0,.75 L.25,1 M.25,0 L1,.75 M.5,0 L1,.5 M.75,0 L1,.25' } }, // UPPER LEFT TO LOWER RIGHT FILL
  '\u{1FB99}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,.25 L.25,0 M0,.5 L.5,0 M0,.75 L.75,0 M0,1 L1,0 M.25,1 L1,.25 M.5,1 L1,.5 M.75,1 L1,.75' } }, // UPPER RIGHT TO LOWER LEFT FILL

  // Smooth mosaic terminal graphic characters (1FB9A-1FB9B)
  '\u{1FB9A}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 L.5,.5 L0,1 L1,1 L.5,.5 L1,0', type: CustomGlyphVectorType.FILL } }, // UPPER AND LOWER TRIANGULAR HALF BLOCK
  '\u{1FB9B}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 L.5,.5 L1,0 L1,1 L.5,.5 L0,1', type: CustomGlyphVectorType.FILL } }, // LEFT AND RIGHT TRIANGULAR HALF BLOCK

  // Triangular shade characters (1FB9C-1FB9F)
  '\u{1FB9C}': { type: CustomGlyphDefinitionType.BLOCK_PATTERN, data: [ // UPPER LEFT TRIANGULAR MEDIUM SHADE
    [1, 0],
    [0, 1]
  ], clipPath: 'M0,0 L1,0 L0,1 Z' },
  '\u{1FB9D}': { type: CustomGlyphDefinitionType.BLOCK_PATTERN, data: [ // UPPER RIGHT TRIANGULAR MEDIUM SHADE
    [1, 0],
    [0, 1]
  ], clipPath: 'M0,0 L1,0 L1,1 Z' },
  '\u{1FB9E}': { type: CustomGlyphDefinitionType.BLOCK_PATTERN, data: [ // LOWER RIGHT TRIANGULAR MEDIUM SHADE
    [1, 0],
    [0, 1]
  ], clipPath: 'M1,0 L1,1 L0,1 Z' },
  '\u{1FB9F}': { type: CustomGlyphDefinitionType.BLOCK_PATTERN, data: [ // LOWER LEFT TRIANGULAR MEDIUM SHADE
    [1, 0],
    [0, 1]
  ], clipPath: 'M0,0 L1,1 L0,1 Z' },

  // Character cell diagonals (1FBA0-1FBAE)
  '\u{1FBA0}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L0,.5' } },               // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE LEFT
  '\u{1FBA1}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L1,.5' } },               // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE RIGHT
  '\u{1FBA2}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,.5 L.5,1' } },               // BOX DRAWINGS LIGHT DIAGONAL MIDDLE LEFT TO LOWER CENTRE
  '\u{1FBA3}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M1,.5 L.5,1' } },               // BOX DRAWINGS LIGHT DIAGONAL MIDDLE RIGHT TO LOWER CENTRE
  '\u{1FBA4}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L0,.5 L.5,1' } },         // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE LEFT TO LOWER CENTRE
  '\u{1FBA5}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L1,.5 L.5,1' } },         // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE RIGHT TO LOWER CENTRE
  '\u{1FBA6}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,.5 L.5,1 L1,.5' } },         // BOX DRAWINGS LIGHT DIAGONAL MIDDLE LEFT TO LOWER CENTRE TO MIDDLE RIGHT
  '\u{1FBA7}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,.5 L.5,0 L1,.5' } },         // BOX DRAWINGS LIGHT DIAGONAL MIDDLE LEFT TO UPPER CENTRE TO MIDDLE RIGHT
  '\u{1FBA8}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L0,.5 M1,.5 L.5,1' } },   // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE LEFT AND MIDDLE RIGHT TO LOWER CENTRE
  '\u{1FBA9}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L1,.5 M0,.5 L.5,1' } },   // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE RIGHT AND MIDDLE LEFT TO LOWER CENTRE
  '\u{1FBAA}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L1,.5 L.5,1 L0,.5' } },   // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE RIGHT TO LOWER CENTRE TO MIDDLE LEFT
  '\u{1FBAB}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L0,.5 L.5,1 L1,.5' } },   // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE LEFT TO LOWER CENTRE TO MIDDLE RIGHT
  '\u{1FBAC}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,.5 L.5,0 L1,.5 L.5,1' } },   // BOX DRAWINGS LIGHT DIAGONAL MIDDLE LEFT TO UPPER CENTRE TO MIDDLE RIGHT TO LOWER CENTRE
  '\u{1FBAD}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M1,.5 L.5,0 L0,.5 L.5,1' } },   // BOX DRAWINGS LIGHT DIAGONAL MIDDLE RIGHT TO UPPER CENTRE TO MIDDLE LEFT TO LOWER CENTRE
  '\u{1FBAE}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L1,.5 L.5,1 L0,.5 Z' } }, // BOX DRAWINGS LIGHT DIAGONAL DIAMOND

  // Light solid line with stroke (1FBAF-1FBAF)
  '\u{1FBAF}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: `${Shapes.LEFT_TO_RIGHT} M.5,.35 L.5,.65` } }, // BOX DRAWINGS LIGHT HORIZONTAL WITH VERTICAL STROKE

  // Terminal graphic characters (1FBB0-1FBB3)
  '\u{1FBB0}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.1,0.2 L0.1,.8 L.4,.6 L.9,0.6 Z' },                                           // ARROWHEAD-SHAPED POINTER
  '\u{1FBB1}': { type: CustomGlyphDefinitionType.PATH_NEGATIVE, data: { d: 'M.1,.55 L.35,.85 L.9,.2', type: CustomGlyphVectorType.STROKE } }, // INVERSE CHECK MARK
  '\u{1FBB2}': { type: CustomGlyphDefinitionType.PATH, data: 'M.29,.27 L0.13,.56 L.22,.59 L.35,0.35 L.67,.35 L.57,.57 L.71,.76 L.22,.76 L.42,1 L.53,.98 L.43,.86 L.9,.86 L.71,.6 L1,.6 L1,.52 L.83,.52 L.92,.36 L1,.36 L1,.27Z M.99,.13 A.12,.12,0,1,1,.75,.13 A.12,.12,0,1,1,.99,.13' }, // LEFT HALF RUNNING MAN
  '\u{1FBB3}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,.27 L.3,.27 L.55,.12 L.63,.18 L.33,.36 L0,.36 M0,.52 L.33,.52 L.59,.89 L.73,.89 L.73,.98 L.53,.98 L.28,.6 L0,.6' },                                                                                                      // RIGHT HALF RUNNING MAN

  // Arrows (1FBB4-1FBB8)
  '\u{1FBB4}': { type: CustomGlyphDefinitionType.PATH_NEGATIVE, data: { d: 'M.15,.6 L.5,.4 L.5,.5 L.75,.5 L.75,.2 L.85,.2 L.85,.7 L.5,.7 L.5,.8 Z', type: CustomGlyphVectorType.FILL } },                                        // INVERSE DOWNWARDS ARROW WITH TIP LEFTWARDS
  '\u{1FBB5}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 L1,0 L1,.125 L0,.125 Z M0,.875 L1,.875 L1,1 L0,1 Z M.15,.5 L.5,.3 L.5,.4 L.85,.4 L.85,.6 L.5,.6 L.5,.7 Z', type: CustomGlyphVectorType.FILL } }, // LEFTWARDS ARROW AND UPPER AND LOWER ONE EIGHTH BLOCK
  '\u{1FBB6}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 L1,0 L1,.125 L0,.125 Z M0,.875 L1,.875 L1,1 L0,1 Z M.85,.5 L.5,.3 L.5,.4 L.15,.4 L.15,.6 L.5,.6 L.5,.7 Z', type: CustomGlyphVectorType.FILL } }, // RIGHTWARDS ARROW AND UPPER AND LOWER ONE EIGHTH BLOCK
  '\u{1FBB7}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.875,0 L1,0 L1,1 L.875,1 Z M.5,.85 L.3,.5 L.4,.5 L.4,.15 L.6,.15 L.6,.5 L.7,.5 Z', type: CustomGlyphVectorType.FILL } },                             // DOWNWARDS ARROW AND RIGHT ONE EIGHTH BLOCK
  '\u{1FBB8}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.875,0 L1,0 L1,1 L.875,1 Z M.5,.15 L.3,.5 L.4,.5 L.4,.85 L.6,.85 L.6,.5 L.7,.5 Z', type: CustomGlyphVectorType.FILL } },                             // UPWARDS ARROW AND RIGHT ONE EIGHTH BLOCK

  // Terminal graphic characters (1FBB9-1FBBC)
  '\u{1FBB9}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1,.89 L.11,.89 L.11,.37 L.36,.12 L.74,.12 L.96,.34 L1,.34 L1,.45 L.92,.45 L.69,.22 L.41,.22 L.21,.42 L.21,.79 L1,.79 Z', type: CustomGlyphVectorType.FILL } }, // LEFT HALF FOLDER
  '\u{1FBBA}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,.89 L0,.79 L.78,.79 L.78,.53 L.7,.45 L0,.45 L0,.35 L.75,.35 L.88,.48 L.88,.89 Z', type: CustomGlyphVectorType.FILL } }, // RIGHT HALF FOLDER
  '\u{1FBBB}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.31,.05 L.44,.05 L.44,.44 L.05,.44 L.05,.31 L.31,.31 Z M.56,.05 L.69,.05 L.69,.31 L.95,.31 L.95,.44 L.56,.44 Z M.05,.56 L.44,.56 L.44,.95 L.31,.95 L.31,.69 L.05,.69 Z M.56,.56 L.95,.56 L.95,.69 L.69,.69 L.69,.95 L.56,.95 Z', type: CustomGlyphVectorType.FILL } }, // VOIDED GREEK CROSS
  '\u{1FBBC}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L1,0 L1,1 L0,1 L0,.87 L.87,.87 L.87,.13 L0,.13 Z M.67,.5 A.17,.17,0,1,1,.33,.5 A.17,.17,0,1,1,.67,.5' }, // RIGHT OPEN SQUARED DOT

  // Negative terminal graphic characters (1FBBD-1FBBF)
  '\u{1FBBD}': { type: CustomGlyphDefinitionType.PATH_NEGATIVE, data: { d: 'M0,0 L.5,.5 L1,0 L1,1 L.5,.5 L0,1 Z', type: CustomGlyphVectorType.STROKE } }, // NEGATIVE DIAGONAL CROSS
  '\u{1FBBE}': { type: CustomGlyphDefinitionType.PATH_NEGATIVE, data: { d: 'M1,.5 L.5,1', type: CustomGlyphVectorType.STROKE } },                         // NEGATIVE DIAGONAL MIDDLE RIGHT TO LOWER CENTRE
  '\u{1FBBF}': { type: CustomGlyphDefinitionType.PATH_NEGATIVE, data: { d: 'M.5,0 L1,.5 L.5,1 L0,.5 Z', type: CustomGlyphVectorType.STROKE } },           // NEGATIVE DIAGONAL DIAMOND

  // Terminal graphic characters (1FBC0-1FBCA)
  '\u{1FBC0}': { type: CustomGlyphDefinitionType.PATH, data: 'M.16,.39 A.02,.02,0,0,1,.39,.16 L.5,.25 L.61,.16 A.02,.02,0,0,1,.84,.39 L.75,.5 L.84,.61 A.02,.02,0,0,1,.61,.84 L.5,.75 L.39,.84 A.02,.02,0,0,1,.16,.61 L.25,.5 Z M.24,.32 L.39,.5 L.24,.68 L.32,.76 L.5,.61 L.68,.76 L.76,.68 L.61,.5 L.76,.32 L.68,.24 L.5,.39 L.32,.24 Z' }, // WHITE HEAVY SALTIRE WITH ROUNDED CORNERS
  // 1FBC1-1FBC4 is dervied from the Iosevka font (SIL OFL v1.1) https://github.com/be5invis/Iosevka
  '\u{1FBC1}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.142308,0.924 Q0.130770,0.924,0.120193,0.922 T0.101924,0.916 T0.089424,0.9065 T0.084616,0.895 V0.025 Q0.084616,0.019,0.089424,0.0135 T0.101924,0.004 T0.120193,-0.002 T0.142308,-0.004 Q0.150000,-0.004,0.157693,-0.003 T0.173078,0.000 L0.430770,0.085 Q0.451924,0.059,0.494232,0.041 T0.587501,0.013 T0.692309,-0.0005 T0.800001,-0.004 H1 V0.055 H0.800001 Q0.771155,0.055,0.742309,0.056 T0.685578,0.060 T0.630770,0.0685 T0.580770,0.0825 T0.543270,0.1045 T0.528847,0.133 V0.647 H0.530770 Q0.596155,0.645,0.659616,0.638 T0.782693,0.6165 T0.893270,0.5805 T1,0.531 V0.623 Q0.934616,0.644,0.880770,0.6595 T0.769232,0.685 T0.650963,0.700 T0.528847,0.707 V0.787 Q0.528847,0.802,0.543270,0.8155 T0.580770,0.8375 T0.630770,0.8515 T0.685578,0.860 T0.742309,0.864 T0.800001,0.865 H1 V0.924 H0.800001 Q0.746155,0.924,0.692309,0.9205 T0.587501,0.907 T0.494232,0.879 T0.430770,0.835 L0.173078,0.920 Q0.165386,0.922,0.157693,0.923 T0.142308,0.924 Z M0.2,0.841 L0.415385,0.770 V0.150 L0.2,0.079 V0.841 Z M1,0.698 Q0.973077,0.694,0.969231,0.6885 T0.965385,0.677 Q0.965385,0.672,0.969231,0.6665 T1,0.657 V0.698 Z' }, // LEFT THIRD WHITE RIGHT POINTING INDEX
  '\u{1FBC2}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.623 V0.531 Q0.044231,0.512,0.0625,0.4905 T0.092308,0.4465 T0.108654,0.4005 T0.113462,0.354 V0.351 Q0.113462,0.345,0.117308,0.3395 T0.129808,0.3305 T0.148846,0.3245 T0.171154,0.323 H0.501923 Q0.532692,0.323,0.563462,0.3185 T0.617308,0.303 T0.651923,0.2765 T0.663462,0.2435 V0.241 Q0.663462,0.219,0.657692,0.197 T0.639423,0.1545 T0.604808,0.115 T0.549615,0.082 T0.475577,0.0615 T0.392308,0.055 H0 V-0.004 H1 V0.055 H0.667308 Q0.694231,0.071,0.713462,0.09 T0.746154,0.129 T0.766346,0.1705 T0.775,0.213 H1 V0.316 Q0.971154,0.305,0.955769,0.2965 T0.920192,0.2825 T0.876923,0.2745 T0.830769,0.272 H0.773077 Q0.767308,0.297,0.743269,0.319 T0.680769,0.355 T0.595192,0.375 T0.501923,0.381 H0.227308 Q0.223462,0.415,0.211,0.4485 T0.172692,0.5135 T0.108269,0.573 T0,0.623 Z M0.611538,0.924 H0 V0.865 H0.611538 Q0.642308,0.865,0.673077,0.8605 T0.727885,0.845 T0.762308,0.8185 T0.773077,0.787 V0.785 Q0.773077,0.769,0.762308,0.7535 T0.727885,0.727 T0.673077,0.7115 T0.611538,0.707 H0.059615 Q0.048077,0.707,0.037115,0.7045 T0,0.694 V0.653 Q0.026923,0.648,0.037115,0.646 T0.059615,0.644 H0.722692 Q0.753462,0.644,0.784231,0.6395 T0.839038,0.624 T0.873846,0.5975 T0.884615,0.566 V0.564 Q0.884615,0.548,0.873846,0.532 T0.839038,0.5055 T0.784231,0.49 T0.722692,0.4855 H0.392308 Q0.380769,0.4855,0.370192,0.483 T0.351923,0.4765 T0.339423,0.467 T0.334615,0.4555 T0.339423,0.444 T0.351923,0.4345 T0.370192,0.428 T0.392308,0.4255 H0.832692 Q0.855769,0.4255,0.878846,0.4235 T0.922115,0.416 T0.957692,0.4015 T1,0.3815 V0.4685 Q0.975,0.4705,0.966346,0.4725 T0.95,0.4765 Q0.961538,0.4835,0.969231,0.4915 T1,0.5075 V0.6205 Q0.965385,0.6455,0.926923,0.665 T0.84,0.6935 Q0.866923,0.7115,0.877596,0.7345 T0.894231,0.7855 V0.787 Q0.894231,0.815,0.876923,0.8425 T0.820192,0.8895 T0.726923,0.916 T0.611538,0.924 Z' }, // MIDDLE THIRD WHITE RIGHT POINTING INDEX
  '\u{1FBC3}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0.473 V0.386 Q0.025490,0.378,0.028431,0.3695 T0.031373,0.352 V0.35 Q0.031373,0.342,0.028431,0.333 T0,0.316 V0.213 H0.652941 Q0.684314,0.213,0.715686,0.2085 T0.770588,0.193 T0.804902,0.1665 T0.815686,0.135 V0.133 Q0.815686,0.117,0.804902,0.101 T0.770588,0.0745 T0.715686,0.0595 T0.652941,0.055 H0 V-0.004 H0.652941 Q0.707843,-0.004,0.761765,0.004 T0.856863,0.031 T0.915686,0.0775 T0.933333,0.133 V0.135 Q0.933333,0.163,0.915686,0.1905 T0.856863,0.237 T0.761765,0.264 T0.652941,0.272 H0.109804 Q0.131373,0.29,0.140196,0.31 T0.149020,0.35 V0.352 Q0.149020,0.37,0.142157,0.388 T0.118627,0.4225 T0.076471,0.452 T0,0.473 Z M0,0.625 V0.513 Q0.029412,0.526,0.032353,0.54 T0.035294,0.568 V0.57 Q0.035294,0.584,0.032353,0.598 T0,0.625 Z' }, // RIGHT THIRD WHITE RIGHT POINTING INDEX
  '\u{1FBC4}': { type: CustomGlyphDefinitionType.PATH, data: 'M0.019231,1.085 V-0.165 H0.980769 V1.085 H0.019231 Z M0.446154,0.527 H0.553846 Q0.553846,0.511,0.5625,0.495 T0.591346,0.466 T0.631731,0.4405 T0.666346,0.4135 T0.688462,0.3825 T0.696154,0.35 Q0.696154,0.33,0.682692,0.311 T0.641346,0.2785 T0.575,0.259 T0.498077,0.253 T0.421154,0.259 T0.356731,0.279 T0.315385,0.3125 T0.301923,0.352 V0.357 H0.409615 V0.354 Q0.409615,0.345,0.414423,0.335 T0.431731,0.318 T0.4625,0.3075 T0.498077,0.304 Q0.517308,0.304,0.534615,0.307 T0.564423,0.3165 T0.582692,0.332 T0.588462,0.35 Q0.588462,0.366,0.572115,0.3805 T0.535577,0.4075 T0.496154,0.4335 T0.465385,0.4625 T0.45,0.4945 T0.446154,0.527 Z M0.5,0.667 Q0.519231,0.667,0.5375,0.664 T0.569231,0.654 T0.588462,0.637 T0.594231,0.617 T0.588462,0.5975 T0.569231,0.581 T0.5375,0.571 T0.5,0.568 T0.4625,0.571 T0.430769,0.581 T0.411538,0.5975 T0.405769,0.617 T0.411538,0.637 T0.430769,0.654 T0.4625,0.664 T0.5,0.667 Z' }, // NEGATIVE SQUARED QUESTION MARK
  '\u{1FBC5}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.44,.35 L.44,.52 L.44,.62 L.19,.87 L.26,.94 L.5,.71 L.74,.94 L.81,.87 L.56,.62 L.56,.52 L.56,.35 Z M.17,.42 L.17,.52 L.83,.52 L.83,.42 Z M.67,.2 C.67,.106,.594,.03,.5,.03 C.406,.03,.33,.106,.33,.2 C.33,.294,.406,.37,.5,.37 C.594,.37,.67,.294,.67,.2 Z M.56,.2 C.56,.233,.533,.26,.5,.26 C.467,.26,.44,.233,.44,.2 C.44,.167,.467,.14,.5,.14 C.533,.14,.56,.167,.56,.2 Z', type: CustomGlyphVectorType.FILL } }, // STICK FIGURE
  '\u{1FBC6}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.44,.35 L.44,.42 L.23,.27 L.19,.36 L.44,.52 L.44,.62 L.29,.92 L.38,.97 L.5,.71 L.61,.97 L.7,.92 L.56,.62 L.56,.52 L.81,.36 L.77,.27 L.56,.42 L.56,.35 Z M.67,.2 C.67,.106,.594,.03,.5,.03 C.406,.03,.33,.106,.33,.2 C.33,.294,.406,.37,.5,.37 C.594,.37,.67,.294,.67,.2 Z M.56,.2 C.56,.233,.533,.26,.5,.26 C.467,.26,.44,.233,.44,.2 C.44,.167,.467,.14,.5,.14 C.533,.14,.56,.167,.56,.2 Z', type: CustomGlyphVectorType.FILL } }, // STICK FIGURE WITH ARMS RAISED
  '\u{1FBC7}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.44,.35 L.44,.62 L.29,.92 L.38,.97 L.5,.71 L.74,.94 L.81,.87 L.56,.62 L.56,.35 Z M.18,.56 L.23,.65 L.81,.36 L.77,.27 Z M.67,.2 C.67,.106,.594,.03,.5,.03 C.406,.03,.33,.106,.33,.2 C.33,.294,.406,.37,.5,.37 C.594,.37,.67,.294,.67,.2 Z M.56,.2 C.56,.233,.533,.26,.5,.26 C.467,.26,.44,.233,.44,.2 C.44,.167,.467,.14,.5,.14 C.533,.14,.56,.167,.56,.2 Z', type: CustomGlyphVectorType.FILL } }, // STICK FIGURE LEANING LEFT
  '\u{1FBC8}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.44,.35 L.44,.62 L.19,.87 L.26,.94 L.5,.71 L.62,.97 L.71,.92 L.56,.62 L.56,.35 Z M.23,.27 L.18,.36 L.77,.65 L.81,.56 Z M.67,.2 C.67,.106,.594,.03,.5,.03 C.406,.03,.33,.106,.33,.2 C.33,.294,.406,.37,.5,.37 C.594,.37,.67,.294,.67,.2 Z M.56,.2 C.56,.233,.533,.26,.5,.26 C.467,.26,.44,.233,.44,.2 C.44,.167,.467,.14,.5,.14 C.533,.14,.56,.167,.56,.2 Z', type: CustomGlyphVectorType.FILL } }, // STICK FIGURE LEANING RIGHT
  '\u{1FBC9}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.44,.35 L.45,.49 L.15,.79 L.34,.79 L.34,.9 L.44,.9 L.44,.79 L.56,.79 L.56,.9 L.66,.9 L.66,.79 L.84,.79 L.54,.49 L.56,.35 Z M.39,.7 L.5,.6 L.60,.7 Z M.17,.42 L.17,.52 L.83,.52 L.83,.42 Z M.67,.2 C.67,.106,.594,.03,.5,.03 C.406,.03,.33,.106,.33,.2 C.33,.294,.406,.37,.5,.37 C.594,.37,.67,.294,.67,.2 Z M.56,.2 C.56,.233,.533,.26,.5,.26 C.467,.26,.44,.233,.44,.2 C.44,.167,.467,.14,.5,.14 C.533,.14,.56,.167,.56,.2 Z', type: CustomGlyphVectorType.FILL } }, // STICK FIGURE WITH DRESS
  '\u{1FBCA}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.26,.25 L.5,.01 L.74,.25 L.74,.83 L.5,.6 L.26,.83 Z M.37,.29 L.37,.58 L.5,.45 L.63,.58 L.63,.29 L.5,.16 Z', type: CustomGlyphVectorType.FILL } }, // WHITE UP-POINTING CHEVRON

  // Terminal graphic characters (1FBCB-1FBCD)
  '\u{1FBCB}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.09,.32 L.32,.09 L.5,.25 L.68,.09 L.91,.32 L.75,.5 L.91,.68 L.68,.91 L.5,.75 L.32,.91 L.09,.68 L.25,.5 Z M.24,.32 L.39,.5 L.24,.68 L.32,.76 L.5,.61 L.68,.76 L.76,.68 L.61,.5 L.76,.32 L.68,.24 L.5,.39 L.32,.24 Z', type: CustomGlyphVectorType.FILL } }, // WHITE CROSS MARK
  '\u{1FBCC}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.55,.11 L.88,.11 L.88,.21 L.65,.21 L.65,.44, L.88,.44 L.88,.54 L.55,.54 Z', type: CustomGlyphVectorType.FILL } }, // RAISED SMALL LEFT SQUARE BRACKET
  '\u{1FBCD}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.38,.28 L.5,.16 L.62,.28 L.62,.56 L.5,.44 L.38,.56 Z', type: CustomGlyphVectorType.FILL } }, // BLACK SMALL UP-POINTING CHEVRON

  // Block elements (1FBCE-1FBCF)
  '\u{1FBCE}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L0.6667,0 L0.6667,1 L0,1 Z' }, // LEFT TWO THIRDS BLOCK
  '\u{1FBCF}': { type: CustomGlyphDefinitionType.PATH, data: 'M0,0 L0.3333,0 L0.3333,1 L0,1 Z' }, // LEFT ONE THIRD BLOCK

  // Character cell diagonals (1FBD0-1FBDF)
  '\u{1FBD0}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M1,.5 L0,1' } },       // BOX DRAWINGS LIGHT DIAGONAL MIDDLE RIGHT TO LOWER LEFT
  '\u{1FBD1}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M1,0 L0,.5' } },       // BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO MIDDLE LEFT
  '\u{1FBD2}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,0 L1,.5' } },       // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO MIDDLE RIGHT
  '\u{1FBD3}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,.5 L1,1' } },       // BOX DRAWINGS LIGHT DIAGONAL MIDDLE LEFT TO LOWER RIGHT
  '\u{1FBD4}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,0 L.5,1' } },       // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO LOWER CENTRE
  '\u{1FBD5}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L1,1' } },       // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO LOWER RIGHT
  '\u{1FBD6}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M1,0 L.5,1' } },       // BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO LOWER CENTRE
  '\u{1FBD7}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M.5,0 L0,1' } },       // BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO LOWER LEFT
  '\u{1FBD8}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,0 L.5,.5 L1,0' } }, // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO MIDDLE CENTRE TO UPPER RIGHT
  '\u{1FBD9}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M1,0 L.5,.5 L1,1' } }, // BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO MIDDLE CENTRE TO LOWER RIGHT
  '\u{1FBDA}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,1 L.5,.5 L1,1' } }, // BOX DRAWINGS LIGHT DIAGONAL LOWER LEFT TO MIDDLE CENTRE TO LOWER RIGHT
  '\u{1FBDB}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,0 L.5,.5 L0,1' } }, // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO MIDDLE CENTRE TO LOWER LEFT
  '\u{1FBDC}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,0 L.5,1 L1,0' } },  // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO LOWER CENTRE TO UPPER RIGHT
  '\u{1FBDD}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M1,0 L0,.5 L1,1' } },  // BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO MIDDLE LEFT TO LOWER RIGHT
  '\u{1FBDE}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,1 L.5,0 L1,1' } },  // BOX DRAWINGS LIGHT DIAGONAL LOWER LEFT TO UPPER CENTRE TO LOWER RIGHT
  '\u{1FBDF}': { type: CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT, data: { [FontWeight.NORMAL]: 'M0,0 L1,.5 L0,1' } },  // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO MIDDLE RIGHT TO LOWER LEFT

  // Geometric shapes (1FBE0-1FBEF)
  '\u{1FBE0}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 C0,.276,.224,.5,.5,.5 C.776,.5,1,.276,1,0', type: CustomGlyphVectorType.STROKE } }, // TOP JUSTIFIED LOWER HALF WHITE CIRCLE
  '\u{1FBE1}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1,0 C.724,0,.5,.224,.5,.5 C.5,.776,.724,1,1,1', type: CustomGlyphVectorType.STROKE } }, // RIGHT JUSTIFIED LEFT HALF WHITE CIRCLE
  '\u{1FBE2}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,1 C0,.724,.224,.5,.5,.5 C.776,.5,1,.724,1,1', type: CustomGlyphVectorType.STROKE } }, // BOTTOM JUSTIFIED UPPER HALF WHITE CIRCLE
  '\u{1FBE3}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 C.276,0,.5,.224,.5,.5 C.5,.776,.276,1,0,1', type: CustomGlyphVectorType.STROKE } }, // LEFT JUSTIFIED RIGHT HALF WHITE CIRCLE
  '\u{1FBE4}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 2, y: 0, w: 4, h: 4 }] },                                                   // UPPER CENTRE ONE QUARTER BLOCK
  '\u{1FBE5}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 2, y: 4, w: 4, h: 4 }] },                                                   // LOWER CENTRE ONE QUARTER BLOCK
  '\u{1FBE6}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 0, y: 2, w: 4, h: 4 }] },                                                   // MIDDLE LEFT ONE QUARTER BLOCK
  '\u{1FBE7}': { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: [{ x: 4, y: 2, w: 4, h: 4 }] },                                                   // MIDDLE RIGHT ONE QUARTER BLOCK
  '\u{1FBE8}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 C0,.276,.224,.5,.5,.5 C.776,.5,1,.276,1,0 Z', type: CustomGlyphVectorType.FILL } }, // TOP JUSTIFIED LOWER HALF BLACK CIRCLE
  '\u{1FBE9}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1,0 C.724,0,.5,.224,.5,.5 C.5,.776,.724,1,1,1 Z', type: CustomGlyphVectorType.FILL } }, // RIGHT JUSTIFIED LEFT HALF BLACK CIRCLE
  '\u{1FBEA}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,1 C0,.724,.224,.5,.5,.5 C.776,.5,1,.724,1,1 Z', type: CustomGlyphVectorType.FILL } }, // BOTTOM JUSTIFIED UPPER HALF BLACK CIRCLE
  '\u{1FBEB}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 C.276,0,.5,.224,.5,.5 C.5,.776,.276,1,0,1 Z', type: CustomGlyphVectorType.FILL } }, // LEFT JUSTIFIED RIGHT HALF BLACK CIRCLE
  '\u{1FBEC}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1,0 L.5,0 C.5,.276,.724,.5,1,.5 Z', type: CustomGlyphVectorType.FILL } },               // TOP RIGHT JUSTIFIED LOWER LEFT QUARTER BLACK CIRCLE
  '\u{1FBED}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,1 L.5,1 C.5,.724,.276,.5,0,.5 Z', type: CustomGlyphVectorType.FILL } },               // BOTTOM LEFT JUSTIFIED UPPER RIGHT QUARTER BLACK CIRCLE
  '\u{1FBEE}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M1,1 L1,.5 C.724,.5,.5,.724,.5,1 Z', type: CustomGlyphVectorType.FILL } },               // BOTTOM RIGHT JUSTIFIED UPPER LEFT QUARTER BLACK CIRCLE
  '\u{1FBEF}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M0,0 L0,.5 C.276,.5,.5,.276,.5,0 Z', type: CustomGlyphVectorType.FILL } },               // TOP LEFT JUSTIFIED LOWER RIGHT QUARTER BLACK CIRCLE

  // Segmented digits (1FBF0-1FBF9)
  '\u{1FBF0}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b1111110), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT ZERO (abcdef)
  '\u{1FBF1}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b0110000), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT ONE (bc)
  '\u{1FBF2}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b1101101), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT TWO (abdeg)
  '\u{1FBF3}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b1111001), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT THREE (abcdg)
  '\u{1FBF4}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b0110011), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT FOUR (bcfg)
  '\u{1FBF5}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b1011011), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT FIVE (acdfg)
  '\u{1FBF6}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b1011111), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT SIX (acdefg)
  '\u{1FBF7}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b1110010), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT SEVEN (abcf)
  '\u{1FBF8}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b1111111), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT EIGHT (abcdefg)
  '\u{1FBF9}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: segmentedDigit(0b1111011), type: CustomGlyphVectorType.FILL } }, // SEGMENTED DIGIT NINE (abcdfg)

  // Terminal graphic character (1FBFA-1FBFA)
  '\u{1FBFA}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: 'M.5,.175 C.2,.175,.15,.305,.15,.435 L.05,.63 L.35,.63 C.35,.682,.42,.76,.5,.76 C.58,.76,.65,.682,.65,.63 L.95,.63 L.85,.435 C.85,.305,.8,.175,.5,.175 Z', type: CustomGlyphVectorType.FILL } }, // ALARM BELL SYMBOL

  // #endregion
};

/**
 * Generates a drawing function for sextant characters. Sextants are a 2x3 grid where each cell
 * can be on or off.
 * @param pattern A 6-bit pattern where bit 0 = top-left, bit 1 = top-right, bit 2 = middle-left,
 * bit 3 = middle-right, bit 4 = bottom-left, bit 5 = bottom-right
 */
function sextant(pattern: number): { type: CustomGlyphDefinitionType.PATH_FUNCTION, data: CustomGlyphPathDrawFunctionDefinition } {
  return {
    type: CustomGlyphDefinitionType.PATH_FUNCTION,
    data: () => {
      // Sextant grid: 2 columns, 3 rows
      // Row heights in 8ths: top=3, middle=2, bottom=3
      // Column widths: left=4, right=4
      const rects: string[] = [];
      const colW = 0.5; // Each column is half width
      const rowH = [3 / 8, 2 / 8, 3 / 8]; // Row heights as fractions
      const rowY = [0, 3 / 8, 5 / 8]; // Row Y positions

      for (let row = 0; row < 3; row++) {
        const leftBit = (pattern >> (row * 2)) & 1;
        const rightBit = (pattern >> (row * 2 + 1)) & 1;

        if (leftBit && rightBit) {
          // Full row
          rects.push(`M0,${rowY[row]} L1,${rowY[row]} L1,${rowY[row] + rowH[row]} L0,${rowY[row] + rowH[row]} Z`);
        } else if (leftBit) {
          rects.push(`M0,${rowY[row]} L${colW},${rowY[row]} L${colW},${rowY[row] + rowH[row]} L0,${rowY[row] + rowH[row]} Z`);
        } else if (rightBit) {
          rects.push(`M${colW},${rowY[row]} L1,${rowY[row]} L1,${rowY[row] + rowH[row]} L${colW},${rowY[row] + rowH[row]} Z`);
        }
      }
      return rects.join(' ');
    }
  };
}

/**
 * Generates SVG path data for a 7-segment display digit.
 *
 * Segment mapping (bit positions):
 *
 * - bit 6: a (top)
 * - bit 5: b (upper right)
 * - bit 4: c (lower right)
 * - bit 3: d (bottom)
 * - bit 2: e (lower left)
 * - bit 1: f (upper left)
 * - bit 0: g (middle)
 *
 * ```
 *   ─a─
 *  │   │
 *  f   b
 *   ─g─
 *  e   c
 *  │   │
 *   ─d─
 * ```
 */
function segmentedDigit(pattern: number): string {
  const paths: string[] = [];

  // Each segment should have approximately the same stroke width, this is somewhat difficult to be
  // precise since coordinates are 0-1 of the whole cell (percentage-based). To handle this, the
  // fact that terminal cells are typically sized at ~2:1 (height:width) is leveraged.
  // for horizontal vs vertical to make segments appear the same thickness
  const segW = 0.15;  // Width of vertical segments (fraction of cell width)
  const segH = 0.075; // Height of horizontal segments (fraction of cell height, ~half of segW for 2:1 cells)
  const padX = 0.05;  // Horizontal padding from edge
  const padY = 0.175; // Vertical padding from edge (35% total = 65% height)
  const gap = 0.015;  // Gap between segments
  const taperX = segW / 2; // Horizontal taper for vertical segments
  const taperY = segH / 2; // Vertical taper for horizontal segments

  const left = padX;
  const right = 1 - padX;
  const top = padY;
  const bottom = 1 - padY;
  const midY = 0.5;

  // Segment a (top horizontal) - hexagonal with pointed left/right ends
  if (pattern & 0b1000000) {
    const y1 = top;
    const y2 = top + segH / 2;
    const y3 = top + segH;
    const x1 = left + segW + gap;
    const x2 = right - segW - gap;
    paths.push(`M${x1},${y2} L${x1 + taperX},${y1} L${x2 - taperX},${y1} L${x2},${y2} L${x2 - taperX},${y3} L${x1 + taperX},${y3} Z`);
  }
  // Segment b (upper right vertical) - hexagonal with pointed top/bottom ends
  if (pattern & 0b0100000) {
    const x1 = right - segW;
    const x2 = right - segW / 2;
    const x3 = right;
    const y1 = top + segH + gap;
    const y2 = midY - gap;
    paths.push(`M${x2},${y1} L${x3},${y1 + taperY} L${x3},${y2 - taperY} L${x2},${y2} L${x1},${y2 - taperY} L${x1},${y1 + taperY} Z`);
  }
  // Segment c (lower right vertical) - hexagonal with pointed top/bottom ends
  if (pattern & 0b0010000) {
    const x1 = right - segW;
    const x2 = right - segW / 2;
    const x3 = right;
    const y1 = midY + gap;
    const y2 = bottom - segH - gap;
    paths.push(`M${x2},${y1} L${x3},${y1 + taperY} L${x3},${y2 - taperY} L${x2},${y2} L${x1},${y2 - taperY} L${x1},${y1 + taperY} Z`);
  }
  // Segment d (bottom horizontal) - hexagonal with pointed left/right ends
  if (pattern & 0b0001000) {
    const y1 = bottom - segH;
    const y2 = bottom - segH / 2;
    const y3 = bottom;
    const x1 = left + segW + gap;
    const x2 = right - segW - gap;
    paths.push(`M${x1},${y2} L${x1 + taperX},${y1} L${x2 - taperX},${y1} L${x2},${y2} L${x2 - taperX},${y3} L${x1 + taperX},${y3} Z`);
  }
  // Segment e (lower left vertical) - hexagonal with pointed top/bottom ends
  if (pattern & 0b0000100) {
    const x1 = left;
    const x2 = left + segW / 2;
    const x3 = left + segW;
    const y1 = midY + gap;
    const y2 = bottom - segH - gap;
    paths.push(`M${x2},${y1} L${x3},${y1 + taperY} L${x3},${y2 - taperY} L${x2},${y2} L${x1},${y2 - taperY} L${x1},${y1 + taperY} Z`);
  }
  // Segment f (upper left vertical) - hexagonal with pointed top/bottom ends
  if (pattern & 0b0000010) {
    const x1 = left;
    const x2 = left + segW / 2;
    const x3 = left + segW;
    const y1 = top + segH + gap;
    const y2 = midY - gap;
    paths.push(`M${x2},${y1} L${x3},${y1 + taperY} L${x3},${y2 - taperY} L${x2},${y2} L${x1},${y2 - taperY} L${x1},${y1 + taperY} Z`);
  }
  // Segment g (middle horizontal) - hexagonal with pointed left/right ends
  if (pattern & 0b0000001) {
    const y1 = midY - segH / 2;
    const y2 = midY;
    const y3 = midY + segH / 2;
    const x1 = left + segW + gap;
    const x2 = right - segW - gap;
    paths.push(`M${x1},${y2} L${x1 + taperX},${y1} L${x2 - taperX},${y1} L${x2},${y2} L${x2 - taperX},${y3} L${x1 + taperX},${y3} Z`);
  }

  return paths.join(' ');
}

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

  /** ╌ */ TWO_DASHES_HORIZONTAL = 'M.1,.5 L.4,.5 M.6,.5 L.9,.5', // .2 empty, .3 filled
  /** ┄ */ THREE_DASHES_HORIZONTAL = 'M.0667,.5 L.2667,.5 M.4,.5 L.6,.5 M.7333,.5 L.9333,.5', // .1333 empty, .2 filled
  /** ┉ */ FOUR_DASHES_HORIZONTAL = 'M.05,.5 L.2,.5 M.3,.5 L.45,.5 M.55,.5 L.7,.5 M.8,.5 L.95,.5', // .1 empty, .15 filled
  /** ╎ */ TWO_DASHES_VERTICAL = 'M.5,.1 L.5,.4 M.5,.6 L.5,.9',
  /** ┆ */ THREE_DASHES_VERTICAL = 'M.5,.0667 L.5,.2667 M.5,.4 L.5,.6 M.5,.7333 L.5,.9333',
  /** ┊ */ FOUR_DASHES_VERTICAL = 'M.5,.05 L.5,.2 M.5,.3 L.5,.45 L.5,.55 M.5,.7 L.5,.95',
}

const enum FontWeight {
  NORMAL = 1,
  BOLD = 3
}
