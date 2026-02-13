/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ImageStorage } from './ImageStorage';

/**
 * IIP (iTerm Image Protocol) specific image storage controller.
 *
 * Wraps the shared ImageStorage with IIP protocol semantics:
 * - Always uses scrolling mode (cursor advances with image)
 */
export class IIPImageStorage {
  constructor(
    private readonly _storage: ImageStorage
  ) {}

  /**
   * Add an IIP image to storage.
   * Always uses scrolling mode — cursor advances past the image.
   */
  public addImage(img: HTMLCanvasElement | ImageBitmap): void {
    this._storage.addImage(img, true);
  }
}
