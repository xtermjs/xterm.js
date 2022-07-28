/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharSizeService, IRenderService } from 'browser/services/Services';
import { IColorSet } from 'browser/Types';
import { CanvasRenderer } from './CanvasRenderer';
import { IBufferService, IInstantiationService, IOptionsService } from 'common/services/Services';
import { ITerminalAddon, Terminal } from 'xterm';

export class CanvasAddon implements ITerminalAddon {
  private _terminal?: Terminal;
  private _renderer?: CanvasRenderer;

  public activate(terminal: Terminal): void {
    if (!terminal.element) {
      throw new Error('Cannot activate CanvasAddon before Terminal.open');
    }
    this._terminal = terminal;
    const instantiationService: IInstantiationService = (terminal as any)._core._instantiationService;
    const bufferService: IBufferService = (terminal as any)._core._bufferService;
    const renderService: IRenderService = (terminal as any)._core._renderService;
    const charSizeService: ICharSizeService = (terminal as any)._core._charSizeService;
    const optionsService: IOptionsService = (terminal as any)._core.optionsService;
    const colors: IColorSet = (terminal as any)._core._colorManager.colors;
    const screenElement: HTMLElement = (terminal as any)._core.screenElement;
    const linkifier = (terminal as any)._core.linkifier2;
    this._renderer = new CanvasRenderer(colors, screenElement, linkifier, instantiationService, bufferService, charSizeService, optionsService);
    renderService.setRenderer(this._renderer);
    renderService.onResize(bufferService.cols, bufferService.rows);
  }

  public dispose(): void {
    if (!this._terminal) {
      throw new Error('Cannot dispose CanvasAddon because it is activated');
    }
    const renderService: IRenderService = (this._terminal as any)._core._renderService;
    renderService.setRenderer((this._terminal as any)._core._createRenderer());
    renderService.onResize(this._terminal.cols, this._terminal.rows);
    this._renderer?.dispose();
    this._renderer = undefined;
  }
}
