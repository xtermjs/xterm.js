/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';

export class AddonImageWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-image';
  public readonly label = 'image';

  private _imageStorageLimitInput: HTMLInputElement;
  private _imageShowPlaceholderCheckbox: HTMLInputElement;
  private _imageOptionsTextarea: HTMLTextAreaElement;

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
}
