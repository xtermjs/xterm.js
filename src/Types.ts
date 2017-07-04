/**
 * @license MIT
 */

/**
 * Character data, the array's format is:
 * - string: The character.
 * - number: The width of the character.
 * - number: Flags that decorate the character.
 *
 *        truecolor fg
 *        |   inverse
 *        |   |   underline
 *        |   |   |
 *   0b 0 0 0 0 0 0 0
 *      |   |   |   |
 *      |   |   |   bold
 *      |   |   blink
 *      |   invisible
 *      truecolor bg
 *
 * - number: Foreground color. If default bit flag is set, color is the default
 *           (inherited from the DOM parent). If truecolor fg flag is true, this
 *           is a 24-bit color of the form 0xxRRGGBB, if not it's an xterm color
 *           code ranging from 0-255.
 *
 *        red
 *        |       blue
 *   0x 0 R R G G B B
 *      |     |
 *      |     green
 *      default color bit
 *
 * - number: Background color. The same as foreground color.
 */
export type CharData = [string, number, number, number, number];

export type LinkMatcher = {
  id: number,
  regex: RegExp,
  handler: LinkMatcherHandler,
  matchIndex?: number,
  validationCallback?: LinkMatcherValidationCallback,
  priority?: number
};
export type LinkMatcherHandler = (event: MouseEvent, uri: string) => boolean | void;
export type LinkMatcherValidationCallback = (uri: string, element: HTMLElement, callback: (isValid: boolean) => void) => void;
