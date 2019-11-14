/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IWindowOptions } from 'common/Types';

export const enum WindowOptions {
  restoreWin = 1 << 1,
  minimizeWin = 1 << 2,
  setWinPosition = 1 << 3,
  setWinSizePixels = 1 << 4,
  raiseWin = 1 << 5,
  lowerWin = 1 << 6,
  refreshWin = 1 << 7,
  setWinSizeChars = 1 << 8,
  maximizeWin = 1 << 9,
  fullscreenWin = 1 << 10,
  getWinState = 1 << 11,
  getWinPosition = 1 << 13,
  getWinSizePixels = 1 << 14,
  getScreenSizePixels = 1 << 15,  // note: name not in xterm
  getCellSizePixels = 1 << 16,    // note: name not in xterm
  getWinSizeChars = 1 << 18,
  getScreenSizeChars = 1 << 19,
  getIconTitle = 1 << 20,
  getWinTitle = 1 << 21,
  pushTitle = 1 << 22,
  popTitle = 1 << 23,
  setWinLines = 1 << 24           // any param >= 24, also handles DECCOLM
}

export function hasWindowOption(n: number, opts: WindowOptions): boolean {
  return !!(opts & (1 << Math.min(n, 24)));
}

export function getWindowOptions(opts: WindowOptions): IWindowOptions {
  return {
    restoreWin: !!(opts & WindowOptions.restoreWin),
    minimizeWin: !!(opts & WindowOptions.minimizeWin),
    setWinPosition: !!(opts & WindowOptions.setWinPosition),
    setWinSizePixels: !!(opts & WindowOptions.setWinSizePixels),
    raiseWin: !!(opts & WindowOptions.raiseWin),
    lowerWin: !!(opts & WindowOptions.lowerWin),
    refreshWin: !!(opts & WindowOptions.refreshWin),
    setWinSizeChars: !!(opts & WindowOptions.setWinSizeChars),
    maximizeWin: !!(opts & WindowOptions.maximizeWin),
    fullscreenWin: !!(opts & WindowOptions.fullscreenWin),
    getWinState: !!(opts & WindowOptions.getWinState),
    getWinPosition: !!(opts & WindowOptions.getWinPosition),
    getWinSizePixels: !!(opts & WindowOptions.getWinSizePixels),
    getScreenSizePixels: !!(opts & WindowOptions.getScreenSizePixels),
    getCellSizePixels: !!(opts & WindowOptions.getCellSizePixels),
    getWinSizeChars: !!(opts & WindowOptions.getWinSizeChars),
    getScreenSizeChars: !!(opts & WindowOptions.getScreenSizeChars),
    getIconTitle: !!(opts & WindowOptions.getIconTitle),
    getWinTitle: !!(opts & WindowOptions.getWinTitle),
    pushTitle: !!(opts & WindowOptions.pushTitle),
    popTitle: !!(opts & WindowOptions.popTitle),
    setWinLines: !!(opts & WindowOptions.setWinLines)
  };
}

export function setWindowOptions(v: IWindowOptions & {[key: string]: boolean}, opts: WindowOptions): WindowOptions {
  for (const optionName in v) {
    const value = v[optionName];
    switch (optionName) {
      case 'restoreWin': opts = value ? opts | WindowOptions.restoreWin : opts & ~WindowOptions.restoreWin; break;
      case 'minimizeWin': opts = value ? opts | WindowOptions.minimizeWin : opts & ~WindowOptions.minimizeWin; break;
      case 'setWinPosition': opts = value ? opts | WindowOptions.setWinPosition : opts & ~WindowOptions.setWinPosition; break;
      case 'setWinSizePixels': opts = value ? opts | WindowOptions.setWinSizePixels : opts & ~WindowOptions.setWinSizePixels; break;
      case 'raiseWin': opts = value ? opts | WindowOptions.raiseWin : opts & ~WindowOptions.raiseWin; break;
      case 'lowerWin': opts = value ? opts | WindowOptions.lowerWin : opts & ~WindowOptions.lowerWin; break;
      case 'refreshWin': opts = value ? opts | WindowOptions.refreshWin : opts & ~WindowOptions.refreshWin; break;
      case 'setWinSizeChars': opts = value ? opts | WindowOptions.setWinSizeChars : opts & ~WindowOptions.setWinSizeChars; break;
      case 'maximizeWin': opts = value ? opts | WindowOptions.maximizeWin : opts & ~WindowOptions.maximizeWin; break;
      case 'fullscreenWin': opts = value ? opts | WindowOptions.fullscreenWin : opts & ~WindowOptions.fullscreenWin; break;
      case 'getWinState': opts = value ? opts | WindowOptions.getWinState : opts & ~WindowOptions.getWinState; break;
      case 'getWinPosition': opts = value ? opts | WindowOptions.getWinPosition : opts & ~WindowOptions.getWinPosition; break;
      case 'getWinSizePixels': opts = value ? opts | WindowOptions.getWinSizePixels : opts & ~WindowOptions.getWinSizePixels; break;
      case 'getScreenSizePixels': opts = value ? opts | WindowOptions.getScreenSizePixels : opts & ~WindowOptions.getScreenSizePixels; break;
      case 'getCellSizePixels': opts = value ? opts | WindowOptions.getCellSizePixels : opts & ~WindowOptions.getCellSizePixels; break;
      case 'getWinSizeChars': opts = value ? opts | WindowOptions.getWinSizeChars : opts & ~WindowOptions.getWinSizeChars; break;
      case 'getScreenSizeChars': opts = value ? opts | WindowOptions.getScreenSizeChars : opts & ~WindowOptions.getScreenSizeChars; break;
      case 'getIconTitle': opts = value ? opts | WindowOptions.getIconTitle : opts & ~WindowOptions.getIconTitle; break;
      case 'getWinTitle': opts = value ? opts | WindowOptions.getWinTitle : opts & ~WindowOptions.getWinTitle; break;
      case 'pushTitle': opts = value ? opts | WindowOptions.pushTitle : opts & ~WindowOptions.pushTitle; break;
      case 'popTitle': opts = value ? opts | WindowOptions.popTitle : opts & ~WindowOptions.popTitle; break;
      case 'setWinLines': opts = value ? opts | WindowOptions.setWinLines : opts & ~WindowOptions.setWinLines; break;
      default: throw new Error(`unknown WindowOption "${optionName}"`);
    }
  }
  return opts;
}
