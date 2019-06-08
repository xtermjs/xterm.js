/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IOptionsService } from 'common/options/Types';
import { IEvent, EventEmitter2 } from 'common/EventEmitter2';
import { ICharDimensionsService } from 'ui/services/Services';

export class CharDimensionsService implements ICharDimensionsService {
  public width: number = 0;
  public height: number = 0;
  private _charDimensionsStrategy: ICharDimensionsStrategy;

  private _onCharDimensionsChange = new EventEmitter2<string>();
  public get onCharDimensionsChange(): IEvent<string> { return this._onCharDimensionsChange.event; }

  constructor(
    document: Document,
    parentElement: HTMLElement,
    private _optionsService: IOptionsService
  ) {
    this._charDimensionsStrategy = new DomCharDimensionsStrategy(document, parentElement, this._optionsService);
  }

  public measure(): void {
    const result = this._charDimensionsStrategy.measure();
    this.width = result.width;
    this.height = result.height;
  }
}

interface ICharDimensionsStrategy {
  measure(): IReadonlyMeasureResult;
}

interface IReadonlyMeasureResult {
  readonly width: number;
  readonly height: number;
}

interface IMeasureResult {
  width: number;
  height: number;
}

// TODO: For supporting browsers we should also provide a CanvasCharDimensionsProvider that uses ctx.measureText
class DomCharDimensionsStrategy implements ICharDimensionsStrategy {
  private _result: IMeasureResult = { width: 0, height: 0 };
  private _measureElement: HTMLElement;

  constructor(
    private _document: Document,
    private _parentElement: HTMLElement,
    private _optionsService: IOptionsService
  ) {
    this._measureElement = this._document.createElement('span');
    this._measureElement.classList.add('xterm-char-measure-element');
    this._measureElement.textContent = 'W';
    this._measureElement.setAttribute('aria-hidden', 'true');
    this._parentElement.appendChild(this._measureElement);
  }

  public measure(): IReadonlyMeasureResult {
    this._measureElement.style.fontFamily = this._optionsService.options.fontFamily;
    this._measureElement.style.fontSize = `${this._optionsService.options.fontSize}px`;

    // Note that this triggers a synchronous layout
    const geometry = this._measureElement.getBoundingClientRect();

    // If values are 0 then the element is likely currently display:none, in which case we should
    // retain the previous value.
    if (geometry.width !== 0 && geometry.height !== 0) {
      this._result.width = geometry.width;
      this._result.height = Math.ceil(geometry.height);
    }

    return this._result;
  }
}
