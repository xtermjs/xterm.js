/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export default abstract class BaseCharAtlas {
  private _didWarmUp: boolean = false;

  /**
   * Perform any work needed to warm the cache before it can be used. May be called multiple times.
   * Implement _doWarmUp instead if you only want to get called once.
   */
  public warmUp(): void {
    if (!this._didWarmUp) {
      this._doWarmUp();
      this._didWarmUp = true;
    }
  }

  /**
   * Perform any work needed to warm the cache before it can be used. Used by the default
   * implementation of warmUp(), and will only be called once.
   */
  protected _doWarmUp(): void { }

  /**
   * Called when we start drawing a new frame.
   *
   * TODO: We rely on this getting called by TextRenderLayer. This should really be called by
   * Renderer instead, but we need to make Renderer the source-of-truth for the char atlas, instead
   * of BaseRenderLayer.
   */
  public beginFrame(): void { }

  /**
   * May be called before warmUp finishes, however it is okay for the implementation to
   * do nothing and return false in that case.
   *
   * @param ctx Where to draw the character onto.
   * @param chars The character(s) to draw. This is typically a single character bug can be made up
   * of multiple when character joiners are used.
   * @param code The character code.
   * @param bg The background color.
   * @param fg The foreground color.
   * @param bold Whether the text is bold.
   * @param dim Whether the text is dim.
   * @param italic Whether the text is italic.
   * @param x The position on the context to start drawing at
   * @param y The position on the context to start drawing at
   * @returns The success state. True if we drew the character.
   */
  public abstract draw(
    ctx: CanvasRenderingContext2D,
    chars: string,
    code: number,
    bg: number,
    fg: number,
    bold: boolean,
    dim: boolean,
    italic: boolean,
    x: number,
    y: number
  ): boolean;
}
