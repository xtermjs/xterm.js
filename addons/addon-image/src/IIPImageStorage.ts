/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IAddImageOpts, IDrawable, IMetrics } from './Types';
import { ImageStorage } from './ImageStorage';

/**
 * IIP (iTerm Image Protocol) specific image storage controller.
 *
 * Wraps the shared ImageStorage with IIP protocol semantics:
 * - Always uses scrolling mode (cursor advances with image)
 */
export class IIPImageStorage {
  private _addImageOpts: IAddImageOpts = { scrolling: true, layer: 'top', zIndex: 0, cursorPos: 'iip' };
  constructor(
    private readonly _storage: ImageStorage
  ) {}

  /**
   * Add an IIP image to storage.
   * Always uses scrolling mode — cursor advances past the image.
   */
  public addImage(src: IDrawable, data: Blob | undefined, metrics: IMetrics, prescaleX: number, prescaleY: number): void {
    this._addImageOpts.prescaleX = prescaleX;
    this._addImageOpts.prescaleY = prescaleY;
    this._storage.addImage(src, data, metrics, this._addImageOpts);
  }
}
