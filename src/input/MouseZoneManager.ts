import { IMouseZoneManager, IMouseZone } from './Interfaces';
import { ITerminal } from '../Interfaces';

/**
 * The MouseZoneManager allows components to register zones within the terminal
 * that trigger hover and click callbacks.
 *
 * This class was intentionally made not so robust initially as the only case it
 * needed to support was single-line links which never overlap. Improvements can
 * be made in the future.
 */
export class MouseZoneManager implements IMouseZoneManager {
  private _zones: IMouseZone[] = [];

  private _areZonesActive: boolean = false;
  private _mouseMoveListener: (e: MouseEvent) => any;
  private _mouseDownListener: (e: MouseEvent) => any;
  private _clickListener: (e: MouseEvent) => any;

  constructor(
    private _terminal: ITerminal
  ) {
    // These events are expensive, only listen to it when mouse zones are active
    this._mouseMoveListener = e => this._onMouseMove(e);
    this._clickListener = e => this._onClick(e);
  }

  public add(zone: IMouseZone): void {
    console.log('add zone', zone);
    this._zones.push(zone);
    if (this._zones.length === 1) {
      this._activate();
    }
  }

  public clearAll(): void {
    this._zones.length = 0;
    this._deactivate();
  }

  private _activate(): void {
    if (!this._areZonesActive) {
      console.log('_addMoveListener');
      this._areZonesActive = true;
      this._terminal.element.addEventListener('mousemove', this._mouseMoveListener);
      this._terminal.element.addEventListener('click', this._clickListener);
    }
  }

  private _deactivate(): void {
    if (this._areZonesActive) {
      console.log('_removeMoveListener');
      this._areZonesActive = false;
      this._terminal.element.removeEventListener('mousemove', this._mouseMoveListener);
      this._terminal.element.removeEventListener('click', this._clickListener);
    }
  }

  private _onMouseMove(e: MouseEvent): void {
    console.log('move');
    // TODO: Handle hover
  }

  private _onClick(e: MouseEvent): void {
    const zone = this._findZoneEventAt(e);
    if (zone) {
      zone.clickCallback(e);
      e.preventDefault();
    }
  }

  private _findZoneEventAt(e: MouseEvent): IMouseZone {
    return this._zones[0];
  }
}

export class MouseZone implements IMouseZone {
  constructor(
    public x1: number,
    public x2: number,
    public hoverCallback: (e: MouseEvent) => any,
    public clickCallback: (e: MouseEvent) => any
  ) {
  }
}
