/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, IDisposable } from '@xterm/xterm';

/**
 * A placed image in the terminal.
 */
export interface IPlacedImage {
  /** The decoded image bitmap */
  bitmap: ImageBitmap;
  /** Column position in terminal */
  col: number;
  /** Row position in terminal (relative to buffer, not viewport) */
  row: number;
  /** Width to render (in pixels, 0 = original) */
  width: number;
  /** Height to render (in pixels, 0 = original) */
  height: number;
  /** The image ID for reference */
  id: number;
}

/**
 * Handles canvas layer management and image rendering for Kitty graphics.
 *
 * Similar to ImageRenderer in addon-image but simplified for Kitty protocol.
 */
export class KittyImageRenderer implements IDisposable {
  private _canvas: HTMLCanvasElement | undefined;
  private _ctx: CanvasRenderingContext2D | null | undefined;
  private _terminal: Terminal;
  private _placements: Map<number, IPlacedImage> = new Map();
  private _placementIdCounter = 0;
  private _renderDisposable: IDisposable | undefined;
  private _resizeDisposable: IDisposable | undefined;

  constructor(terminal: Terminal) {
    this._terminal = terminal;
  }

  /**
   * Initialize the canvas layer. Called when first image is placed.
   */
  public ensureCanvasLayer(): void {
    if (this._canvas) {
      return;
    }

    // Access internal screenElement
    const core = (this._terminal as any)._core;
    const screenElement = core?.screenElement;
    if (!screenElement) {
      console.warn('[KittyGraphicsAddon] Cannot create canvas: no screenElement');
      return;
    }

    // Get dimensions from terminal
    const dimensions = (this._terminal as any).dimensions;
    const width = dimensions?.css?.canvas?.width || 800;
    const height = dimensions?.css?.canvas?.height || 600;

    // Create canvas
    this._canvas = document.createElement('canvas');
    this._canvas.width = width;
    this._canvas.height = height;
    this._canvas.classList.add('xterm-kitty-graphics-layer');

    // Position absolutely over the terminal
    this._canvas.style.position = 'absolute';
    this._canvas.style.top = '0';
    this._canvas.style.left = '0';
    this._canvas.style.pointerEvents = 'none';
    this._canvas.style.zIndex = '10';

    screenElement.appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d', { alpha: true });

    // Hook into render events to redraw when terminal scrolls
    this._renderDisposable = this._terminal.onRender(() => this._onRender());

    // Handle resize
    this._resizeDisposable = this._terminal.onResize(() => this._onResize());
  }

  /**
   * Get cell dimensions from terminal.
   */
  public getCellSize(): { width: number; height: number } {
    const dimensions = (this._terminal as any).dimensions;
    return {
      width: dimensions?.css?.cell?.width || 9,
      height: dimensions?.css?.cell?.height || 17
    };
  }

  /**
   * Place a decoded image at cursor position.
   * @param width - Optional width in pixels (0 = original)
   * @param height - Optional height in pixels (0 = original)
   */
  public placeImage(bitmap: ImageBitmap, id: number, col?: number, row?: number, width?: number, height?: number): number {
    this.ensureCanvasLayer();

    const buffer = this._terminal.buffer.active;
    const placementId = ++this._placementIdCounter;

    const placement: IPlacedImage = {
      bitmap,
      col: col ?? buffer.cursorX,
      row: row ?? (buffer.cursorY + buffer.baseY),
      width: width || 0,
      height: height || 0,
      id
    };

    this._placements.set(placementId, placement);
    this._draw();

    return placementId;
  }

  /**
   * Remove a placed image.
   */
  public removePlacement(placementId: number): void {
    const placement = this._placements.get(placementId);
    if (placement) {
      this._placements.delete(placementId);
      this._draw();
    }
  }

  /**
   * Remove all placements for an image ID.
   */
  public removeByImageId(imageId: number): void {
    const toDelete: number[] = [];
    for (const [placementId, placement] of this._placements) {
      if (placement.id === imageId) {
        toDelete.push(placementId);
      }
    }
    for (const id of toDelete) {
      this._placements.delete(id);
    }
    if (toDelete.length > 0) {
      this._draw();
    }
  }

  /**
   * Clear all images.
   */
  public clearAll(): void {
    this._placements.clear();
    if (this._ctx && this._canvas) {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  /**
   * Redraw all placed images.
   */
  private _draw(): void {
    if (!this._ctx || !this._canvas) {
      return;
    }

    // Clear canvas
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    const buffer = this._terminal.buffer.active;
    const viewportStartRow = buffer.baseY;
    const viewportRows = this._terminal.rows;
    const cellSize = this.getCellSize();

    // Draw each placement that's visible
    for (const placement of this._placements.values()) {
      // Check if placement is in viewport
      const relativeRow = placement.row - viewportStartRow;
      if (relativeRow < 0 || relativeRow >= viewportRows) {
        continue; // Not in viewport
      }

      const x = placement.col * cellSize.width;
      const y = relativeRow * cellSize.height;

      const width = placement.width || placement.bitmap.width;
      const height = placement.height || placement.bitmap.height;

      this._ctx.drawImage(placement.bitmap, x, y, width, height);
    }
  }

  /**
   * Called when terminal renders (scrolling, content change).
   */
  private _onRender(): void {
    this._draw();
  }

  /**
   * Called when terminal resizes.
   */
  private _onResize(): void {
    if (!this._canvas) {
      return;
    }

    const dimensions = (this._terminal as any).dimensions;
    const width = dimensions?.css?.canvas?.width || 800;
    const height = dimensions?.css?.canvas?.height || 600;

    if (this._canvas.width !== width || this._canvas.height !== height) {
      this._canvas.width = width;
      this._canvas.height = height;
      this._draw();
    }
  }

  public dispose(): void {
    this._renderDisposable?.dispose();
    this._resizeDisposable?.dispose();

    // Close all bitmaps
    for (const placement of this._placements.values()) {
      placement.bitmap.close();
    }
    this._placements.clear();

    if (this._canvas) {
      this._canvas.remove();
      this._canvas = undefined;
      this._ctx = undefined;
    }
  }
}
