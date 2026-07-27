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

interface IPendingComposition {
  position: IPosition;
  suffix: string;
  dataAlreadySent: string;
  inputData: string;
  keypressData: string;
  nextCompositionStart?: number;
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

  private _pendingComposition: IPendingComposition | undefined;

  private _isAwaitingCompositionEnd: boolean;

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
    this._isAwaitingCompositionEnd = false;
    this._compositionPosition = { start: 0, end: 0 };
    this._compositionSuffix = '';
    this._dataAlreadySent = '';
  }

  /**
   * Handles the compositionstart event, activating the composition view.
   */
  public compositionstart(): void {
    // It's important to use the selection here instead of textarea length to avoid conflicts with
    // screen reader mode
    const start = this._textarea.selectionStart ?? this._textarea.value.length;
    const end = this._textarea.selectionEnd ?? start;
    const compositionStart = Math.min(start, end);
    if (this._pendingComposition) {
      this._pendingComposition.nextCompositionStart = compositionStart;
    }
    this._isComposing = true;
    this._isAwaitingCompositionEnd = true;
    this._compositionPosition = {
      start: compositionStart,
      end: Math.max(start, end)
    };
    this._compositionSuffix = this._textarea.value.substring(this._compositionPosition.end);
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
    const compositionPosition = this._compositionPosition;
    setTimeout(() => {
      const end = this._textarea.selectionEnd ?? this._textarea.value.length;
      compositionPosition.end = Math.max(compositionPosition.start, end);
    }, 0);
  }

  /**
   * Handles the compositionend event, hiding the composition view and sending the composition to
   * the handler.
   */
  public compositionend(): void {
    if (!this._isAwaitingCompositionEnd) {
      return;
    }
    this._isAwaitingCompositionEnd = false;
    this._finalizeComposition(true);
  }

  /**
   * Handles the keydown event, routing any necessary events to the CompositionHelper functions.
   * @param ev The keydown event.
   * @returns Whether the Terminal should continue processing the keydown event.
   */
  public keydown(ev: KeyboardEvent): boolean {
    if (this._isComposing || this._pendingComposition) {
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
   * Defers keypress text until the preceding composition commit is resolved.
   */
  public keypress(text: string): boolean {
    if (!this._pendingComposition) {
      return false;
    }
    this._pendingComposition.keypressData += text;
    return true;
  }

  /**
   * Defers insertText data until the preceding composition commit is resolved.
   */
  public input(text: string): boolean {
    if (!this._pendingComposition) {
      return false;
    }
    this._pendingComposition.inputData += text;
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
    const wasComposing = this._isComposing;
    this._compositionView.classList.remove('active');
    this._isComposing = false;

    if (!waitForPropagation) {
      if (this._pendingComposition) {
        this._sendPendingComposition(this._pendingComposition);
        if (!wasComposing) {
          return;
        }
      }
      const input = this._textarea.value.substring(this._compositionPosition.start, this._compositionPosition.end);
      this._dataAlreadySent = input;
      this._sendCompositionInput(input, '');
    } else {
      if (this._pendingComposition) {
        this._sendPendingComposition(this._pendingComposition);
      }
      const pendingComposition: IPendingComposition = {
        position: {
          start: this._compositionPosition.start,
          end: this._compositionPosition.end
        },
        suffix: this._compositionSuffix,
        dataAlreadySent: this._dataAlreadySent,
        inputData: '',
        keypressData: ''
      };

      // Since composition* events happen before the changes take place in the textarea on most
      // browsers, use a setTimeout with 0ms time to allow the native compositionend event to
      // complete. This ensures the correct character is retrieved.
      // This solution was used because:
      // - The compositionend event's data property is unreliable, at least on Chromium
      // - The last compositionupdate event's data property does not always accurately describe
      //   the character, a counter example being Korean where an ending consonsant can move to
      //   the following character if the following input is a vowel.
      this._pendingComposition = pendingComposition;
      setTimeout(() => {
        if (this._pendingComposition === pendingComposition) {
          this._sendPendingComposition(pendingComposition);
        }
      }, 0);
    }
  }

  private _sendPendingComposition(pendingComposition: IPendingComposition): void {
    if (this._pendingComposition === pendingComposition) {
      this._pendingComposition = undefined;
    }
    const textareaInput = this._getTextareaInput(pendingComposition);
    let input = textareaInput;
    if (pendingComposition.inputData.length > 0) {
      const inputData = this._removeAlreadySentData(pendingComposition.inputData, pendingComposition.dataAlreadySent);
      // A matching keypress identifies insertText as following input, not a replacement commit.
      input = inputData === pendingComposition.keypressData
        ? this._mergeObservedData(textareaInput, inputData)
        : inputData;
    }
    this._sendCompositionInput(input, pendingComposition.keypressData, pendingComposition.nextCompositionStart !== undefined);
  }

  private _getTextareaInput(pendingComposition: IPendingComposition): string {
    const value = this._textarea.value;
    const start = pendingComposition.position.start + pendingComposition.dataAlreadySent.length;
    if (pendingComposition.nextCompositionStart !== undefined) {
      return value.substring(start, Math.max(start, pendingComposition.nextCompositionStart));
    }
    const valueEnd = pendingComposition.suffix.length > 0 && value.endsWith(pendingComposition.suffix)
      ? value.length - pendingComposition.suffix.length
      : value.length;
    return value.substring(start, Math.max(start, valueEnd));
  }

  private _removeAlreadySentData(input: string, dataAlreadySent: string): string {
    if (dataAlreadySent.length === 0) {
      return input;
    }
    if (input.startsWith(dataAlreadySent)) {
      return input.substring(dataAlreadySent.length);
    }
    return dataAlreadySent.includes(input) ? '' : input;
  }

  private _sendCompositionInput(input: string, keypressData: string, hasNextComposition: boolean = false): void {
    // A new preedit consumes unmatched keypress data during Hangul final-consonant transfer.
    if (keypressData.length > 0 && !input.includes(keypressData) && !hasNextComposition) {
      input = this._mergeObservedData(input, keypressData);
    }
    if (input.length > 0) {
      this._coreService.triggerDataEvent(input, true);
    }
  }

  private _mergeObservedData(first: string, second: string): string {
    let overlap = Math.min(first.length, second.length);
    while (overlap > 0 && !first.endsWith(second.substring(0, overlap))) {
      overlap--;
    }
    return first + second.substring(overlap);
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
