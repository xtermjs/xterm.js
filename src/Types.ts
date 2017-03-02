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
export type LinkMatcherHandler = (uri: string) => void;
export type LinkMatcherValidationCallback = (uri: string, callback: (isValid: boolean) => void) => void;
