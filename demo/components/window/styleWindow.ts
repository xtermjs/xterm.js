/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IControlWindow } from '../controlBar';

export class StyleWindow implements IControlWindow {
  public readonly id = 'style';
  public readonly label = 'Style';

  private _paddingElement: HTMLInputElement;

  public build(container: HTMLElement): void {
    const heading = document.createElement('h3');
    heading.textContent = 'Style';
    container.appendChild(heading);

    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.marginRight = '16px';

    const label = document.createElement('label');
    label.htmlFor = 'padding';
    label.textContent = 'Padding';
    wrapper.appendChild(label);

    this._paddingElement = document.createElement('input');
    this._paddingElement.type = 'number';
    this._paddingElement.id = 'padding';
    wrapper.appendChild(this._paddingElement);

    container.appendChild(wrapper);
  }

  public get paddingElement(): HTMLInputElement {
    return this._paddingElement;
  }
}
