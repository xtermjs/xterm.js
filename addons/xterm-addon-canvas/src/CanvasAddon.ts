/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderService } from 'browser/services/Services';
import { IColorSet } from 'browser/Types';
import { CanvasRenderer } from './CanvasRenderer';
import { IBufferService, IInstantiationService } from 'common/services/Services';
import { ITerminalAddon, Terminal } from 'xterm';

export class CanvasAddon implements ITerminalAddon {
  private _terminal?: Terminal;
  private _renderer?: CanvasRenderer;
  // private _onContextLoss = new EventEmitter<void>();
  // public get onContextLoss(): IEvent<void> { return this._onContextLoss.event; }

  public activate(terminal: Terminal): void {
    if (!terminal.element) {
      throw new Error('Cannot activate CanvasAddon before Terminal.open');
    }
    this._terminal = terminal;
    const instantiationService: IInstantiationService = (terminal as any)._core._instantiationService;
    const bufferService: IBufferService = (terminal as any)._core._renderService;
    const renderService: IRenderService = (terminal as any)._core._renderService;
    const colors: IColorSet = (terminal as any)._core._colorManager.colors;
    const screenElement: HTMLElement = (terminal as any)._core.screenElement;
    const linkifier = (terminal as any)._core.linkifier2;
    this._renderer = instantiationService.createInstance(CanvasRenderer, colors, screenElement, linkifier);
    // this._renderer.onContextLoss(() => this._onContextLoss.fire());
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

  // public get textureAtlas(): HTMLCanvasElement | undefined {
  //   return this._renderer?.textureAtlas;
  // }

  // public clearTextureAtlas(): void {
  //   this._renderer?.clearCharAtlas();
  // }
}
