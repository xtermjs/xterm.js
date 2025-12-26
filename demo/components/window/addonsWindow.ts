/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/// <reference path="../../../typings/xterm.d.ts"/>

import type { Terminal } from '@xterm/xterm';
import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';
import type { AddonCollection } from 'types';
import type { IImageAddonOptions } from '@xterm/addon-image';

export class AddonsWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addons';
  public readonly label = 'Addons';

  private _addonsContainer: HTMLElement;
  private _findNextInput: HTMLInputElement;
  private _findPreviousInput: HTMLInputElement;
  private _findResultsSpan: HTMLElement;
  private _regexCheckbox: HTMLInputElement;
  private _caseSensitiveCheckbox: HTMLInputElement;
  private _wholeWordCheckbox: HTMLInputElement;
  private _highlightAllMatchesCheckbox: HTMLInputElement;
  private _serializeOutputPre: HTMLPreElement;
  private _htmlSerializeOutputPre: HTMLPreElement;
  private _htmlSerializeOutputResult: HTMLElement;
  private _writeToTerminalCheckbox: HTMLInputElement;
  private _imageStorageLimitInput: HTMLInputElement;
  private _imageShowPlaceholderCheckbox: HTMLInputElement;
  private _imageOptionsTextarea: HTMLTextAreaElement;

  public build(container: HTMLElement): void {
    // Heading
    const heading = document.createElement('h3');
    heading.textContent = 'Addons';
    container.appendChild(heading);

    // Description
    const description = document.createElement('p');
    description.textContent = 'Addons can be loaded and unloaded on a particular terminal to extend its functionality.';
    container.appendChild(description);

    // Addons container (checkboxes go here)
    this._addonsContainer = document.createElement('div');
    this._addonsContainer.id = 'addons-container';
    container.appendChild(this._addonsContainer);

    // Addons Control section
    const controlHeading = document.createElement('h3');
    controlHeading.textContent = 'Addons Control';
    container.appendChild(controlHeading);

    // SearchAddon section
    this._buildSearchSection(container);

    // SerializeAddon section
    this._buildSerializeSection(container);

    // ImageAddon section
    this._buildImageSection(container);
    initImageAddonExposed(this._terminal, this._addons);
  }

  private _buildSearchSection(container: HTMLElement): void {
    const h4 = document.createElement('h4');
    h4.textContent = 'SearchAddon';
    container.appendChild(h4);

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';

    // Find next
    const findNextLabel = document.createElement('label');
    findNextLabel.textContent = 'Find next ';
    this._findNextInput = document.createElement('input');
    this._findNextInput.id = 'find-next';
    findNextLabel.appendChild(this._findNextInput);
    wrapper.appendChild(findNextLabel);

    // Find previous
    const findPrevLabel = document.createElement('label');
    findPrevLabel.textContent = 'Find previous ';
    this._findPreviousInput = document.createElement('input');
    this._findPreviousInput.id = 'find-previous';
    findPrevLabel.appendChild(this._findPreviousInput);
    wrapper.appendChild(findPrevLabel);

    // Results
    const resultsDiv = document.createElement('div');
    resultsDiv.textContent = 'Results: ';
    this._findResultsSpan = document.createElement('span');
    this._findResultsSpan.id = 'find-results';
    resultsDiv.appendChild(this._findResultsSpan);
    wrapper.appendChild(resultsDiv);

    // Regex checkbox
    const regexLabel = document.createElement('label');
    this._regexCheckbox = document.createElement('input');
    this._regexCheckbox.type = 'checkbox';
    this._regexCheckbox.id = 'regex';
    regexLabel.appendChild(this._regexCheckbox);
    regexLabel.appendChild(document.createTextNode('Use regex'));
    wrapper.appendChild(regexLabel);

    // Case sensitive checkbox
    const caseLabel = document.createElement('label');
    this._caseSensitiveCheckbox = document.createElement('input');
    this._caseSensitiveCheckbox.type = 'checkbox';
    this._caseSensitiveCheckbox.id = 'case-sensitive';
    caseLabel.appendChild(this._caseSensitiveCheckbox);
    caseLabel.appendChild(document.createTextNode('Case sensitive'));
    wrapper.appendChild(caseLabel);

    // Whole word checkbox
    const wholeWordLabel = document.createElement('label');
    this._wholeWordCheckbox = document.createElement('input');
    this._wholeWordCheckbox.type = 'checkbox';
    this._wholeWordCheckbox.id = 'whole-word';
    wholeWordLabel.appendChild(this._wholeWordCheckbox);
    wholeWordLabel.appendChild(document.createTextNode('Whole word'));
    wrapper.appendChild(wholeWordLabel);

    // Highlight all matches checkbox
    const highlightLabel = document.createElement('label');
    this._highlightAllMatchesCheckbox = document.createElement('input');
    this._highlightAllMatchesCheckbox.type = 'checkbox';
    this._highlightAllMatchesCheckbox.id = 'highlight-all-matches';
    this._highlightAllMatchesCheckbox.checked = true;
    highlightLabel.appendChild(this._highlightAllMatchesCheckbox);
    highlightLabel.appendChild(document.createTextNode('Highlight All Matches'));
    wrapper.appendChild(highlightLabel);

    container.appendChild(wrapper);
  }

  private _buildSerializeSection(container: HTMLElement): void {
    const h4 = document.createElement('h4');
    h4.textContent = 'SerializeAddon';
    container.appendChild(h4);

    const wrapper = document.createElement('div');

    // Serialize button
    const serializeBtn = document.createElement('button');
    serializeBtn.id = 'serialize';
    serializeBtn.textContent = 'Serialize the content of terminal';
    serializeBtn.addEventListener('click', () => serializeButtonHandler(this._terminal, this._addons));
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
    htmlSerializeBtn.addEventListener('click', () => htmlSerializeButtonHandler(this._terminal, this._addons));
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

  private _buildImageSection(container: HTMLElement): void {
    const h4 = document.createElement('h4');
    h4.textContent = 'Image Addon';
    container.appendChild(h4);

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'image addon settings';
    details.appendChild(summary);

    const wrapper = document.createElement('div');

    // Storage limit
    const storageLimitLabel = document.createElement('label');
    storageLimitLabel.textContent = 'Storage Limit (in MB) ';
    this._imageStorageLimitInput = document.createElement('input');
    this._imageStorageLimitInput.type = 'number';
    this._imageStorageLimitInput.id = 'image-storagelimit';
    storageLimitLabel.appendChild(this._imageStorageLimitInput);
    wrapper.appendChild(storageLimitLabel);
    wrapper.appendChild(document.createElement('br'));

    // Show placeholder
    const placeholderLabel = document.createElement('label');
    placeholderLabel.textContent = 'Show Placeholder ';
    this._imageShowPlaceholderCheckbox = document.createElement('input');
    this._imageShowPlaceholderCheckbox.type = 'checkbox';
    this._imageShowPlaceholderCheckbox.id = 'image-showplaceholder';
    placeholderLabel.appendChild(this._imageShowPlaceholderCheckbox);
    wrapper.appendChild(placeholderLabel);
    wrapper.appendChild(document.createElement('br'));
    wrapper.appendChild(document.createElement('br'));

    // Ctor options
    const optionsLabel = document.createElement('label');
    optionsLabel.appendChild(document.createTextNode('Ctor options (applied on addon relaunch)'));
    optionsLabel.appendChild(document.createElement('br'));
    this._imageOptionsTextarea = document.createElement('textarea');
    this._imageOptionsTextarea.id = 'image-options';
    this._imageOptionsTextarea.cols = 40;
    this._imageOptionsTextarea.rows = 12;
    optionsLabel.appendChild(this._imageOptionsTextarea);
    wrapper.appendChild(optionsLabel);

    details.appendChild(wrapper);
    container.appendChild(details);
  }

  public get addonsContainer(): HTMLElement {
    return this._addonsContainer;
  }

  public get findNextInput(): HTMLInputElement {
    return this._findNextInput;
  }

  public get findPreviousInput(): HTMLInputElement {
    return this._findPreviousInput;
  }

  public get findResultsSpan(): HTMLElement {
    return this._findResultsSpan;
  }
}


function serializeButtonHandler(term: Terminal, addons: AddonCollection): void {
  const output = addons.serialize.instance.serialize();
  const outputString = JSON.stringify(output);

  document.getElementById('serialize-output').innerText = outputString;
  if ((document.getElementById('write-to-terminal') as HTMLInputElement).checked) {
    term.reset();
    term.write(output);
  }
}

function htmlSerializeButtonHandler(term: Terminal, addons: AddonCollection): void {
  const output = addons.serialize.instance.serializeAsHTML();
  document.getElementById('htmlserialize-output').innerText = output;

  // Deprecated, but the most supported for now.
  function listener(e: any): void {
    e.clipboardData.setData('text/html', output);
    e.preventDefault();
  }
  document.addEventListener('copy', listener);
  document.execCommand('copy');
  document.removeEventListener('copy', listener);
  document.getElementById('htmlserialize-output-result').innerText = 'Copied to clipboard';
}

function initImageAddonExposed(term: Terminal, addons: AddonCollection): void {
  const DEFAULT_OPTIONS: IImageAddonOptions = (addons.image.instance as any)._defaultOpts;
  const limitStorageElement = document.querySelector<HTMLInputElement>('#image-storagelimit');
  limitStorageElement.valueAsNumber = addons.image.instance.storageLimit;
  addDomListener(term, limitStorageElement, 'change', () => {
    try {
      addons.image.instance.storageLimit = limitStorageElement.valueAsNumber;
      limitStorageElement.valueAsNumber = addons.image.instance.storageLimit;
      console.log('changed storageLimit to', addons.image.instance.storageLimit);
    } catch (e) {
      limitStorageElement.valueAsNumber = addons.image.instance.storageLimit;
      console.log('storageLimit at', addons.image.instance.storageLimit);
      throw e;
    }
  });
  const showPlaceholderElement = document.querySelector<HTMLInputElement>('#image-showplaceholder');
  showPlaceholderElement.checked = addons.image.instance.showPlaceholder;
  addDomListener(term, showPlaceholderElement, 'change', () => {
    addons.image.instance.showPlaceholder = showPlaceholderElement.checked;
  });
  const ctorOptionsElement = document.querySelector<HTMLTextAreaElement>('#image-options');
  ctorOptionsElement.value = JSON.stringify(DEFAULT_OPTIONS, null, 2);

  const sixelDemo = (url: string) => () => fetch(url)
    .then(resp => resp.arrayBuffer())
    .then(buffer => {
      term.write('\r\n');
      term.write(new Uint8Array(buffer));
    });

  const iipDemo = (url: string) => () => fetch(url)
    .then(resp => resp.arrayBuffer())
    .then(buffer => {
      const data = new Uint8Array(buffer);
      let sdata = '';
      for (let i = 0; i < data.length; ++i) sdata += String.fromCharCode(data[i]);
      term.write('\r\n');
      term.write(`\x1b]1337;File=inline=1;size=${data.length}:${btoa(sdata)}\x1b\\`);
    });

  document.getElementById('image-demo1').addEventListener('click',
    sixelDemo('https://raw.githubusercontent.com/saitoha/libsixel/master/images/snake.six'));
  document.getElementById('image-demo2').addEventListener('click',
    sixelDemo('https://raw.githubusercontent.com/jerch/node-sixel/master/testfiles/test2.sixel'));
  document.getElementById('image-demo3').addEventListener('click',
    iipDemo('https://raw.githubusercontent.com/jerch/node-sixel/master/palette.png'));

  // demo for image retrieval API
  term.element.addEventListener('click', (ev: MouseEvent) => {
    if (!ev.ctrlKey || !addons.image.instance) return;

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

    const pos = (term as any)._core._mouseService!.getCoords(ev, (term as any)._core.screenElement!, term.cols, term.rows);
    const x = pos[0] - 1;
    const y = pos[1] - 1;
    const canvas = ev.shiftKey
      // ctrl+shift+click: get single tile
      ? addons.image.instance.extractTileAtBufferCell(x, term.buffer.active.viewportY + y)
      // ctrl+click: get original image
      : addons.image.instance.getImageAtBufferCell(x, term.buffer.active.viewportY + y);
    canvas?.toBlob(data => window.open(URL.createObjectURL(data), '_blank'));
  });
}

function addDomListener(term: Terminal, element: HTMLElement, type: string, handler: (...args: any[]) => any): void {
  element.addEventListener(type, handler);
  (term as any)._core._register({ dispose: () => element.removeEventListener(type, handler) });
}