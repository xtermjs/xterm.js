/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IOptionsService } from 'common/services/Services';
import { IEvent, EventEmitter } from 'common/EventEmitter';
import { ICharSizeService } from 'browser/services/Services';
import { throwIfFalsy } from 'browser/renderer/RendererUtils';

export class CharSizeService implements ICharSizeService {
  public serviceBrand: undefined;

  public width: number = 0;
  public height: number = 0;
  private _measureStrategy: IMeasureStrategy;

  public get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }

  private _onCharSizeChange = new EventEmitter<void>();
  public get onCharSizeChange(): IEvent<void> { return this._onCharSizeChange.event; }

  constructor(
    document: Document,
    parentElement: HTMLElement,
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    this._measureStrategy = new TextMetricsMeasureStrategy(document, this._optionsService);
    // TODO: Switch out when it throws
    // this._measureStrategy = new DomMeasureStrategy(document, parentElement, this._optionsService);
  }

  public measure(): void {
    const result = this._measureStrategy.measure();
    if (result.width !== this.width || result.height !== this.height) {
      this.width = result.width;
      this.height = result.height;
      this._onCharSizeChange.fire();
    }
  }
}

interface IMeasureStrategy {
  measure(): Readonly<IMeasureResult>;
}

interface IMeasureResult {
  width: number;
  height: number;
}

// TODO: For supporting browsers we should also provide a CanvasCharDimensionsProvider that uses ctx.measureText
class DomMeasureStrategy implements IMeasureStrategy {
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

  public measure(): Readonly<IMeasureResult> {
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

class TextMetricsMeasureStrategy implements IMeasureStrategy {
  private _result: IMeasureResult = { width: 0, height: 0 };

  constructor(
    private _document: Document,
    private _optionsService: IOptionsService
  ) {
  }

  public measure(): Readonly<IMeasureResult> {
    const canvas = this._document.createElement('canvas');
    const ctx = throwIfFalsy(canvas.getContext('2d'));
    ctx.font = `${this._optionsService.options.fontSize}px ${this._optionsService.options.fontFamily}`;
    const metrics = ctx.measureText('W');
    this._result.height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    this._result.width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    return this._result;
  }
}
