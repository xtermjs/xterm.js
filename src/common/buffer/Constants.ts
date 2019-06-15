/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export const DEFAULT_COLOR = 256;
export const DEFAULT_ATTR = (0 << 18) | (DEFAULT_COLOR << 9) | (256 << 0);

export const CHAR_DATA_ATTR_INDEX = 0;
export const CHAR_DATA_CHAR_INDEX = 1;
export const CHAR_DATA_WIDTH_INDEX = 2;
export const CHAR_DATA_CODE_INDEX = 3;

/**
 * Null cell - a real empty cell (containing nothing).
 * Note that code should always be 0 for a null cell as
 * several test condition of the buffer line rely on this.
 */
export const NULL_CELL_CHAR = '';
export const NULL_CELL_WIDTH = 1;
export const NULL_CELL_CODE = 0;

/**
 * Whitespace cell.
 * This is meant as a replacement for empty cells when needed
 * during rendering lines to preserve correct aligment.
 */
export const WHITESPACE_CELL_CHAR = ' ';
export const WHITESPACE_CELL_WIDTH = 1;
export const WHITESPACE_CELL_CODE = 32;
