/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { addDisposableListener } from 'browser/Dom';
import { IBufferService, IMouseStateService, ICoreService, ILogService, IOptionsService } from 'common/services/Services';
import { CoreMouseAction, CoreMouseButton, CoreMouseEventType, ICoreMouseEvent, IDisposable } from 'common/Types';
import { C0 } from 'common/data/EscapeSequences';
import { toDisposable } from 'common/Lifecycle';
import { ICoreBrowserService, IMouseCoordsService, IMouseService, IMouseServiceTarget, IRenderService, ISelectionService } from './Services';

type RequestedMouseEvents = Record<'mouseup' | 'wheel' | 'mousedrag' | 'mousemove', EventListener | null>;

interface IMouseBindContext {
  readonly target: IMouseServiceTarget;
  readonly focus: () => void;
  readonly requestedEvents: RequestedMouseEvents;
}

export class MouseService implements IMouseService {
  public serviceBrand: undefined;

  private _lastEvent: ICoreMouseEvent | null = null;
  private _wheelPartialScroll: number = 0;

  constructor(
    @IRenderService private readonly _renderService: IRenderService,
    @IMouseCoordsService private readonly _mouseCoordsService: IMouseCoordsService,
    @IMouseStateService private readonly _mouseStateService: IMouseStateService,
    @ICoreService private readonly _coreService: ICoreService,
    @IBufferService private readonly _bufferService: IBufferService,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @ISelectionService private readonly _selectionService: ISelectionService,
    @ILogService private readonly _logService: ILogService,
    @ICoreBrowserService private readonly _coreBrowserService: ICoreBrowserService
  ) {
  }

  public bindMouse(target: IMouseServiceTarget, register: (disposable: IDisposable) => void, focus: () => void): void {
    const { element, document } = target;

    /**
     * Event listener state handling.
     * We listen to the onProtocolChange event of MouseStateService and put
     * requested listeners in `requestedEvents`. With this the listeners
     * have all bits to do the event listener juggling.
     * Note: 'mousedown' currently is "always on" and not managed
     * by onProtocolChange.
     */
    const requestedEvents: RequestedMouseEvents = {
      mouseup: null,
      wheel: null,
      mousedrag: null,
      mousemove: null
    };
    const ctx: IMouseBindContext = { target, focus, requestedEvents };
    const eventListeners: Record<'mouseup' | 'wheel' | 'mousedrag' | 'mousemove', EventListener> = {
      mouseup: (ev: Event) => this._handleMouseUp(ctx, ev as MouseEvent),
      wheel: (ev: Event) => this._handleWheel(ctx, ev as WheelEvent),
      mousedrag: (ev: Event) => this._handleMouseDrag(ctx, ev as MouseEvent),
      mousemove: (ev: Event) => this._handleMouseMove(ctx, ev as MouseEvent)
    };
    register(this._mouseStateService.onProtocolChange(events => {
      this._handleProtocolChange(ctx, eventListeners, events);
    }));
    // force initial onProtocolChange so we dont miss early mouse requests
    this._mouseStateService.activeProtocol = this._mouseStateService.activeProtocol;

    // Ensure document-level listeners are removed on dispose
    register(toDisposable(() => {
      if (requestedEvents.mouseup) {
        document.removeEventListener('mouseup', requestedEvents.mouseup);
      }
      if (requestedEvents.mousedrag) {
        document.removeEventListener('mousemove', requestedEvents.mousedrag);
      }
    }));

    /**
     * "Always on" event listeners.
     */
    register(addDisposableListener(element, 'mousedown', (ev: MouseEvent) => this._handleMouseDown(ctx, ev)));
    register(addDisposableListener(element, 'wheel', (ev: WheelEvent) => this._handlePassiveWheel(ctx, ev), { passive: false }));
  }

  private _sendEvent(ctx: IMouseBindContext, ev: MouseEvent | WheelEvent): boolean {
    // Get mouse coordinates
    const pos = this._mouseCoordsService.getMouseReportCoords(ev as MouseEvent, ctx.target.screenElement);
    if (!pos) {
      return false;
    }

    let but: CoreMouseButton;
    let action: CoreMouseAction | undefined;
    switch ((ev as MouseEvent & { overrideType?: string }).overrideType || ev.type) {
      case 'mousemove':
        action = CoreMouseAction.MOVE;
        if (ev.buttons === undefined) {
          // buttons is not supported on macOS, try to get a value from button instead
          but = CoreMouseButton.NONE;
          if (ev.button !== undefined) {
            but = ev.button < 3 ? ev.button : CoreMouseButton.NONE;
          }
        } else {
          // according to MDN buttons only reports up to button 5 (AUX2)
          but = ev.buttons & 1 ? CoreMouseButton.LEFT :
            ev.buttons & 4 ? CoreMouseButton.MIDDLE :
              ev.buttons & 2 ? CoreMouseButton.RIGHT :
                CoreMouseButton.NONE; // fallback to NONE
        }
        break;
      case 'mouseup':
        action = CoreMouseAction.UP;
        but = ev.button < 3 ? ev.button : CoreMouseButton.NONE;
        break;
      case 'mousedown':
        action = CoreMouseAction.DOWN;
        but = ev.button < 3 ? ev.button : CoreMouseButton.NONE;
        break;
      case 'wheel':
        if (!this._mouseStateService.allowCustomWheelEvent(ev as WheelEvent)) {
          return false;
        }
        const deltaY = (ev as WheelEvent).deltaY;
        if (deltaY === 0) {
          return false;
        }
        const lines = this._consumeWheelEvent(
          ev as WheelEvent,
          this._renderService?.dimensions?.device?.cell?.height,
          this._coreBrowserService?.dpr
        );
        if (lines === 0) {
          return false;
        }
        action = deltaY < 0 ? CoreMouseAction.UP : CoreMouseAction.DOWN;
        but = CoreMouseButton.WHEEL;
        break;
      default:
        // dont handle other event types by accident
        return false;
    }

    // exit if we cannot determine valid button/action values
    // do nothing for higher buttons than wheel
    if (action === undefined || but === undefined || but > CoreMouseButton.WHEEL) {
      return false;
    }

    return this._triggerMouseEvent({
      col: pos.col,
      row: pos.row,
      x: pos.x,
      y: pos.y,
      button: but,
      action,
      ctrl: ev.ctrlKey,
      alt: ev.altKey,
      shift: ev.shiftKey
    });
  }

  private _handleMouseUp(ctx: IMouseBindContext, ev: MouseEvent): void {
    this._sendEvent(ctx, ev);
    if (!ev.buttons) {
      // if no other button is held remove global handlers
      if (ctx.requestedEvents.mouseup) {
        ctx.target.document.removeEventListener('mouseup', ctx.requestedEvents.mouseup);
      }
      if (ctx.requestedEvents.mousedrag) {
        ctx.target.document.removeEventListener('mousemove', ctx.requestedEvents.mousedrag);
      }
    }
  }

  private _handleWheel(ctx: IMouseBindContext, ev: WheelEvent): false {
    this._sendEvent(ctx, ev);
    ev.preventDefault();
    ev.stopPropagation();
    return false;
  }

  private _handleMouseDrag(ctx: IMouseBindContext, ev: MouseEvent): void {
    // deal only with move while a button is held
    if (ev.buttons) {
      this._sendEvent(ctx, ev);
    }
  }

  private _handleMouseMove(ctx: IMouseBindContext, ev: MouseEvent): void {
    // deal only with move without any button
    if (!ev.buttons) {
      this._sendEvent(ctx, ev);
    }
  }

  private _handleMouseDown(ctx: IMouseBindContext, ev: MouseEvent): void {
    ev.preventDefault();
    ctx.focus();

    // Don't send the mouse button to the pty if mouse events are disabled or
    // if the selection manager is having selection forced (ie. a modifier is
    // held).
    if (!this._mouseStateService.areMouseEventsActive || this._selectionService.shouldForceSelection(ev)) {
      return;
    }

    this._sendEvent(ctx, ev);

    // Register additional global handlers which should keep reporting outside
    // of the terminal element.
    // Note: Other emulators also do this for 'mousedown' while a button
    // is held, we currently limit 'mousedown' to the terminal only.
    if (ctx.requestedEvents.mouseup) {
      ctx.target.document.addEventListener('mouseup', ctx.requestedEvents.mouseup);
    }
    if (ctx.requestedEvents.mousedrag) {
      ctx.target.document.addEventListener('mousemove', ctx.requestedEvents.mousedrag);
    }
  }

  private _handlePassiveWheel(ctx: IMouseBindContext, ev: WheelEvent): false | void {
    // do nothing, if app side handles wheel itself
    if (ctx.requestedEvents.wheel) {
      return;
    }

    if (!this._mouseStateService.allowCustomWheelEvent(ev)) {
      return false;
    }

    if (!this._bufferService.buffer.hasScrollback) {
      // Convert wheel events into up/down events when the buffer does not have scrollback, this
      // enables scrolling in apps hosted in the alt buffer such as vim or tmux even when mouse
      // events are not enabled.
      // This used implementation used get the actual lines/partial lines scrolled from the
      // viewport but since moving to the new viewport implementation has been simplified to
      // simply send a single up or down sequence.

      // Do nothing if there's no vertical scroll
      const deltaY = ev.deltaY;
      if (deltaY === 0) {
        return false;
      }

      const lines = this._consumeWheelEvent(
        ev,
        this._renderService?.dimensions?.device?.cell?.height,
        this._coreBrowserService?.dpr
      );
      if (lines === 0) {
        ev.preventDefault();
        ev.stopPropagation();
        return false;
      }

      // Construct and send sequences
      const sequence = C0.ESC + (this._coreService.decPrivateModes.applicationCursorKeys ? 'O' : '[') + (ev.deltaY < 0 ? 'A' : 'B');
      this._coreService.triggerDataEvent(sequence, true);
      ev.preventDefault();
      ev.stopPropagation();
      return false;
    }
  }

  public reset(): void {
    this._lastEvent = null;
    this._wheelPartialScroll = 0;
  }

  private _handleProtocolChange(ctx: IMouseBindContext, eventListeners: Record<'mouseup' | 'wheel' | 'mousedrag' | 'mousemove', EventListener>, events: CoreMouseEventType): void {
    const { element, document } = ctx.target;
    const { requestedEvents } = ctx;
    // apply global changes on events
    if (events) {
      if (this._optionsService.rawOptions.logLevel === 'debug') {
        this._logService.debug('Binding to mouse events:', this._explainEvents(events));
      }
      element.classList.add('enable-mouse-events');
      this._selectionService.disable();
    } else {
      this._logService.debug('Unbinding from mouse events.');
      element.classList.remove('enable-mouse-events');
      this._selectionService.enable();
    }

    // add/remove handlers from requestedEvents
    if (!(events & CoreMouseEventType.MOVE)) {
      if (requestedEvents.mousemove) {
        element.removeEventListener('mousemove', requestedEvents.mousemove);
      }
      requestedEvents.mousemove = null;
    } else if (!requestedEvents.mousemove) {
      element.addEventListener('mousemove', eventListeners.mousemove);
      requestedEvents.mousemove = eventListeners.mousemove;
    }

    if (!(events & CoreMouseEventType.WHEEL)) {
      if (requestedEvents.wheel) {
        element.removeEventListener('wheel', requestedEvents.wheel);
      }
      requestedEvents.wheel = null;
    } else if (!requestedEvents.wheel) {
      element.addEventListener('wheel', eventListeners.wheel, { passive: false });
      requestedEvents.wheel = eventListeners.wheel;
    }

    if (!(events & CoreMouseEventType.UP)) {
      if (requestedEvents.mouseup) {
        document.removeEventListener('mouseup', requestedEvents.mouseup);
      }
      requestedEvents.mouseup = null;
    } else {
      requestedEvents.mouseup ??= eventListeners.mouseup;
    }

    if (!(events & CoreMouseEventType.DRAG)) {
      if (requestedEvents.mousedrag) {
        document.removeEventListener('mousemove', requestedEvents.mousedrag);
      }
      requestedEvents.mousedrag = null;
    } else {
      requestedEvents.mousedrag ??= eventListeners.mousedrag;
    }
  }

  private _applyScrollModifier(amount: number, ev: WheelEvent): number {
    // Multiply the scroll speed when the modifier key is pressed
    if (ev.altKey || ev.ctrlKey || ev.shiftKey) {
      return amount * this._optionsService.rawOptions.fastScrollSensitivity * this._optionsService.rawOptions.scrollSensitivity;
    }
    return amount * this._optionsService.rawOptions.scrollSensitivity;
  }

  /**
   * Processes a wheel event, accounting for partial scrolls for trackpad, mouse scrolls.
   * This prevents hyper-sensitive scrolling in alt buffer.
   */
  private _consumeWheelEvent(ev: WheelEvent, cellHeight?: number, dpr?: number): number {
    // Do nothing if it's not a vertical scroll event
    if (ev.deltaY === 0 || ev.shiftKey) {
      return 0;
    }

    if (cellHeight === undefined || dpr === undefined) {
      return 0;
    }

    const targetWheelEventPixels = cellHeight / dpr;
    let amount = this._applyScrollModifier(ev.deltaY, ev);

    if (ev.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
      amount /= (targetWheelEventPixels + 0.0); // Prevent integer division

      const isLikelyTrackpad = Math.abs(ev.deltaY) < 50;
      if (isLikelyTrackpad) {
        amount *= 0.3;
      }

      this._wheelPartialScroll += amount;
      amount = Math.floor(Math.abs(this._wheelPartialScroll)) * (this._wheelPartialScroll > 0 ? 1 : -1);
      this._wheelPartialScroll %= 1;
    } else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      amount *= this._bufferService.rows;
    }
    return amount;
  }

  /**
   * Triggers a mouse event to be sent.
   *
   * Returns true if the event passed all protocol restrictions and a report
   * was sent, otherwise false. The return value may be used to decide whether
   * the default event action in the browser component should be omitted.
   *
   * Note: The method will change values of the given event object
   * to fulfill protocol and encoding restrictions.
   */
  private _triggerMouseEvent(e: ICoreMouseEvent): boolean {
    // range check for col/row
    if (e.col < 0 || e.col >= this._bufferService.cols
      || e.row < 0 || e.row >= this._bufferService.rows) {
      return false;
    }

    // filter nonsense combinations of button + action
    if (e.button === CoreMouseButton.WHEEL && e.action === CoreMouseAction.MOVE) {
      return false;
    }
    if (e.button === CoreMouseButton.NONE && e.action !== CoreMouseAction.MOVE) {
      return false;
    }
    if (e.button !== CoreMouseButton.WHEEL && (e.action === CoreMouseAction.LEFT || e.action === CoreMouseAction.RIGHT)) {
      return false;
    }

    // report 1-based coords
    e.col++;
    e.row++;

    // debounce move events at grid or pixel level
    if (e.action === CoreMouseAction.MOVE
      && this._lastEvent
      && this._equalEvents(this._lastEvent, e, this._mouseStateService.isPixelEncoding)
    ) {
      return false;
    }

    // apply protocol restrictions
    if (!this._mouseStateService.restrictMouseEvent(e)) {
      return false;
    }

    // encode report and send
    const report = this._mouseStateService.encodeMouseEvent(e);
    if (report) {
      if (this._mouseStateService.isDefaultEncoding) {
        this._coreService.triggerBinaryEvent(report);
      } else {
        this._coreService.triggerDataEvent(report, true);
      }
    }

    this._lastEvent = e;
    return true;
  }

  private _explainEvents(events: CoreMouseEventType): { [event: string]: boolean } {
    return {
      down: !!(events & CoreMouseEventType.DOWN),
      up: !!(events & CoreMouseEventType.UP),
      drag: !!(events & CoreMouseEventType.DRAG),
      move: !!(events & CoreMouseEventType.MOVE),
      wheel: !!(events & CoreMouseEventType.WHEEL)
    };
  }

  private _equalEvents(e1: ICoreMouseEvent, e2: ICoreMouseEvent, pixels: boolean): boolean {
    if (pixels) {
      if (e1.x !== e2.x) return false;
      if (e1.y !== e2.y) return false;
    } else {
      if (e1.col !== e2.col) return false;
      if (e1.row !== e2.row) return false;
    }
    if (e1.button !== e2.button) return false;
    if (e1.action !== e2.action) return false;
    if (e1.ctrl !== e2.ctrl) return false;
    if (e1.alt !== e2.alt) return false;
    if (e1.shift !== e2.shift) return false;
    return true;
  }

}
