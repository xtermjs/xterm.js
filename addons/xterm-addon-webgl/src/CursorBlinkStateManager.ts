/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * The time between cursor blinks.
 */
const BLINK_INTERVAL = 600;

export class CursorBlinkStateManager {
  public isCursorVisible: boolean;

  private _animationFrame: number | undefined;
  private _blinkStartTimeout: number | undefined;
  private _blinkInterval: number | undefined;

  /**
   * The time at which the animation frame was restarted, this is used on the
   * next render to restart the timers so they don't need to restart the timers
   * multiple times over a short period.
   */
  private _animationTimeRestarted: number | undefined;

  constructor(
    isFocused: boolean,
    private _renderCallback: () => void
  ) {
    this.isCursorVisible = true;
    if (isFocused) {
      this._restartInterval();
    }
  }

  public get isPaused(): boolean { return !(this._blinkStartTimeout || this._blinkInterval); }

  public dispose(): void {
    if (this._blinkInterval) {
      window.clearInterval(this._blinkInterval);
      this._blinkInterval = undefined;
    }
    if (this._blinkStartTimeout) {
      window.clearTimeout(this._blinkStartTimeout);
      this._blinkStartTimeout = undefined;
    }
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = undefined;
    }
  }

  public restartBlinkAnimation(): void {
    if (this.isPaused) {
      return;
    }
    // Save a timestamp so that the restart can be done on the next interval
    this._animationTimeRestarted = Date.now();
    // Force a cursor render to ensure it's visible and in the correct position
    this.isCursorVisible = true;
    if (!this._animationFrame) {
      this._animationFrame = window.requestAnimationFrame(() => {
        this._renderCallback();
        this._animationFrame = undefined;
      });
    }
  }

  private _restartInterval(timeToStart: number = BLINK_INTERVAL): void {
    // Clear any existing interval
    if (this._blinkInterval) {
      window.clearInterval(this._blinkInterval);
    }

    // Setup the initial timeout which will hide the cursor, this is done before
    // the regular interval is setup in order to support restarting the blink
    // animation in a lightweight way (without thrashing clearInterval and
    // setInterval).
    this._blinkStartTimeout = <number><any>setTimeout(() => {
      // Check if another animation restart was requested while this was being
      // started
      if (this._animationTimeRestarted) {
        const time = BLINK_INTERVAL - (Date.now() - this._animationTimeRestarted);
        this._animationTimeRestarted = undefined;
        if (time > 0) {
          this._restartInterval(time);
          return;
        }
      }

      // Hide the cursor
      this.isCursorVisible = false;
      this._animationFrame = window.requestAnimationFrame(() => {
        this._renderCallback();
        this._animationFrame = undefined;
      });

      // Setup the blink interval
      this._blinkInterval = <number><any>setInterval(() => {
        // Adjust the animation time if it was restarted
        if (this._animationTimeRestarted) {
          // calc time diff
          // Make restart interval do a setTimeout initially?
          const time = BLINK_INTERVAL - (Date.now() - this._animationTimeRestarted);
          this._animationTimeRestarted = undefined;
          this._restartInterval(time);
          return;
        }

        // Invert visibility and render
        this.isCursorVisible = !this.isCursorVisible;
        this._animationFrame = window.requestAnimationFrame(() => {
          this._renderCallback();
          this._animationFrame = undefined;
        });
      }, BLINK_INTERVAL);
    }, timeToStart);
  }

  public pause(): void {
    this.isCursorVisible = true;
    if (this._blinkInterval) {
      window.clearInterval(this._blinkInterval);
      this._blinkInterval = undefined;
    }
    if (this._blinkStartTimeout) {
      window.clearTimeout(this._blinkStartTimeout);
      this._blinkStartTimeout = undefined;
    }
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = undefined;
    }
  }

  public resume(): void {
    this._animationTimeRestarted = undefined;
    this._restartInterval();
    this.restartBlinkAnimation();
  }
}
