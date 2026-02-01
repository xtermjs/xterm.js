/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';
import type { IImageAddonOptions } from '@xterm/addon-image';

export class AddonImageWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-image';
  public readonly label = 'image';

  private _imageStorageLimitInput!: HTMLInputElement;
  private _imageShowPlaceholderCheckbox!: HTMLInputElement;
  private _imageOptionsTextarea!: HTMLTextAreaElement;

  public build(container: HTMLElement): void {
    // Storage limit
    const storageLimitLabel = document.createElement('label');
    storageLimitLabel.textContent = 'Storage Limit (in MB) ';
    this._imageStorageLimitInput = document.createElement('input');
    this._imageStorageLimitInput.type = 'number';
    this._imageStorageLimitInput.id = 'image-storagelimit';
    storageLimitLabel.appendChild(this._imageStorageLimitInput);
    container.appendChild(storageLimitLabel);
    container.appendChild(document.createElement('br'));

    // Show placeholder
    const placeholderLabel = document.createElement('label');
    placeholderLabel.textContent = 'Show Placeholder ';
    this._imageShowPlaceholderCheckbox = document.createElement('input');
    this._imageShowPlaceholderCheckbox.type = 'checkbox';
    this._imageShowPlaceholderCheckbox.id = 'image-showplaceholder';
    placeholderLabel.appendChild(this._imageShowPlaceholderCheckbox);
    container.appendChild(placeholderLabel);
    container.appendChild(document.createElement('br'));
    container.appendChild(document.createElement('br'));

    // Ctor options
    const optionsLabel = document.createElement('label');
    optionsLabel.appendChild(document.createTextNode('Ctor options (applied on addon relaunch)'));
    optionsLabel.appendChild(document.createElement('br'));
    this._imageOptionsTextarea = document.createElement('textarea');
    this._imageOptionsTextarea.id = 'image-options';
    this._imageOptionsTextarea.cols = 40;
    this._imageOptionsTextarea.rows = 12;
    optionsLabel.appendChild(this._imageOptionsTextarea);
    container.appendChild(optionsLabel);

    container.appendChild(document.createElement('br'));
    container.appendChild(document.createElement('br'));

    const dl = document.createElement('dl');
    const dt = document.createElement('dt');
    dt.textContent = 'Image Test';
    dl.appendChild(dt);
    this._addDdWithButton(dl, 'image-demo1', 'snake (sixel)');
    this._addDdWithButton(dl, 'image-demo2', 'oranges (sixel)');
    this._addDdWithButton(dl, 'image-demo3', 'palette (iip)');
    container.appendChild(dl);

    this._initImageAddonExposed();
  }

  public get imageStorageLimitInput(): HTMLInputElement {
    return this._imageStorageLimitInput;
  }

  public get imageShowPlaceholderCheckbox(): HTMLInputElement {
    return this._imageShowPlaceholderCheckbox;
  }

  public get imageOptionsTextarea(): HTMLTextAreaElement {
    return this._imageOptionsTextarea;
  }

  private _addDdWithButton(dl: HTMLElement, id: string, label: string): void {
    const dd = document.createElement('dd');
    const button = document.createElement('button');
    button.id = id;
    button.textContent = label;
    dd.appendChild(button);
    dl.appendChild(dd);
  }

  private _initImageAddonExposed(): void {
    const imageAddon = this._addons.image.instance!;
    const defaultOptions: IImageAddonOptions = (imageAddon as any)._defaultOpts;
    const limitStorageElement = document.querySelector<HTMLInputElement>('#image-storagelimit')!;
    limitStorageElement.valueAsNumber = imageAddon.storageLimit;
    this._addDomListener(limitStorageElement, 'change', () => {
      try {
        imageAddon.storageLimit = limitStorageElement.valueAsNumber;
        limitStorageElement.valueAsNumber = imageAddon.storageLimit;
        console.log('changed storageLimit to', imageAddon.storageLimit);
      } catch (e) {
        limitStorageElement.valueAsNumber = imageAddon.storageLimit;
        console.log('storageLimit at', imageAddon.storageLimit);
        throw e;
      }
    });
    const showPlaceholderElement = document.querySelector<HTMLInputElement>('#image-showplaceholder')!;
    showPlaceholderElement.checked = imageAddon.showPlaceholder;
    this._addDomListener(showPlaceholderElement, 'change', () => {
      imageAddon.showPlaceholder = showPlaceholderElement.checked;
    });
    const ctorOptionsElement = document.querySelector<HTMLTextAreaElement>('#image-options')!;
    ctorOptionsElement.value = JSON.stringify(defaultOptions, null, 2);

    const sixelDemo = (url: string) => () => fetch(url)
      .then(resp => resp.arrayBuffer())
      .then(buffer => {
        this._terminal.write('\r\n');
        this._terminal.write(new Uint8Array(buffer));
      });

    const iipDemo = (url: string) => () => fetch(url)
      .then(resp => resp.arrayBuffer())
      .then(buffer => {
        const data = new Uint8Array(buffer);
        let sdata = '';
        for (let i = 0; i < data.length; ++i) sdata += String.fromCharCode(data[i]);
        this._terminal.write('\r\n');
        this._terminal.write(`\x1b]1337;File=inline=1;size=${data.length}:${btoa(sdata)}\x1b\\`);
      });

    document.getElementById('image-demo1')!.addEventListener('click',
      sixelDemo('https://raw.githubusercontent.com/saitoha/libsixel/master/images/snake.six'));
    document.getElementById('image-demo2')!.addEventListener('click',
      sixelDemo('https://raw.githubusercontent.com/jerch/node-sixel/master/testfiles/test2.sixel'));
    document.getElementById('image-demo3')!.addEventListener('click',
      iipDemo('https://raw.githubusercontent.com/jerch/node-sixel/master/palette.png'));

    // demo for image retrieval API
    this._terminal.element!.addEventListener('click', (ev: MouseEvent) => {
      if (!ev.ctrlKey || !imageAddon) return;

      // TODO...
      // if (ev.altKey) {
      //   const sel = term.getSelectionPosition();
      //   if (sel) {
      //     addons.image.instance
      //       .extractCanvasAtBufferRange(term.getSelectionPosition())
      //       ?.toBlob(data => window.open(URL.createObjectURL(data), '_blank'));
      //     return;
      //   }
      // }

      const pos = (this._terminal as any)._core._mouseService!.getCoords(ev, (this._terminal as any)._core.screenElement!, this._terminal.cols, this._terminal.rows);
      const x = pos[0] - 1;
      const y = pos[1] - 1;
      const canvas = ev.shiftKey
        // ctrl+shift+click: get single tile
        ? imageAddon.extractTileAtBufferCell(x, this._terminal.buffer.active.viewportY + y)
        // ctrl+click: get original image
        : imageAddon.getImageAtBufferCell(x, this._terminal.buffer.active.viewportY + y);
      canvas?.toBlob(data => data && window.open(URL.createObjectURL(data), '_blank'));
    });
  }

  private _addDomListener(element: HTMLElement, type: string, handler: (...args: any[]) => any): void {
    element.addEventListener(type, handler);
    (this._terminal as any)._core._register({ dispose: () => element.removeEventListener(type, handler) });
  }
}
