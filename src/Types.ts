/**
 * @license MIT
 */

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

// TODO: Make this type more specific
export type TerminalOptions = {[key: string]: any};
export type CustomKeyEventHandler = (event: KeyboardEvent) => boolean;
export type Charset = {[key: string]: string};
