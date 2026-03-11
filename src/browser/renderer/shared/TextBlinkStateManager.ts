/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreBrowserService } from 'browser/services/Services';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { IOptionsService } from 'common/services/Services';

export class TextBlinkStateManager extends Disposable {
  private _intervalDuration: number = 0;
  private _interval: number | undefined;
  private _blinkOn: boolean = true;
  private _needsBlinkInViewport: boolean = false;
  private _isViewportVisible: boolean = true;

  constructor(
    private readonly _renderCallback: () => void,
    private readonly _coreBrowserService: ICoreBrowserService,
    private readonly _optionsService: IOptionsService
  ) {
    super();
    this._register(this._optionsService.onSpecificOptionChange('blinkIntervalDuration', duration => {
      this.setIntervalDuration(duration);
    }));
    this.setIntervalDuration(this._optionsService.rawOptions.blinkIntervalDuration);
    this._register(toDisposable(() => this._clearInterval()));
  }

  public get isBlinkOn(): boolean {
    return this._blinkOn;
  }

  public get isEnabled(): boolean {
    return this._intervalDuration > 0;
  }

  public setNeedsBlinkInViewport(needsBlinkInViewport: boolean): void {
    if (this._needsBlinkInViewport === needsBlinkInViewport) {
      return;
    }

    this._needsBlinkInViewport = needsBlinkInViewport;
    this._updateIntervalState();
  }

  public setViewportVisible(isVisible: boolean): void {
    if (this._isViewportVisible === isVisible) {
      return;
    }

    this._isViewportVisible = isVisible;
    this._updateIntervalState();
  }

  public setIntervalDuration(duration: number): void {
    if (duration === this._intervalDuration) {
      return;
    }

    this._intervalDuration = duration;
    this._clearInterval();
    this._updateIntervalState();
  }

  private _updateIntervalState(): void {
    const shouldBlink = this._intervalDuration > 0 && this._needsBlinkInViewport && this._isViewportVisible;
    if (shouldBlink) {
      if (this._interval !== undefined) {
        return;
      }
      const wasBlinkOn = this._blinkOn;
      this._blinkOn = true;
      this._interval = this._coreBrowserService.window.setInterval(() => {
        this._blinkOn = !this._blinkOn;
        this._renderCallback();
      }, this._intervalDuration);
      if (!wasBlinkOn) {
        this._renderCallback();
      }
      return;
    }

    this._clearInterval();
    if (!this._blinkOn) {
      this._blinkOn = true;
      this._renderCallback();
    }
  }

  private _clearInterval(): void {
    if (this._interval !== undefined) {
      this._coreBrowserService.window.clearInterval(this._interval);
      this._interval = undefined;
    }
  }
}
