/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export type LinkMatcher = {
  id: number,
  regex: RegExp,
  handler: LinkMatcherHandler,
  hoverTooltipCallback?: LinkMatcherHandler,
  hoverLeaveCallback?: () => void,
  matchIndex?: number,
  validationCallback?: LinkMatcherValidationCallback,
  priority?: number
};
export type LinkMatcherHandler = (event: MouseEvent, uri: string) => boolean | void;
export type LinkMatcherValidationCallback = (uri: string, callback: (isValid: boolean) => void) => void;

export type CustomKeyEventHandler = (event: KeyboardEvent) => boolean;
export type Charset = {[key: string]: string};

export type CharData = [number, string, number, number];
export type LineData = CharData[];

export type LinkHoverEvent = {
  x: number,
  y: number,
  length: number
};

export enum LinkHoverEventTypes {
  HOVER = 'linkhover',
  TOOLTIP = 'linktooltip',
  LEAVE = 'linkleave'
};
