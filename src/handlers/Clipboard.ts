/**
 * Clipboard handler module: exports methods for handling all clipboard-related events in the
 * terminal.
 * @module xterm/handlers/Clipboard
 * @license MIT
 */

import { ITerminal } from '../Interfaces';

interface IWindow extends Window {
  clipboardData?: {
    getData(format: string): string;
    setData(format: string, data: string);
  };
}

declare var window: IWindow;

/**
 * Prepares text copied from terminal selection, to be saved in the clipboard by:
 *   1. stripping all trailing white spaces
 *   2. converting all non-breaking spaces to regular spaces
 * @param {string} text The copied text that needs processing for storing in clipboard
 * @returns {string}
 */
export function prepareTextForClipboard(text: string): string {
  let space = String.fromCharCode(32),
      nonBreakingSpace = String.fromCharCode(160),
      allNonBreakingSpaces = new RegExp(nonBreakingSpace, 'g'),
      processedText = text.split('\n').map(function (line) {
        // Strip all trailing white spaces and convert all non-breaking spaces
        // to regular spaces.
        let processedLine = line.replace(/\s+$/g, '').replace(allNonBreakingSpaces, space);

        return processedLine;
      }).join('\n');

  return processedText;
}

/**
 * Binds copy functionality to the given terminal.
 * @param {ClipboardEvent} ev The original copy event to be handled
 */
export function copyHandler(ev: ClipboardEvent, term: ITerminal) {
  // We cast `window` to `any` type, because TypeScript has not declared the `clipboardData`
  // property that we use below for Internet Explorer.
  let copiedText = window.getSelection().toString(),
      text = prepareTextForClipboard(copiedText);

  if (term.browser.isMSIE) {
    window.clipboardData.setData('Text', text);
  } else {
    ev.clipboardData.setData('text/plain', text);
  }

  ev.preventDefault(); // Prevent or the original text will be copied.
}

/**
 * Redirect the clipboard's data to the terminal's input handler.
 * @param {ClipboardEvent} ev The original paste event to be handled
 * @param {Terminal} term The terminal on which to apply the handled paste event
 */
export function pasteHandler(ev: ClipboardEvent, term: ITerminal) {
  ev.stopPropagation();

  let text: string;

  let dispatchPaste = function(text) {
    term.handler(text);
    term.textarea.value = '';
    return term.cancel(ev);
  };

  if (term.browser.isMSIE) {
    if (window.clipboardData) {
      text = window.clipboardData.getData('Text');
      dispatchPaste(text);
    }
  } else {
    if (ev.clipboardData) {
      text = ev.clipboardData.getData('text/plain');
      dispatchPaste(text);
    }
  }
}

/**
 * Bind to right-click event and allow right-click copy and paste.
 *
 * **Logic**
 * If text is selected and right-click happens on selected text, then
 * do nothing to allow seamless copying.
 * If no text is selected or right-click is outside of the selection
 * area, then bring the terminal's input below the cursor, in order to
 * trigger the event on the textarea and allow-right click paste, without
 * caring about disappearing selection.
 * @param {MouseEvent} ev The original right click event to be handled
 * @param {Terminal} term The terminal on which to apply the handled paste event
 */
export function rightClickHandler(ev: MouseEvent, term: ITerminal) {
  let s = document.getSelection(),
      selectedText = prepareTextForClipboard(s.toString()),
      clickIsOnSelection = false,
      x = ev.clientX,
      y = ev.clientY;

  if (s.rangeCount) {
    let r = s.getRangeAt(0),
        cr = r.getClientRects();

    for (let i = 0; i < cr.length; i++) {
      let rect = cr[i];

      clickIsOnSelection = (
        (x > rect.left) && (x < rect.right) &&
        (y > rect.top) && (y < rect.bottom)
      );

      if (clickIsOnSelection) {
        break;
      }
    }
    // If we clicked on selection and selection is not a single space,
    // then mark the right click as copy-only. We check for the single
    // space selection, as this can happen when clicking on an &nbsp;
    // and there is not much pointing in copying a single space.
    if (selectedText.match(/^\s$/) || !selectedText.length) {
      clickIsOnSelection = false;
    }
  }

  // Bring textarea at the cursor position
  if (!clickIsOnSelection) {
    term.textarea.style.position = 'fixed';
    term.textarea.style.width = '20px';
    term.textarea.style.height = '20px';
    term.textarea.style.left = (x - 10) + 'px';
    term.textarea.style.top = (y - 10) + 'px';
    term.textarea.style.zIndex = '1000';
    term.textarea.focus();

    // Reset the terminal textarea's styling
    setTimeout(function () {
      term.textarea.style.position = null;
      term.textarea.style.width = null;
      term.textarea.style.height = null;
      term.textarea.style.left = null;
      term.textarea.style.top = null;
      term.textarea.style.zIndex = null;
    }, 4);
  }
}
