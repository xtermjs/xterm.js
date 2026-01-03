/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';

export class AddonsWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addons';
  public readonly label = 'Addons';

  private _addonsContainer: HTMLElement;

  public build(container: HTMLElement): void {
    // Description
    const description = document.createElement('p');
    description.textContent = 'Addons can be loaded and unloaded on a particular terminal to extend its functionality.';
    container.appendChild(description);

    // Addons container (checkboxes go here)
    this._addonsContainer = document.createElement('div');
    this._addonsContainer.id = 'addons-container';
    container.appendChild(this._addonsContainer);
  }

  public get addonsContainer(): HTMLElement {
    return this._addonsContainer;
  }
}
