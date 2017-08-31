/**
 * Flags used to render terminal text properly.
 */
export enum FLAGS {
  BOLD = 1,
  UNDERLINE = 2,
  BLINK = 4,
  INVERSE = 8,
  INVISIBLE = 16
};

export type Point = {
  x: number,
  y: number
};
