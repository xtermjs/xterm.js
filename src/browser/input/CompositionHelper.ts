/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderService } from '../services/Services';
import { IBufferService, ICoreService, IOptionsService } from '../../common/services/Services';
import { C0 } from '../../common/data/EscapeSequences';

interface IPosition {
  start: number;
  end: number;
}

/**
 * Encapsulates the logic for handling compositionstart, compositionupdate and compositionend
 * events, displaying the in-progress composition to the UI and forwarding the final composition
 * to the handler.
 */
export class CompositionHelper {
  /**
   * Whether input composition is currently happening, eg. via a mobile keyboard, speech input or
   * IME. This variable determines whether the compositionText should be displayed on the UI.
   */
  private _isComposing: boolean;
  public get isComposing(): boolean { return this._isComposing; }

  /**
   * The position within the input textarea's value of the current composition.
   */
  private _compositionPosition: IPosition;

  /**
   * Text that existed after the composing range when composition started.
   * This is used to avoid treating existing trailing text as new input.
   */
  private _compositionSuffix: string;

  /**
   * Sends for compositions that have finished but whose text has not been forwarded yet, oldest
   * first. More than one can be outstanding: each is queued from `_finalizeComposition` and
   * flushed either by its own timer or, if a non-composition key arrives first, by the
   * synchronous path draining this queue in order. A single shared flag cannot express that —
   * clearing it to cancel one pending send used to cancel every other one too, silently dropping
   * whatever text they were carrying.
   */
  private readonly _pendingSends: (() => void)[] = [];

  /**
   * How far into the textarea's value has already been forwarded to the handler. Every send emits
   * `[max(start, _sentUpTo), end)` and pushes this forward, so no range can go out twice no matter
   * which path emits it first.
   */
  private _sentUpTo: number;

  /**
   * Data already sent due to keydown event.
   */
  private _dataAlreadySent: string;

  /**
   * The pending textarea change timer, if any.
   */
  private _textareaChangeTimer?: number;

  constructor(
    private readonly _textarea: HTMLTextAreaElement,
    private readonly _compositionView: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @ICoreService private readonly _coreService: ICoreService,
    @IRenderService private readonly _renderService: IRenderService
  ) {
    this._isComposing = false;
    this._sentUpTo = 0;
    this._compositionPosition = { start: 0, end: 0 };
    this._compositionSuffix = '';
    this._dataAlreadySent = '';
  }

  /**
   * Handles the compositionstart event, activating the composition view.
   */
  public compositionstart(): void {
    this._isComposing = true;
    // It's important to use the selection here instead of textarea length to avoid conflicts with
    // screen reader mode
    const start = this._textarea.selectionStart ?? this._textarea.value.length;
    const end = this._textarea.selectionEnd ?? start;
    this._compositionPosition.start = Math.min(start, end);
    this._compositionPosition.end = Math.max(start, end);
    this._compositionSuffix = this._textarea.value.substring(this._compositionPosition.end);
    // The watermark is an absolute offset into the textarea, so it has to come back down if the
    // value was rewritten underneath us (eg. by _syncTextArea) and offsets no longer line up.
    this._sentUpTo = Math.min(this._sentUpTo, this._compositionPosition.start);
    this._compositionView.textContent = '';
    this._dataAlreadySent = '';
    this._compositionView.classList.add('active');
  }

  /**
   * Handles the compositionupdate event, updating the composition view.
   * @param ev The event.
   */
  public compositionupdate(ev: Pick<CompositionEvent, 'data'>): void {
    // Mark text as LTR, direction=rtl is used in CSS so the end of the text is followed for long
    // compositions
    this._compositionView.textContent = `\u200E${ev.data}\u200E`;
    this.updateCompositionElements();
    setTimeout(() => {
      const end = this._textarea.selectionEnd ?? this._textarea.value.length;
      this._compositionPosition.end = Math.max( this._compositionPosition.start, end);
    }, 0);
  }

  /**
   * Handles the compositionend event, hiding the composition view and sending the composition to
   * the handler.
   */
  public compositionend(): void {
    this._finalizeComposition(true);
  }

  /**
   * Handles the keydown event, routing any necessary events to the CompositionHelper functions.
   * @param ev The keydown event.
   * @returns Whether the Terminal should continue processing the keydown event.
   */
  public keydown(ev: KeyboardEvent): boolean {
    if (this._isComposing || this._pendingSends.length > 0) {
      if (ev.keyCode === 20 || ev.keyCode === 229) {
        // 20 is CapsLock, 229 is Enter
        // Continue composing if the keyCode is the "composition character"
        return false;
      }
      if (ev.keyCode === 16 || ev.keyCode === 17 || ev.keyCode === 18) {
        // Continue composing if the keyCode is a modifier key
        return false;
      }
      // Finish composition immediately. This is mainly here for the case where enter is
      // pressed and the handler needs to be triggered before the command is executed.
      this._finalizeComposition(false);
    }

    if (ev.keyCode === 229) {
      // If the "composition character" is used but gets to this point it means a non-composition
      // character (eg. numbers and punctuation) was pressed when the IME was active.
      this._handleAnyTextareaChanges();
      return false;
    }

    return true;
  }

  /**
   * Finalizes the composition, resuming regular input actions. This is called when a composition
   * is ending.
   * @param waitForPropagation Whether to wait for events to propagate before sending
   *   the input. This should be false if a non-composition keystroke is entered before the
   *   compositionend event is triggered, such as enter, so that the composition is sent before
   *   the command is executed.
   */
  private _finalizeComposition(waitForPropagation: boolean): void {
    this._compositionView.classList.remove('active');
    this._isComposing = false;

    if (!waitForPropagation) {
      // Flush anything already queued, in order, before sending our own slice. These used to be
      // cancelled here, which is only correct while at most one send can be outstanding.
      for (const send of this._pendingSends.splice(0, this._pendingSends.length)) {
        send();
      }
      const end = Math.max(this._compositionPosition.end, this._textarea.selectionEnd ?? this._compositionPosition.end);
      const input = this._sliceUnsent(this._compositionPosition.start, end);
      if (input.length > 0) {
        this._coreService.triggerDataEvent(input, true);
      }
    } else {
      // Make a deep copy of the composition position here as a new compositionstart event may
      // fire before the setTimeout executes.
      const currentCompositionPosition = {
        start: this._compositionPosition.start,
        end: this._compositionPosition.end
      };
      const currentCompositionSuffix = this._compositionSuffix;

      // Since composition* events happen before the changes take place in the textarea on most
      // browsers, use a setTimeout with 0ms time to allow the native compositionend event to
      // complete. This ensures the correct character is retrieved.
      // This solution was used because:
      // - The compositionend event's data property is unreliable, at least on Chromium
      // - The last compositionupdate event's data property does not always accurately describe
      //   the character, a counter example being Korean where an ending consonsant can move to
      //   the following character if the following input is a vowel.
      const send = (): void => {
        // Add length of data already sent due to keydown event,
        // otherwise input characters can be duplicated. (Issue #3191)
        currentCompositionPosition.start += this._dataAlreadySent.length;
        const value = this._textarea.value;
        let end: number;
        if (this._compositionPosition.start > currentCompositionPosition.start) {
          // A newer composition has started past this one, so its start is where this one ends.
          // Note this cannot test `_isComposing`: when this send is flushed by the synchronous
          // path rather than by its own timer, `_finalizeComposition` has already cleared that
          // flag, and the else branch below would read on into the newer composition's preedit.
          end = this._compositionPosition.start;
        } else {
          // Keep support for non-composition characters typed immediately after composition end
          // while avoiding re-sending the trailing text that was already present
          // before composition started.
          end = currentCompositionSuffix.length > 0 && value.endsWith(currentCompositionSuffix)
            ? value.length - currentCompositionSuffix.length
            : value.length;
        }
        const input = this._sliceUnsent(currentCompositionPosition.start, end);
        if (input.length > 0) {
          this._coreService.triggerDataEvent(input, true);
        }
      };

      this._pendingSends.push(send);
      setTimeout(() => {
        // Ensure that the input has not already been sent by the synchronous path draining it
        const i = this._pendingSends.indexOf(send);
        if (i !== -1) {
          this._pendingSends.splice(i, 1);
          send();
        }
      }, 0);
    }
  }

  /**
   * Takes the part of `[start, end)` that has not been forwarded yet and marks it as forwarded, so
   * that a range cannot be sent twice regardless of which path gets to it first.
   */
  private _sliceUnsent(start: number, end: number): string {
    const from = Math.max(start, this._sentUpTo);
    const to = Math.max(from, end);
    this._sentUpTo = Math.max(this._sentUpTo, to);
    return this._textarea.value.substring(from, to);
  }

  /**
   * Apply any changes made to the textarea after the current event chain is allowed to complete.
   * This should be called when not currently composing but a keydown event with the "composition
   * character" (229) is triggered, in order to allow non-composition text to be entered when an
   * IME is active.
   */
  private _handleAnyTextareaChanges(): void {
    if (this._textareaChangeTimer) {
      return;
    }
    const oldValue = this._textarea.value;
    this._textareaChangeTimer = window.setTimeout(() => {
      this._textareaChangeTimer = undefined;
      // Ignore if a composition has started since the timeout
      if (!this._isComposing) {
        const newValue = this._textarea.value;

        const diff = newValue.replace(oldValue, '');

        this._dataAlreadySent = diff;

        if (newValue.length > oldValue.length) {
          this._coreService.triggerDataEvent(diff, true);
        } else if (newValue.length < oldValue.length) {
          this._coreService.triggerDataEvent(`${C0.DEL}`, true);
        } else if ((newValue.length === oldValue.length) && (newValue !== oldValue)) {
          this._coreService.triggerDataEvent(newValue, true);
        }

      }
    }, 0);
  }

  /**
   * Positions the composition view on top of the cursor and the textarea just below it (so the
   * IME helper dialog is positioned correctly).
   * @param dontRecurse Whether to use setTimeout to recursively trigger another update, this is
   *   necessary as the IME events across browsers are not consistently triggered.
   */
  public updateCompositionElements(dontRecurse?: boolean): void {
    if (!this._isComposing) {
      return;
    }

    if (this._bufferService.buffer.isCursorInViewport) {
      const cursorX = Math.min(this._bufferService.buffer.x, this._bufferService.cols - 1);

      const cellHeight = this._renderService.dimensions.css.cell.height;
      const cursorTop = this._bufferService.buffer.y * this._renderService.dimensions.css.cell.height;
      const cursorLeft = cursorX * this._renderService.dimensions.css.cell.width;

      this._compositionView.style.left = cursorLeft + 'px';
      this._compositionView.style.top = cursorTop + 'px';
      this._compositionView.style.height = cellHeight + 'px';
      this._compositionView.style.lineHeight = cellHeight + 'px';
      this._compositionView.style.fontFamily = this._optionsService.rawOptions.fontFamily;
      this._compositionView.style.fontSize = this._optionsService.rawOptions.fontSize + 'px';
      // Limit the composition view width to the space between the cursor and
      // the terminal's right edge, preventing it from overflowing the terminal.
      const maxWidth = this._bufferService.cols * this._renderService.dimensions.css.cell.width - cursorLeft;
      this._compositionView.style.maxWidth = maxWidth + 'px';
      this._compositionView.style.overflow = 'hidden';
      this._compositionView.style.direction = 'rtl';
      // Sync the textarea to the exact position of the composition view so the IME knows where the
      // text is.
      const compositionViewBounds = this._compositionView.getBoundingClientRect();
      this._textarea.style.left = cursorLeft + 'px';
      this._textarea.style.top = cursorTop + 'px';
      // Ensure the text area is at least 1x1, otherwise certain IMEs may break
      this._textarea.style.width = Math.max(compositionViewBounds.width, 1) + 'px';
      this._textarea.style.height = Math.max(compositionViewBounds.height, 1) + 'px';
      this._textarea.style.lineHeight = compositionViewBounds.height + 'px';
    }

    if (!dontRecurse) {
      setTimeout(() => this.updateCompositionElements(true), 0);
    }
  }
}
