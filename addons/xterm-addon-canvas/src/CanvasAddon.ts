/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminalAddon, Terminal } from 'xterm';

export class CanvasAddon implements ITerminalAddon {
  private _terminal?: Terminal;
  // private _renderer?: WebglRenderer;
  // private _onContextLoss = new EventEmitter<void>();
  // public get onContextLoss(): IEvent<void> { return this._onContextLoss.event; }

  public activate(terminal: Terminal): void {
    // if (!terminal.element) {
    //   throw new Error('Cannot activate WebglAddon before Terminal.open');
    // }
    // if (isSafari) {
    //   throw new Error('Webgl is not currently supported on Safari');
    // }
    this._terminal = terminal;
    // const renderService: IRenderService = (terminal as any)._core._renderService;
    // const characterJoinerService: ICharacterJoinerService = (terminal as any)._core._characterJoinerService;
    // const decorationService: IDecorationService = (terminal as any)._core._decorationService;
    // const colors: IColorSet = (terminal as any)._core._colorManager.colors;
    // this._renderer = new WebglRenderer(terminal, colors, characterJoinerService, decorationService, this._preserveDrawingBuffer);
    // this._renderer.onContextLoss(() => this._onContextLoss.fire());
    // renderService.setRenderer(this._renderer);
  }

  public dispose(): void {
    // if (!this._terminal) {
    //   throw new Error('Cannot dispose WebglAddon because it is activated');
    // }
    // const renderService: IRenderService = (this._terminal as any)._core._renderService;
    // renderService.setRenderer((this._terminal as any)._core._createRenderer());
    // renderService.onResize(this._terminal.cols, this._terminal.rows);
    // this._renderer?.dispose();
    // this._renderer = undefined;
  }

  // public get textureAtlas(): HTMLCanvasElement | undefined {
  //   return this._renderer?.textureAtlas;
  // }

  // public clearTextureAtlas(): void {
  //   this._renderer?.clearCharAtlas();
  // }
}
