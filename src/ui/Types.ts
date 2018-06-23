/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'xterm';

export interface IMouseZoneManager extends IDisposable {
  add(zone: IMouseZone): void;
  clearAll(start?: number, end?: number): void;
}

export interface IMouseZone {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  clickCallback: (e: MouseEvent) => any;
  hoverCallback: (e: MouseEvent) => any | undefined;
  tooltipCallback: (e: MouseEvent) => any | undefined;
  leaveCallback: () => any | undefined;
  willLinkActivate: (e: MouseEvent) => boolean;
}
