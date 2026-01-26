import { Emitter } from 'vs/base/common/event';
import { IDirectionService } from 'browser/services/Services';

export class DirectionService implements IDirectionService {
  public serviceBrand: undefined;
  private _direction: 'ltr' | 'rtl' = 'ltr';
  private readonly _onDirectionChange = new Emitter<'ltr' | 'rtl'>();
  public readonly onDirectionChange = this._onDirectionChange.event;

  public get direction(): 'ltr' | 'rtl' {
    return this._direction;
  }

  public get isRtl(): boolean {
    return this._direction === 'rtl';
  }

  public setDirection(direction: 'ltr' | 'rtl'): void {
    if (this._direction !== direction) {
      this._direction = direction;
      this._onDirectionChange.fire(direction);
    }
  }
}