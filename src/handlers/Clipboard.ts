/**
 * Clipboard handler module: exports methods for handling all clipboard-related events in the
 * terminal.
 * @module xterm/handlers/Clipboard
 * @license MIT
 */

import { ITerminal, ISelectionManager } from '../Interfaces';

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
 * Prepares text to be pasted into the terminal by normalizing the line endings
 * @param text The pasted text that needs processing before inserting into the terminal
 */
export function prepareTextForTerminal(text: string, isMSWindows: boolean): string {
  if (isMSWindows) {
    return text.replace(/\r?\n/g, '\n');
  }
  return text;
}

/**
 * Binds copy functionality to the given terminal.
 * @param {ClipboardEvent} ev The original copy event to be handled
 */
export function copyHandler(ev: ClipboardEvent, term: ITerminal, selectionManager: ISelectionManager) {
  // We cast `window` to `any` type, because TypeScript has not declared the `clipboardData`
  // property that we use below for Internet Explorer.
  let text = prepareTextForClipboard(selectionManager.selectionText);

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
    text = prepareTextForTerminal(text, term.browser.isMSWindows);
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
 * @param ev The original right click event to be handled
 * @param term The terminal on which to apply the handled paste event
 * @param selectionManager The terminal's selection manager.
 */
export function rightClickHandler(ev: MouseEvent, textarea: HTMLTextAreaElement, selectionManager: ISelectionManager) {
  // Bring textarea at the cursor position
  textarea.style.position = 'fixed';
  textarea.style.width = '20px';
  textarea.style.height = '20px';
  textarea.style.left = (ev.clientX - 10) + 'px';
  textarea.style.top = (ev.clientY - 10) + 'px';
  textarea.style.zIndex = '1000';

  // Get textarea ready to copy from the context menu
  textarea.value = prepareTextForClipboard(selectionManager.selectionText);
  textarea.focus();
  textarea.select();

  // Reset the terminal textarea's styling
  setTimeout(function () {
    textarea.style.position = null;
    textarea.style.width = null;
    textarea.style.height = null;
    textarea.style.left = null;
    textarea.style.top = null;
    textarea.style.zIndex = null;
  }, 4);
}
