/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Disposable } from 'common/Lifecycle';
import { addDisposableDomListener } from 'browser/Lifecycle';
import { IMouseService, ISelectionService } from 'browser/services/Services';
import { IMouseZoneManager, IMouseZone } from 'browser/Types';
import { IBufferService, IOptionsService } from 'common/services/Services';

/**
 * The MouseZoneManager allows components to register zones within the terminal
 * that trigger hover and click callbacks.
 *
 * This class was intentionally made not so robust initially as the only case it
 * needed to support was single-line links which never overlap. Improvements can
 * be made in the future.
 */
export class MouseZoneManager extends Disposable implements IMouseZoneManager {
  private _zones: IMouseZone[] = [];

  private _areZonesActive: boolean = false;
  private _mouseMoveListener: (e: MouseEvent) => any;
  private _mouseLeaveListener: (e: MouseEvent) => any;
  private _clickListener: (e: MouseEvent) => any;

  private _tooltipTimeout: number | undefined;
  private _currentZone: IMouseZone | undefined;
  private _lastHoverCoords: [number | undefined, number | undefined] = [undefined, undefined];
  private _initialSelectionLength: number = 0;

  constructor(
    private readonly _element: HTMLElement,
    private readonly _screenElement: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService,
    @IMouseService private readonly _mouseService: IMouseService,
    @ISelectionService private readonly _selectionService: ISelectionService,
    @IOptionsService private readonly _optionsService: IOptionsService
  ) {
    super();

    this.register(addDisposableDomListener(this._element, 'mousedown', e => this._onMouseDown(e)));

    // These events are expensive, only listen to it when mouse zones are active
    this._mouseMoveListener = e => this._onMouseMove(e);
    this._mouseLeaveListener = e => this._onMouseLeave(e);
    this._clickListener = e => this._onClick(e);
  }

  public dispose(): void {
    super.dispose();
    this._deactivate();
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
    if (!start || !end) {
      start = 0;
      end = this._bufferService.rows - 1;
    }

    // Iterate through zones and clear them out if they're within the range
    for (let i = 0; i < this._zones.length; i++) {
      const zone = this._zones[i];
      if ((zone.y1 > start && zone.y1 <= end + 1) ||
          (zone.y2 > start && zone.y2 <= end + 1) ||
          (zone.y1 < start && zone.y2 > end + 1)) {
        if (this._currentZone && this._currentZone === zone) {
          this._currentZone.leaveCallback();
          this._currentZone = undefined;
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
      this._element.addEventListener('mousemove', this._mouseMoveListener);
      this._element.addEventListener('mouseleave', this._mouseLeaveListener);
      this._element.addEventListener('click', this._clickListener);
    }
  }

  private _deactivate(): void {
    if (this._areZonesActive) {
      this._areZonesActive = false;
      this._element.removeEventListener('mousemove', this._mouseMoveListener);
      this._element.removeEventListener('mouseleave', this._mouseLeaveListener);
      this._element.removeEventListener('click', this._clickListener);
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
      this._currentZone = undefined;
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
    this._tooltipTimeout = window.setTimeout(() => this._onTooltip(e), this._optionsService.rawOptions.linkTooltipHoverDuration);
  }

  private _onTooltip(e: MouseEvent): void {
    this._tooltipTimeout = undefined;
    const zone = this._findZoneEventAt(e);
    zone?.tooltipCallback(e);
  }

  private _onMouseDown(e: MouseEvent): void {
    // Store current terminal selection length, to check if we're performing
    // a selection operation
    this._initialSelectionLength = this._getSelectionLength();

    // Ignore the event if there are no zones active
    if (!this._areZonesActive) {
      return;
    }

    // Find the active zone, prevent event propagation if found to prevent other
    // components from handling the mouse event.
    const zone = this._findZoneEventAt(e);
    if (zone?.willLinkActivate(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  private _onMouseLeave(e: MouseEvent): void {
    // Fire the hover end callback and cancel any existing timer if the mouse
    // leaves the terminal element
    if (this._currentZone) {
      this._currentZone.leaveCallback();
      this._currentZone = undefined;
      if (this._tooltipTimeout) {
        clearTimeout(this._tooltipTimeout);
      }
    }
  }

  private _onClick(e: MouseEvent): void {
    // Find the active zone and click it if found and no selection was
    // being performed
    const zone = this._findZoneEventAt(e);
    const currentSelectionLength = this._getSelectionLength();

    if (zone && currentSelectionLength === this._initialSelectionLength) {
      zone.clickCallback(e);
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  private _getSelectionLength(): number {
    const selectionText = this._selectionService.selectionText;
    return selectionText ? selectionText.length : 0;
  }

  private _findZoneEventAt(e: MouseEvent): IMouseZone | undefined {
    const coords = this._mouseService.getCoords(e, this._screenElement, this._bufferService.cols, this._bufferService.rows);
    if (!coords) {
      return undefined;
    }
    const x = coords[0];
    const y = coords[1];
    for (let i = 0; i < this._zones.length; i++) {
      const zone = this._zones[i];
      if (zone.y1 === zone.y2) {
        // Single line link
        if (y === zone.y1 && x >= zone.x1 && x < zone.x2) {
          return zone;
        }
      } else {
        // Multi-line link
        if ((y === zone.y1 && x >= zone.x1) ||
            (y === zone.y2 && x < zone.x2) ||
            (y > zone.y1 && y < zone.y2)) {
          return zone;
        }
      }
    }
    return undefined;
  }
}
