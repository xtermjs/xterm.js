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

  public setIntervalDuration(duration: number): void {
    if (duration === this._intervalDuration) {
      return;
    }

    this._intervalDuration = duration;
    this._clearInterval();

    const wasBlinkOn = this._blinkOn;
    if (duration > 0) {
      this._blinkOn = true;
      this._interval = this._coreBrowserService.window.setInterval(() => {
        this._blinkOn = !this._blinkOn;
        this._renderCallback();
      }, duration);
      if (!wasBlinkOn) {
        this._renderCallback();
      }
    } else {
      this._blinkOn = true;
      if (!wasBlinkOn) {
        this._renderCallback();
      }
    }
  }

  private _clearInterval(): void {
    if (this._interval !== undefined) {
      this._coreBrowserService.window.clearInterval(this._interval);
      this._interval = undefined;
    }
  }
}
