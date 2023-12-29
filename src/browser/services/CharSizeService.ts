/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IOptionsService } from 'common/services/Services';
import { EventEmitter } from 'common/EventEmitter';
import { ICharSizeService } from 'browser/services/Services';
import { Disposable } from 'common/Lifecycle';

export class CharSizeService extends Disposable implements ICharSizeService {
  public serviceBrand: undefined;

  public width: number = 0;
  public height: number = 0;
  private _measureStrategy: IMeasureStrategy;

  public get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }

  private readonly _onCharSizeChange = this.register(new EventEmitter<void>());
  public readonly onCharSizeChange = this._onCharSizeChange.event;

  constructor(
    document: Document,
    parentElement: HTMLElement,
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    super();
    try {
      this._measureStrategy = new TextMetricsMeasureStrategy(this._optionsService);
    } catch {
      this._measureStrategy = new DomMeasureStrategy(document, parentElement, this._optionsService);
    }
    this.register(this._optionsService.onMultipleOptionChange(['fontFamily', 'fontSize'], () => this.measure()));
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

const enum DomMeasureStrategyConstants {
  REPEAT = 32
}

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
    this._measureElement.textContent = 'W'.repeat(DomMeasureStrategyConstants.REPEAT);
    this._measureElement.setAttribute('aria-hidden', 'true');
    this._measureElement.style.whiteSpace = 'pre';
    this._measureElement.style.fontKerning = 'none';
    this._parentElement.appendChild(this._measureElement);
  }

  public measure(): Readonly<IMeasureResult> {
    this._measureElement.style.fontFamily = this._optionsService.rawOptions.fontFamily;
    this._measureElement.style.fontSize = `${this._optionsService.rawOptions.fontSize}px`;

    // Note that this triggers a synchronous layout
    const geometry = {
      height: Number(this._measureElement.offsetHeight),
      width: Number(this._measureElement.offsetWidth)
    };

    // If values are 0 then the element is likely currently display:none, in which case we should
    // retain the previous value.
    if (geometry.width !== 0 && geometry.height !== 0) {
      this._result.width = geometry.width / DomMeasureStrategyConstants.REPEAT;
      this._result.height = Math.ceil(geometry.height);
    }

    return this._result;
  }
}

class TextMetricsMeasureStrategy implements IMeasureStrategy {
  private _result: IMeasureResult = { width: 0, height: 0 };
  private _canvas: OffscreenCanvas;
  private _ctx: OffscreenCanvasRenderingContext2D;

  constructor(
    private _optionsService: IOptionsService
  ) {
    // This will throw if any required API is not supported
    this._canvas = new OffscreenCanvas(100, 100);
    this._ctx = this._canvas.getContext('2d')!;
    const a = this._ctx.measureText('W');
    if (!('width' in a && 'fontBoundingBoxAscent' in a && 'fontBoundingBoxDescent' in a)) {
      throw new Error('Required font metrics not supported');
    }
  }

  public measure(): Readonly<IMeasureResult> {
    this._ctx.font = `${this._optionsService.rawOptions.fontSize}px ${this._optionsService.rawOptions.fontFamily}`;

    const metrics = this._ctx.measureText('W');

    // Sanity check that the values are not 0
    if (metrics.width !== 0 && metrics.fontBoundingBoxAscent !== 0) {
      this._result.width = metrics.width;
      this._result.height = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);
    }

    return this._result;
  }
}
