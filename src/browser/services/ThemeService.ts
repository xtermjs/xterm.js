/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ColorManager } from 'browser/ColorManager';
import { IThemeService } from 'browser/services/Services';
import { IColorSet, ReadonlyColorSet } from 'browser/Types';
import { EventEmitter } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IOptionsService, ITheme } from 'common/services/Services';
import { ColorIndex } from 'common/Types';

export class ThemeService extends Disposable implements IThemeService {
  public serviceBrand: undefined;

  // TODO: Merge color manager into theme service
  private _colorManager = new ColorManager();

  public get colors(): ReadonlyColorSet { return this._colorManager.colors; }

  private readonly _onChangeColors = this.register(new EventEmitter<ReadonlyColorSet>());
  public readonly onChangeColors = this._onChangeColors.event;

  constructor(
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    super();
    this.register(this._optionsService.onOptionChange(key => {
      if (key === 'theme') {
        this._setTheme(this._optionsService.rawOptions.theme);
      }
      this._colorManager.handleOptionsChange(key, this._optionsService.rawOptions[key]);
    }));
    this._colorManager.setTheme(this._optionsService.rawOptions.theme);
  }

  private _setTheme(theme: ITheme = {}): void {
    this._colorManager.setTheme(theme);
    this._onChangeColors.fire(this.colors);
  }

  public restoreColor(slot?: ColorIndex): void {
    this._colorManager.restoreColor(slot);
    this._onChangeColors.fire(this.colors);
  }

  public modifyColors(callback: (colors: IColorSet) => void): void {
    callback(this._colorManager.colors);
    // Assume the change happened
    this._onChangeColors.fire(this.colors);
  }
}
