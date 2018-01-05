/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IMouseZoneManager, IMouseZone } from './Interfaces';
import { ITerminal } from '../Interfaces';

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
  private _clickListener: (e: MouseEvent) => any;

  private _tooltipTimeout: number = null;
  private _currentZone: IMouseZone = null;
  private _lastHoverCoords: [number, number] = [null, null];

  constructor(
    private _terminal: ITerminal
  ) {
    this._terminal.element.addEventListener('mousedown', e => this._onMouseDown(e));

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

  public clearAll(start?: number, end?: number): void {
    // Exit if there's nothing to clear
    if (this._zones.length === 0) {
      return;
    }

    // Clear all if start/end weren't set
    if (!end) {
      start = 0;
      end = this._terminal.rows - 1;
    }

    // Iterate through zones and clear them out if they're within the range
    for (let i = 0; i < this._zones.length; i++) {
      const zone = this._zones[i];
      if (zone.y > start && zone.y <= end + 1) {
        if (this._currentZone && this._currentZone === zone) {
          this._currentZone.leaveCallback();
          this._currentZone = null;
        }
        this._zones.splice(i--, 1);
      }
    }

    // Deactivate the mouse zone manager if all the zones have been removed
    if (this._zones.length === 0) {
      this._deactivate();
    }
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
    // TODO: Ideally this would only clear the hover state when the mouse moves
    // outside of the mouse zone
    if (this._lastHoverCoords[0] !== e.pageX || this._lastHoverCoords[1] !== e.pageY) {
      this._onHover(e);
      // Record the current coordinates
      this._lastHoverCoords = [e.pageX, e.pageY];
    }
  }

  private _onHover(e: MouseEvent): void {
    const zone = this._findZoneEventAt(e);

    // Do nothing if the zone is the same
    if (zone === this._currentZone) {
      return;
    }

    // Fire the hover end callback and cancel any existing timer if a new zone
    // is being hovered
    if (this._currentZone) {
      this._currentZone.leaveCallback();
      this._currentZone = null;
      if (this._tooltipTimeout) {
        clearTimeout(this._tooltipTimeout);
      }
    }

    // Exit if there is not zone
    if (!zone) {
      return;
    }
    this._currentZone = zone;

    // Trigger the hover callback
    if (zone.hoverCallback) {
      zone.hoverCallback(e);
    }

    // Restart the tooltip timeout
    this._tooltipTimeout = <number><any>setTimeout(() => this._onTooltip(e), HOVER_DURATION);
  }

  private _onTooltip(e: MouseEvent): void {
    this._tooltipTimeout = null;
    const zone = this._findZoneEventAt(e);
    if (zone && zone.tooltipCallback) {
      zone.tooltipCallback(e);
    }
  }

  private _onMouseDown(e: MouseEvent): void {
    // Ignore the event if there are no zones active
    if (!this._areZonesActive) {
      return;
    }

    // Find the active zone, prevent event propagation if found to prevent other
    // components from handling the mouse event.
    const zone = this._findZoneEventAt(e);
    if (zone) {
      // TODO: When link modifier support is added, the event should only be
      // cancelled when the modifier is held (see #1021)
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  private _onClick(e: MouseEvent): void {
    // Find the active zone and click it if found
    const zone = this._findZoneEventAt(e);
    if (zone) {
      zone.clickCallback(e);
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  private _findZoneEventAt(e: MouseEvent): IMouseZone {
    const coords = this._terminal.mouseHelper.getCoords(e, this._terminal.element, this._terminal.charMeasure, this._terminal.options.lineHeight, this._terminal.cols, this._terminal.rows);
    if (!coords) {
      return null;
    }
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
    public hoverCallback?: (e: MouseEvent) => any,
    public tooltipCallback?: (e: MouseEvent) => any,
    public leaveCallback?: () => void
  ) {
  }
}
