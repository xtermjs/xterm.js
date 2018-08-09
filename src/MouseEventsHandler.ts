import { IMouseEventsHandler } from './Types';
import { addDisposableDomListener } from './ui/Lifecycle';
import { C0 } from './common/data/EscapeSequences';

/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
  * XTerm mouse events
  * http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
  * To better understand these
  * the xterm code is very helpful:
  * Relevant files:
  *   button.c, charproc.c, misc.c
  * Relevant functions in xterm/button.c:
  *   BtnCode, EmitButtonCode, EditorButton, SendMousePosition
  */
export class MouseEventsHandler implements IMouseEventsHandler {
  private _decLocator: boolean; // This is unstable and never set
  private _vt300Mouse: boolean; // This is unstable and never set

  constructor(
    private _terminal: any
  ) {
  }

  public bindMouse(): void {
    const el = this._terminal.element;
    const self = this._terminal;
    let pressed = 32;

    // mouseup, mousedown, wheel
    // left click: ^[[M 3<^[[M#3<
    // wheel up: ^[[M`3>
    function sendButton(ev: MouseEvent | WheelEvent): void {
      let button;
      let pos;

      // get the xterm-style button
      button = getButton(ev);

      // get mouse coordinates
      pos = self.mouseHelper.getRawByteCoords(ev, self.screenElement, self.charMeasure, self.options.lineHeight, self.cols, self.rows);
      if (!pos) return;

      sendEvent(button, pos);

      switch ((<any>ev).overrideType || ev.type) {
        case 'mousedown':
          pressed = button;
          break;
        case 'mouseup':
          // keep it at the left
          // button, just in case.
          pressed = 32;
          break;
        case 'wheel':
          // nothing. don't
          // interfere with
          // `pressed`.
          break;
      }
    }

    // motion example of a left click:
    // ^[[M 3<^[[M@4<^[[M@5<^[[M@6<^[[M@7<^[[M#7<
    function sendMove(ev: MouseEvent): void {
      let button = pressed;
      const pos = self.mouseHelper.getRawByteCoords(ev, self.screenElement, self.charMeasure, self.options.lineHeight, self.cols, self.rows);
      if (!pos) return;

      // buttons marked as motions
      // are incremented by 32
      button += 32;

      sendEvent(button, pos);
    }

    // encode button and
    // position to characters
    function encode(data: number[], ch: number): void {
      if (!self.utfMouse) {
        if (ch === 255) {
          data.push(0);
          return;
        }
        if (ch > 127) ch = 127;
        data.push(ch);
      } else {
        if (ch === 2047) {
          data.push(0);
          return;
        }
        if (ch < 127) {
          data.push(ch);
        } else {
          if (ch > 2047) ch = 2047;
          data.push(0xC0 | (ch >> 6));
          data.push(0x80 | (ch & 0x3F));
        }
      }
    }

    // send a mouse event:
    // regular/utf8: ^[[M Cb Cx Cy
    // urxvt: ^[[ Cb ; Cx ; Cy M
    // sgr: ^[[ Cb ; Cx ; Cy M/m
    // vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
    // locator: CSI P e ; P b ; P r ; P c ; P p & w
    function sendEvent(button: number, pos: { x: number, y: number }): void {
      // self.emit('mouse', {
      //   x: pos.x - 32,
      //   y: pos.x - 32,
      //   button: button
      // });

      if (this._vt300Mouse) {
        // NOTE: Unstable.
        // http://www.vt100.net/docs/vt3xx-gp/chapter15.html
        button &= 3;
        pos.x -= 32;
        pos.y -= 32;
        let data = C0.ESC + '[24';
        if (button === 0) data += '1';
        else if (button === 1) data += '3';
        else if (button === 2) data += '5';
        else if (button === 3) return;
        else data += '0';
        data += '~[' + pos.x + ',' + pos.y + ']\r';
        self.handler(data);
        return;
      }

      if (this._decLocator) {
        // NOTE: Unstable.
        button &= 3;
        pos.x -= 32;
        pos.y -= 32;
        if (button === 0) button = 2;
        else if (button === 1) button = 4;
        else if (button === 2) button = 6;
        else if (button === 3) button = 3;
        self.handler(C0.ESC + '['
          + button
          + ';'
          + (button === 3 ? 4 : 0)
          + ';'
          + pos.y
          + ';'
          + pos.x
          + ';'
          // Not sure what page is meant to be
          + (<any>pos).page || 0
          + '&w');
        return;
      }

      if (self.urxvtMouse) {
        pos.x -= 32;
        pos.y -= 32;
        pos.x++;
        pos.y++;
        self.handler(C0.ESC + '[' + button + ';' + pos.x + ';' + pos.y + 'M');
        return;
      }

      if (self.sgrMouse) {
        pos.x -= 32;
        pos.y -= 32;
        self.handler(C0.ESC + '[<'
          + (((button & 3) === 3 ? button & ~3 : button) - 32)
          + ';'
          + pos.x
          + ';'
          + pos.y
          + ((button & 3) === 3 ? 'm' : 'M'));
        return;
      }

      const data: number[] = [];

      encode(data, button);
      encode(data, pos.x);
      encode(data, pos.y);

      self.handler(C0.ESC + '[M' + String.fromCharCode.apply(String, data));
    }

    function getButton(ev: MouseEvent): number {
      let button;
      let shift;
      let meta;
      let ctrl;
      let mod;

      // two low bits:
      // 0 = left
      // 1 = middle
      // 2 = right
      // 3 = release
      // wheel up/down:
      // 1, and 2 - with 64 added
      switch ((<any>ev).overrideType || ev.type) {
        case 'mousedown':
          button = ev.button != null
            ? +ev.button
            : ev.which != null
              ? ev.which - 1
              : null;

          if (self.browser.isMSIE) {
            button = button === 1 ? 0 : button === 4 ? 1 : button;
          }
          break;
        case 'mouseup':
          button = 3;
          break;
        case 'DOMMouseScroll':
          button = ev.detail < 0
            ? 64
            : 65;
          break;
        case 'wheel':
          button = (<WheelEvent>ev).wheelDeltaY > 0
            ? 64
            : 65;
          break;
      }

      // next three bits are the modifiers:
      // 4 = shift, 8 = meta, 16 = control
      shift = ev.shiftKey ? 4 : 0;
      meta = ev.metaKey ? 8 : 0;
      ctrl = ev.ctrlKey ? 16 : 0;
      mod = shift | meta | ctrl;

      // no mods
      if (self.vt200Mouse) {
        // ctrl only
        mod &= ctrl;
      } else if (!self.normalMouse) {
        mod = 0;
      }

      // increment to SP
      button = (32 + (mod << 2)) + button;

      return button;
    }

    self.register(addDisposableDomListener(el, 'mousedown', (ev: MouseEvent) => {

      // Prevent the focus on the textarea from getting lost
      // and make sure we get focused on mousedown
      ev.preventDefault();
      self.focus();

      // Don't send the mouse button to the pty if mouse events are disabled or
      // if the selection manager is having selection forced (ie. a modifier is
      // held).
      if (!self.mouseEvents || self.selectionManager.shouldForceSelection(ev)) {
        return;
      }

      // send the button
      sendButton(ev);

      // fix for odd bug
      // if (self.vt200Mouse && !self.normalMouse) {
      if (self.vt200Mouse) {
        (<any>ev).overrideType = 'mouseup';
        sendButton(ev);
        return self.cancel(ev);
      }

      // TODO: All mouse handling should be pulled into its own file.

      // bind events
      let moveHandler: (event: MouseEvent) => void;
      if (self.normalMouse) {
        moveHandler = (event: MouseEvent) => {
          // Do nothing if normal mouse mode is on. This can happen if the mouse is held down when the
          // terminal exits normalMouse mode.
          if (!self.normalMouse) {
            return;
          }
          sendMove(event);
        };
        // TODO: these event listeners should be managed by the disposable, the Terminal reference may
        // be kept aroud if Terminal.dispose is fired when the mouse is down
        self._document.addEventListener('mousemove', moveHandler);
      }

      // x10 compatibility mode can't send button releases
      const handler = (ev: MouseEvent) => {
        if (self.normalMouse && !self.x10Mouse) {
          sendButton(ev);
        }
        if (moveHandler) {
          // Even though this should only be attached when self.normalMouse is true, holding the
          // mouse button down when normalMouse changes can happen. Just always try to remove it.
          self._document.removeEventListener('mousemove', moveHandler);
          moveHandler = null;
        }
        self._document.removeEventListener('mouseup', handler);
        return self.cancel(ev);
      };
      self._document.addEventListener('mouseup', handler);

      return self.cancel(ev);
    }));

    // if (self.normalMouse) {
    //  on(self.document, 'mousemove', sendMove);
    // }

    self.register(addDisposableDomListener(el, 'wheel', (ev: WheelEvent) => {
      if (!self.mouseEvents) {
        // Convert wheel events into up/down events when the buffer does not have scrollback, this
        // enables scrolling in apps hosted in the alt buffer such as vim or tmux.
        if (!self.buffer.hasScrollback) {
          const amount = self.viewport.getLinesScrolled(ev);

          // Do nothing if there's no vertical scroll
          if (amount === 0) {
            return;
          }

          // Construct and send sequences
          const sequence = C0.ESC + (self.applicationCursor ? 'O' : '[') + (ev.deltaY < 0 ? 'A' : 'B');
          let data = '';
          for (let i = 0; i < Math.abs(amount); i++) {
            data += sequence;
          }
          self.handler(data);
        }
        return;
      }
      if (self.x10Mouse || this._vt300Mouse || this._decLocator) return;
      sendButton(ev);
      ev.preventDefault();
    }));

    // allow wheel scrolling in
    // the shell for example
    self.register(addDisposableDomListener(el, 'wheel', (ev: WheelEvent) => {
      if (self.mouseEvents) return;
      self.viewport.onWheel(ev);
      return self.cancel(ev);
    }));

    self.register(addDisposableDomListener(el, 'touchstart', (ev: TouchEvent) => {
      if (self.mouseEvents) return;
      self.viewport.onTouchStart(ev);
      return self.cancel(ev);
    }));

    self.register(addDisposableDomListener(el, 'touchmove', (ev: TouchEvent) => {
      if (self.mouseEvents) return;
      self.viewport.onTouchMove(ev);
      return self.cancel(ev);
    }));
  }
}
