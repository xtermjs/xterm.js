import { IMouseZoneManager, IMouseZone } from './Interfaces';
import { ITerminal } from '../Interfaces';
import { getCoords } from '../utils/Mouse';

const HOVER_DURATION = 500;

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

  private _hoverTimeout: number;
  private _lastHoverCoords: [number, number] = [null, null];

  constructor(
    private _terminal: ITerminal
  ) {
    // These events are expensive, only listen to it when mouse zones are active
    this._mouseMoveListener = e => this._onMouseMove(e);
    this._clickListener = e => this._onClick(e);
  }

  public add(zone: IMouseZone): void {
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
      this._areZonesActive = true;
      this._terminal.element.addEventListener('mousemove', this._mouseMoveListener);
      this._terminal.element.addEventListener('click', this._clickListener);
    }
  }

  private _deactivate(): void {
    if (this._areZonesActive) {
      this._areZonesActive = false;
      this._terminal.element.removeEventListener('mousemove', this._mouseMoveListener);
      this._terminal.element.removeEventListener('click', this._clickListener);
    }
  }

  private _onMouseMove(e: MouseEvent): void {
    if (this._lastHoverCoords[0] !== e.pageX && this._lastHoverCoords[1] !== e.pageY) {
      if (this._hoverTimeout) {
        clearTimeout(this._hoverTimeout);
      }
      this._hoverTimeout = <number><any>setTimeout(() => this._onHover(e), HOVER_DURATION);
      this._lastHoverCoords = [e.pageX, e.pageY];
    }
  }

  private _onHover(e: MouseEvent): void {
    const coords = getCoords(e, this._terminal.element, this._terminal.charMeasure, this._terminal.options.lineHeight, this._terminal.cols, this._terminal.rows);
    const zone = this._findZoneEventAt(e);
    if (zone && zone.hoverCallback) {
      zone.hoverCallback(e);
    }
  }

  private _onClick(e: MouseEvent): void {
    const zone = this._findZoneEventAt(e);
    if (zone) {
      zone.clickCallback(e);
      e.preventDefault();
    }
  }

  private _findZoneEventAt(e: MouseEvent): IMouseZone {
    const coords = getCoords(e, this._terminal.element, this._terminal.charMeasure, this._terminal.options.lineHeight, this._terminal.cols, this._terminal.rows);
    for (let i = 0; i < this._zones.length; i++) {
      const zone = this._zones[i];
      if (zone.y === coords[1] && zone.x1 <= coords[0] && zone.x2 > coords[0]) {
        return zone;
      }
    };
    return null;
  }
}

export class MouseZone implements IMouseZone {
  constructor(
    public x1: number,
    public x2: number,
    public y: number,
    public clickCallback: (e: MouseEvent) => any,
    public hoverCallback?: (e: MouseEvent) => any
  ) {
  }
}
