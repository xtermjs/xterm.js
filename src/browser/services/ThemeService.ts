/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ColorManager } from 'browser/ColorManager';
import { IThemeService } from 'browser/services/Services';
import { IColorSet, ReadonlyColorSet } from 'browser/Types';
import { Disposable } from 'common/Lifecycle';
import { IOptionsService, ITheme } from 'common/services/Services';
import { ColorIndex } from 'common/Types';

export class ThemeService extends Disposable implements IThemeService {
  public serviceBrand: undefined;

  // TODO: Merge color manager into theme service
  private _colorManager = new ColorManager();

  public get colors(): ReadonlyColorSet { return this._colorManager.colors; }

  constructor(
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    super();
    this.register(this._optionsService.onOptionChange(key => {
      if (key === 'theme') {
        this.setTheme(this._optionsService.rawOptions.theme);
      }
      this._colorManager.handleOptionsChange(key, this._optionsService.rawOptions[key]);
    }));
    this._colorManager.setTheme(this._optionsService.rawOptions.theme);
  }

  public setTheme(theme: ITheme = {}): void {
    this._colorManager.setTheme(theme);
  }

  public restoreColor(slot?: ColorIndex): void {
    this._colorManager.restoreColor(slot);
  }

  public modifyColors(callback: (colors: IColorSet) => void): void {
    callback(this._colorManager.colors);
    // TODO: Fire event
  }
}
