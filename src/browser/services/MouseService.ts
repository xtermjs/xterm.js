/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { addDisposableListener } from 'browser/Dom';
import { IBufferService, IMouseStateService, ICoreService, ILogService, IOptionsService } from 'common/services/Services';
import { CoreMouseAction, CoreMouseButton, CoreMouseEventType, IDisposable } from 'common/Types';
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
        const lines = this._mouseStateService.consumeWheelEvent(
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

    return this._mouseStateService.triggerMouseEvent({
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

      const lines = this._mouseStateService.consumeWheelEvent(
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

  private _handleProtocolChange(ctx: IMouseBindContext, eventListeners: Record<'mouseup' | 'wheel' | 'mousedrag' | 'mousemove', EventListener>, events: CoreMouseEventType): void {
    const { element, document } = ctx.target;
    const { requestedEvents } = ctx;
    // apply global changes on events
    if (events) {
      if (this._optionsService.rawOptions.logLevel === 'debug') {
        this._logService.debug('Binding to mouse events:', this._mouseStateService.explainEvents(events));
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

}
