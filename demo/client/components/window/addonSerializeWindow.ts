/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal } from '@xterm/xterm';
import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';
import type { AddonCollection } from '../../types';

export class AddonSerializeWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-serialize';
  public readonly label = 'serialize';

  private _serializeOutputPre: HTMLPreElement;
  private _htmlSerializeOutputPre: HTMLPreElement;
  private _htmlSerializeOutputResult: HTMLElement;
  private _writeToTerminalCheckbox: HTMLInputElement;

  public build(container: HTMLElement): void {
    const wrapper = document.createElement('div');

    // Serialize button
    const serializeBtn = document.createElement('button');
    serializeBtn.id = 'serialize';
    serializeBtn.textContent = 'Serialize the content of terminal';
    serializeBtn.addEventListener('click', () => this._serializeButtonHandler());
    wrapper.appendChild(serializeBtn);

    // Write to terminal checkbox
    const writeLabel = document.createElement('label');
    this._writeToTerminalCheckbox = document.createElement('input');
    this._writeToTerminalCheckbox.type = 'checkbox';
    this._writeToTerminalCheckbox.id = 'write-to-terminal';
    writeLabel.appendChild(this._writeToTerminalCheckbox);
    writeLabel.appendChild(document.createTextNode('Write back to terminal'));
    wrapper.appendChild(writeLabel);

    // Serialize output
    const outputDiv = document.createElement('div');
    this._serializeOutputPre = document.createElement('pre');
    this._serializeOutputPre.id = 'serialize-output';
    outputDiv.appendChild(this._serializeOutputPre);
    wrapper.appendChild(outputDiv);

    // HTML serialize button
    const htmlSerializeBtn = document.createElement('button');
    htmlSerializeBtn.id = 'htmlserialize';
    htmlSerializeBtn.textContent = 'Serialize the content of terminal in HTML';
    htmlSerializeBtn.addEventListener('click', () => this._htmlSerializeButtonHandler());
    wrapper.appendChild(htmlSerializeBtn);

    // HTML serialize result
    this._htmlSerializeOutputResult = document.createElement('span');
    this._htmlSerializeOutputResult.id = 'htmlserialize-output-result';
    wrapper.appendChild(this._htmlSerializeOutputResult);

    // HTML serialize output
    const htmlOutputDiv = document.createElement('div');
    this._htmlSerializeOutputPre = document.createElement('pre');
    this._htmlSerializeOutputPre.id = 'htmlserialize-output';
    htmlOutputDiv.appendChild(this._htmlSerializeOutputPre);
    wrapper.appendChild(htmlOutputDiv);

    container.appendChild(wrapper);
  }

  private _serializeButtonHandler(): void {
    const output = this._addons.serialize.instance.serialize();
    const outputString = JSON.stringify(output);

    this._serializeOutputPre.innerText = outputString;
    if (this._writeToTerminalCheckbox.checked) {
      this._terminal.reset();
      this._terminal.write(output);
    }
  }

  private _htmlSerializeButtonHandler(): void {
    const output = this._addons.serialize.instance.serializeAsHTML();
    this._htmlSerializeOutputPre.innerText = output;

    // Deprecated, but the most supported for now.
    function listener(e: any): void {
      e.clipboardData.setData('text/html', output);
      e.preventDefault();
    }
    document.addEventListener('copy', listener);
    document.execCommand('copy');
    document.removeEventListener('copy', listener);
    this._htmlSerializeOutputResult.innerText = 'Copied to clipboard';
  }
}
