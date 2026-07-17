/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';

export class WebglWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-webgl';
  public readonly label = 'webgl';

  private _textureAtlasContainer!: HTMLElement;
  private _stressRunning = false;
  private _scrollOutput: HTMLInputElement | undefined;

  public build(container: HTMLElement): void {
    const stressButtons = document.createElement('div');
    const stressStart = document.createElement('button');
    stressStart.id = 'stress-start';
    stressStart.textContent = 'atlas stress start';
    stressStart.addEventListener('click', () => this._stress());
    stressButtons.appendChild(stressStart);

    const stressStop = document.createElement('button');
    stressStop.id = 'stress-stop';
    stressStop.textContent = 'atlas stress stop';
    stressStop.addEventListener('click', () => this._stressRunning = false);
    stressButtons.appendChild(stressStop);
    container.appendChild(stressButtons);

    const stressOptions = document.createElement('div');
    this._scrollOutput = document.createElement('input');
    this._scrollOutput.type = 'checkbox';
    this._scrollOutput.id = 'scroll-output';
    stressOptions.appendChild(this._scrollOutput);
    const scrollOutputLabel = document.createElement('label');
    scrollOutputLabel.htmlFor = 'scroll-output';
    scrollOutputLabel.textContent = 'Scroll output';
    stressOptions.appendChild(scrollOutputLabel);
    container.appendChild(stressOptions);

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
    // oxlint-disable-next-line eslint-js/no-restricted-syntax
    const dpr = window.devicePixelRatio;
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
  }

  private async _stress(): Promise<void> {
    const TEXT = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    if (this._stressRunning) {
      return;
    }
    this._stressRunning = true;
    const scrollOutput = !!(this._scrollOutput?.checked);
    for (let r = 0; r < 256; r += 2) {
      for (let g = 0; g < 256; g += 2) {
        let s: string[] = [];
        for (let b = 0; b < 256; b += 2) {
          if (!this._stressRunning) {
            return;
          }
          const rbg = `RGB: ${[r, g, b]}`;
          s.push(`\r\x1b[38;2;${r};${g};${b}m${rbg.padEnd(18, ' ')}${TEXT}`);
          if (s.length >= 16) {
            if (scrollOutput) {
              await new Promise<void>(r => this._terminal.write(s.join('\r\n') + '\r\n', r));
            } else {
              await new Promise<void>(r => this._terminal.write('\x1b[H' + s.join('\r\n'), r));
            }
            s = [];
          }
        }
      }
    }
  }
}
