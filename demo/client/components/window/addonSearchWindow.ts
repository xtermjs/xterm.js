/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';

export class AddonSearchWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-search';
  public readonly label = 'search';

  private _findNextInput: HTMLInputElement;
  private _findPreviousInput: HTMLInputElement;
  private _findResultsSpan: HTMLElement;
  private _regexCheckbox: HTMLInputElement;
  private _caseSensitiveCheckbox: HTMLInputElement;
  private _wholeWordCheckbox: HTMLInputElement;
  private _highlightAllMatchesCheckbox: HTMLInputElement;

  public build(container: HTMLElement): void {
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
