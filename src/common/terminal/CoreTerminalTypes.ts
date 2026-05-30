/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IBufferSet } from 'common/buffer/Types';
import type { IParams } from 'common/parser/Types';
import type { IMouseStateService, ICoreService, IOptionsService, IUnicodeService } from 'common/services/Services';
import { IFunctionIdentifier } from '@xterm/xterm';
import type { IDisposable } from 'common/base/Lifecycle';
import type { ITerminalOptions } from 'common/base/TerminalOptions';

export interface ICoreTerminal {
  mouseStateService: IMouseStateService;
  coreService: ICoreService;
  optionsService: IOptionsService;
  unicodeService: IUnicodeService;
  buffers: IBufferSet;
  options: Required<ITerminalOptions>;
  registerCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean | Promise<boolean>): IDisposable;
  registerDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean | Promise<boolean>): IDisposable;
  registerEscHandler(id: IFunctionIdentifier, callback: () => boolean | Promise<boolean>): IDisposable;
  registerOscHandler(ident: number, callback: (data: string) => boolean | Promise<boolean>): IDisposable;
  registerApcHandler(id: IFunctionIdentifier, callback: (data: string) => boolean | Promise<boolean>): IDisposable;
}

export interface IScrollEvent {
  position: number;
}

export type XtermListener = (...args: any[]) => void;
