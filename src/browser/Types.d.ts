/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent } from 'common/EventEmitter';
import { IDisposable } from 'common/Types';

export interface IColorManager {
  colors: IColorSet;
  onOptionsChange(key: string): void;
}

export interface IColor {
  css: string;
  rgba: number; // 32-bit int with rgba in each byte
}

export interface IColorSet {
  foreground: IColor;
  background: IColor;
  cursor: IColor;
  cursorAccent: IColor;
  selection: IColor;
  /** The selection blended on top of background. */
  selectionOpaque: IColor;
  ansi: IColor[];
  contrastCache: IColorContrastCache;
}

export interface IColorContrastCache {
  clear(): void;
  setCss(bg: number, fg: number, value: string | null): void;
  getCss(bg: number, fg: number): string | null | undefined;
  setColor(bg: number, fg: number, value: IColor | null): void;
  getColor(bg: number, fg: number): IColor | null | undefined;
}

export interface IPartialColorSet {
  foreground: IColor;
  background: IColor;
  cursor?: IColor;
  cursorAccent?: IColor;
  selection?: IColor;
  ansi: IColor[];
}

export interface IViewport extends IDisposable {
  scrollBarWidth: number;
  syncScrollArea(immediate?: boolean): void;
  getLinesScrolled(ev: WheelEvent): number;
  onWheel(ev: WheelEvent): boolean;
  onTouchStart(ev: TouchEvent): void;
  onTouchMove(ev: TouchEvent): boolean;
  onThemeChange(colors: IColorSet): void;
}

export interface IViewportRange {
  start: IViewportRangePosition;
  end: IViewportRangePosition;
}

export interface IViewportRangePosition {
  x: number;
  y: number;
}

export type LinkMatcherHandler = (event: MouseEvent, uri: string) => void;
export type LinkMatcherHoverTooltipCallback = (event: MouseEvent, uri: string, position: IViewportRange) => void;
export type LinkMatcherValidationCallback = (uri: string, callback: (isValid: boolean) => void) => void;

export interface ILinkMatcher {
  id: number;
  regex: RegExp;
  handler: LinkMatcherHandler;
  hoverTooltipCallback?: LinkMatcherHoverTooltipCallback;
  hoverLeaveCallback?: () => void;
  matchIndex?: number;
  validationCallback?: LinkMatcherValidationCallback;
  priority?: number;
  willLinkActivate?: (event: MouseEvent, uri: string) => boolean;
}

export interface IRegisteredLinkMatcher extends ILinkMatcher {
  priority: number;
}

export interface ILinkifierEvent {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cols: number;
  fg: number | undefined;
}

export interface ILinkifier {
  onLinkHover: IEvent<ILinkifierEvent>;
  onLinkLeave: IEvent<ILinkifierEvent>;
  onLinkTooltip: IEvent<ILinkifierEvent>;

  attachToDom(element: HTMLElement, mouseZoneManager: IMouseZoneManager): void;
  linkifyRows(start: number, end: number): void;
  registerLinkMatcher(regex: RegExp, handler: LinkMatcherHandler, options?: ILinkMatcherOptions): number;
  deregisterLinkMatcher(matcherId: number): boolean;
}

export interface ILinkMatcherOptions {
  /**
   * The index of the link from the regex.match(text) call. This defaults to 0
   * (for regular expressions without capture groups).
   */
  matchIndex?: number;
  /**
   * A callback that validates an individual link, returning true if valid and
   * false if invalid.
   */
  validationCallback?: LinkMatcherValidationCallback;
  /**
   * A callback that fires when the mouse hovers over a link.
   */
  tooltipCallback?: LinkMatcherHoverTooltipCallback;
  /**
   * A callback that fires when the mouse leaves a link that was hovered.
   */
  leaveCallback?: () => void;
  /**
   * The priority of the link matcher, this defines the order in which the link
   * matcher is evaluated relative to others, from highest to lowest. The
   * default value is 0.
   */
  priority?: number;
  /**
   * A callback that fires when the mousedown and click events occur that
   * determines whether a link will be activated upon click. This enables
   * only activating a link when a certain modifier is held down, if not the
   * mouse event will continue propagation (eg. double click to select word).
   */
  willLinkActivate?: (event: MouseEvent, uri: string) => boolean;
}

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
