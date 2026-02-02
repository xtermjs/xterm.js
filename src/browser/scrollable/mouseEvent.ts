/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IframeUtils } from './iframe';
import * as platform from 'common/Platform';

export interface IMouseEvent {
  readonly browserEvent: MouseEvent;
  readonly leftButton: boolean;
  readonly middleButton: boolean;
  readonly rightButton: boolean;
  readonly buttons: number;
  readonly target: HTMLElement;
  readonly detail: number;
  readonly posx: number;
  readonly posy: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly timestamp: number;

  preventDefault(): void;
  stopPropagation(): void;
}

export class StandardMouseEvent implements IMouseEvent {

  public readonly browserEvent: MouseEvent;

  public readonly leftButton: boolean;
  public readonly middleButton: boolean;
  public readonly rightButton: boolean;
  public readonly buttons: number;
  public readonly target: HTMLElement;
  public detail: number;
  public readonly posx: number;
  public readonly posy: number;
  public readonly ctrlKey: boolean;
  public readonly shiftKey: boolean;
  public readonly altKey: boolean;
  public readonly metaKey: boolean;
  public readonly timestamp: number;

  constructor(targetWindow: Window, e: MouseEvent) {
    this.timestamp = Date.now();
    this.browserEvent = e;
    this.leftButton = e.button === 0;
    this.middleButton = e.button === 1;
    this.rightButton = e.button === 2;
    this.buttons = e.buttons;

    this.target = e.target as HTMLElement;

    this.detail = e.detail ?? 1;
    if (e.type === 'dblclick') {
      this.detail = 2;
    }
    this.ctrlKey = e.ctrlKey;
    this.shiftKey = e.shiftKey;
    this.altKey = e.altKey;
    this.metaKey = e.metaKey;

    if (typeof e.pageX === 'number') {
      this.posx = e.pageX;
      this.posy = e.pageY;
    } else {
      this.posx = e.clientX + this.target.ownerDocument.body.scrollLeft + this.target.ownerDocument.documentElement.scrollLeft;
      this.posy = e.clientY + this.target.ownerDocument.body.scrollTop + this.target.ownerDocument.documentElement.scrollTop;
    }

    const iframeOffsets = IframeUtils.getPositionOfChildWindowRelativeToAncestorWindow(targetWindow, e.view);
    this.posx -= iframeOffsets.left;
    this.posy -= iframeOffsets.top;
  }

  public preventDefault(): void {
    this.browserEvent.preventDefault();
  }

  public stopPropagation(): void {
    this.browserEvent.stopPropagation();
  }
}

export interface IMouseWheelEvent extends MouseEvent {
  readonly wheelDelta: number;
  readonly wheelDeltaX: number;
  readonly wheelDeltaY: number;

  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaZ: number;
  readonly deltaMode: number;
}

interface IWebKitMouseWheelEvent {
  wheelDeltaY: number;
  wheelDeltaX: number;
}

interface IGeckoMouseWheelEvent {
  HORIZONTAL_AXIS: number;
  VERTICAL_AXIS: number;
  axis: number;
  detail: number;
}

export class StandardWheelEvent {

  public readonly browserEvent: IMouseWheelEvent | null;
  public readonly deltaY: number;
  public readonly deltaX: number;
  public readonly target: Node | null;

  constructor(e: IMouseWheelEvent | null, deltaX: number = 0, deltaY: number = 0) {

    this.browserEvent = e ?? null;
    this.target = e ? (e.target ?? (e as any).targetNode ?? e.srcElement ?? null) : null;

    this.deltaY = deltaY;
    this.deltaX = deltaX;

    let shouldFactorDPR: boolean = false;
    if (platform.isChrome) {
      const chromeVersionMatch = navigator.userAgent.match(/Chrome\/(\d+)/);
      const chromeMajorVersion = chromeVersionMatch ? parseInt(chromeVersionMatch[1]) : 123;
      shouldFactorDPR = chromeMajorVersion <= 122;
    }

    if (e) {
      const e1 = e as IWebKitMouseWheelEvent as any;
      const e2 = e as unknown as IGeckoMouseWheelEvent;
      const devicePixelRatio = e.view?.devicePixelRatio ?? 1;

      if (typeof e1.wheelDeltaY !== 'undefined') {
        if (shouldFactorDPR) {
          this.deltaY = e1.wheelDeltaY / (120 * devicePixelRatio);
        } else {
          this.deltaY = e1.wheelDeltaY / 120;
        }
      } else if (typeof e2.VERTICAL_AXIS !== 'undefined' && e2.axis === e2.VERTICAL_AXIS) {
        this.deltaY = -e2.detail / 3;
      } else if (e.type === 'wheel') {
        const ev = e as unknown as WheelEvent;

        if (ev.deltaMode === ev.DOM_DELTA_LINE) {
          if (platform.isFirefox && !platform.isMac) {
            this.deltaY = -e.deltaY / 3;
          } else {
            this.deltaY = -e.deltaY;
          }
        } else {
          this.deltaY = -e.deltaY / 40;
        }
      }

      if (typeof e1.wheelDeltaX !== 'undefined') {
        if (platform.isSafari && platform.isWindows) {
          this.deltaX = -(e1.wheelDeltaX / 120);
        } else if (shouldFactorDPR) {
          this.deltaX = e1.wheelDeltaX / (120 * devicePixelRatio);
        } else {
          this.deltaX = e1.wheelDeltaX / 120;
        }
      } else if (typeof e2.HORIZONTAL_AXIS !== 'undefined' && e2.axis === e2.HORIZONTAL_AXIS) {
        this.deltaX = -e.detail / 3;
      } else if (e.type === 'wheel') {
        const ev = e as unknown as WheelEvent;

        if (ev.deltaMode === ev.DOM_DELTA_LINE) {
          if (platform.isFirefox && !platform.isMac) {
            this.deltaX = -e.deltaX / 3;
          } else {
            this.deltaX = -e.deltaX;
          }
        } else {
          this.deltaX = -e.deltaX / 40;
        }
      }

      if (this.deltaY === 0 && this.deltaX === 0 && e.wheelDelta) {
        if (shouldFactorDPR) {
          this.deltaY = e.wheelDelta / (120 * devicePixelRatio);
        } else {
          this.deltaY = e.wheelDelta / 120;
        }
      }
    }
  }

  public preventDefault(): void {
    this.browserEvent?.preventDefault();
  }

  public stopPropagation(): void {
    this.browserEvent?.stopPropagation();
  }
}
