/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export type CustomKeyEventHandler = (event: KeyboardEvent) => boolean;

export enum LinkHoverEventTypes {
  HOVER = 'linkhover',
  TOOLTIP = 'linktooltip',
  LEAVE = 'linkleave'
}
