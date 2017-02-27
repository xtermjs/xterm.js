/**
 * @license MIT
 */

export type LinkMatcherHandler = (uri: string) => void;
export type LinkMatcherValidationCallback = (uri: string, callback: (isValid: boolean) => void) => void;
