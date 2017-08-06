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

export type CustomKeyEventHandler = (event: KeyboardEvent) => boolean;
export type Charset = {[key: string]: string};

export type CharData = [number, string, number];
export type LineData = CharData[];

export type Option = BooleanOption | StringOption | StringArrayOption | NumberOption | GeometryOption | HandlerOption;
export type BooleanOption =
    'cancelEvents' |
    'convertEol' |
    'cursorBlink' |
    'debug' |
    'disableStdin' |
    'popOnBell' |
    'screenKeys' |
    'useFlowControl' |
    'visualBell';
export type StringOption =
    'cursorStyle' |
    'termName';
export type StringArrayOption = 'colors';
export type NumberOption =
    'cols' |
    'rows' |
    'tabStopWidth' |
    'scrollback';
export type GeometryOption = 'geometry';
export type HandlerOption = 'handler';
