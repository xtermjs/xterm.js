/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IOptionsService } from 'common/services/Services';
import { EventEmitter } from 'common/EventEmitter';
import { ICharSizeService } from 'browser/services/Services';
import { Disposable } from 'common/Lifecycle';
import { ITerminalOptions } from 'common/Types';

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
    this._measureStrategy = new DomMeasureStrategy(document, parentElement, this._optionsService);
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

  public measure(): IReadonlyMeasureResult {
    this._measureElement.style.fontFamily = this._optionsService.rawOptions.fontFamily;
    this._measureElement.style.fontSize = `${this._optionsService.rawOptions.fontSize}px`;

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
