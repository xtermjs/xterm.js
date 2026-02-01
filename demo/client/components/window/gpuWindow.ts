/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';

export class WebgpuWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-webgpu';
  public readonly label = 'webgpu';

  private _textureAtlasContainer!: HTMLElement;

  public build(container: HTMLElement): void {
    const zoomId = `${this.id}-texture-atlas-zoom`;
    const zoomCheckbox = document.createElement('input');
    zoomCheckbox.type = 'checkbox';
    zoomCheckbox.id = zoomId;
    zoomCheckbox.classList.add('texture-atlas-zoom');
    container.appendChild(zoomCheckbox);

    const zoomLabel = document.createElement('label');
    zoomLabel.htmlFor = zoomId;
    zoomLabel.textContent = 'Zoom texture atlas';
    container.appendChild(zoomLabel);

    this._textureAtlasContainer = document.createElement('div');
    this._textureAtlasContainer.classList.add('texture-atlas');
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
    // eslint-disable-next-line no-restricted-syntax
    const dpr = window.devicePixelRatio;
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
  }
}
