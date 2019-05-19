/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderer } from './Types';
import { RenderDebouncer } from '../ui/RenderDebouncer';

export class RenderCoordinator {
  private _renderDebouncer: RenderDebouncer;

  constructor(
    private _renderer: IRenderer,
    private _rowCount: number
  ) {
    this._renderDebouncer = new RenderDebouncer((start, end) => this._renderer.renderRows(start, end));
  }

  public refreshRows(start: number, end: number): void {
    this._renderDebouncer.refresh(start, end, this._rowCount);
  }

  public resize(cols: number, rows: number): void {
    this._rowCount = rows;
  }

  public setRenderer(renderer: IRenderer): void {
    this._renderer = renderer;
  }
}
