/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';

export class GpuWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'gpu';
  public readonly label = 'WebGL';

  private _textureAtlasContainer: HTMLElement;

  public build(container: HTMLElement): void {
    const zoomCheckbox = document.createElement('input');
    zoomCheckbox.type = 'checkbox';
    zoomCheckbox.id = 'texture-atlas-zoom';
    container.appendChild(zoomCheckbox);

    const zoomLabel = document.createElement('label');
    zoomLabel.htmlFor = 'texture-atlas-zoom';
    zoomLabel.textContent = 'Zoom texture atlas';
    container.appendChild(zoomLabel);

    this._textureAtlasContainer = document.createElement('div');
    this._textureAtlasContainer.id = 'texture-atlas';
    container.appendChild(this._textureAtlasContainer);
  }

  public setTextureAtlas(canvas: HTMLCanvasElement): void {
    this._styleAtlasPage(canvas);
    this._textureAtlasContainer.replaceChildren(canvas);
  }

  public appendTextureAtlas(canvas: HTMLCanvasElement): void {
    this._styleAtlasPage(canvas);
    this._textureAtlasContainer.appendChild(canvas);
  }

  public removeTextureAtlas(canvas: HTMLCanvasElement): void {
    canvas.remove();
  }

  private _styleAtlasPage(canvas: HTMLCanvasElement): void {
    canvas.style.width = `${canvas.width / window.devicePixelRatio}px`;
    canvas.style.height = `${canvas.height / window.devicePixelRatio}px`;
  }
}
