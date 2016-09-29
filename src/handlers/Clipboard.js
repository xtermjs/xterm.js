/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, SourceLair Private Company <www.sourcelair.com> (MIT License)
 */

/**
 * Clipboard handler module. This module contains methods for handling all
 * clipboard-related events appropriately in the terminal.
 * @module xterm/handlers/Clipboard
 */

/**
 * Prepares text copied from terminal selection, to be saved in the clipboard by:
 *   1. stripping all trailing white spaces
 *   2. converting all non-breaking spaces to regular spaces
 * @param {string} text The copied text that needs processing for storing in clipboard
 * @returns {string}
 */
function prepareTextForClipboard(text) {
  var space = String.fromCharCode(32),
      nonBreakingSpace = String.fromCharCode(160),
      allNonBreakingSpaces = new RegExp(nonBreakingSpace, 'g'),
      processedText = text.split('\n').map(function (line) {
        // Strip all trailing white spaces and convert all non-breaking spaces
        // to regular spaces.
        var processedLine = line.replace(/\s+$/g, '').replace(allNonBreakingSpaces, space);

        return processedLine;
      }).join('\n');

  return processedText;
}

/**
 * Binds copy functionality to the given terminal.
 * @param {ClipboardEvent} ev The original copy event to be handled
 */
function copyHandler (ev) {
  var copiedText = window.getSelection().toString(),
      text = prepareTextForClipboard(copiedText);

  ev.clipboardData.setData('text/plain', text);
  ev.preventDefault(); // Prevent or the original text will be copied.
}

/**
 * Redirect the clipboard's data to the terminal's input handler.
 * @param {ClipboardEvent} ev The original paste event to be handled
 * @param {Terminal} term The terminal on which to apply the handled paste event
 */
function pasteHandler(ev, term) {
  ev.stopPropagation();
  if (ev.clipboardData) {
    var text = ev.clipboardData.getData('text/plain');
    term.handler(text);
    term.textarea.value = '';
    return term.cancel(ev);
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
 * @param {ClipboardEvent} ev The original paste event to be handled
 * @param {Terminal} term The terminal on which to apply the handled paste event
 */
function rightClickHandler(ev, term) {
  var s = document.getSelection(),
      sText = prepareTextForClipboard(s.toString()),
      r = s.getRangeAt(0);

  var x = ev.clientX,
      y = ev.clientY;

  var cr = r.getClientRects(),
      clickIsOnSelection = false,
      i, rect;

  for (i=0; i<cr.length; i++) {
    rect = cr[i];
    clickIsOnSelection = (
      (x > rect.left) && (x < rect.right) &&
      (y > rect.top) && (y < rect.bottom)
    );
    // If we clicked on selection and selection is not a single space,
    // then mark the right click as copy-only. We check for the single
    // space selection, as this can happen when clicking on an &nbsp;
    // and there is not much pointing in copying a single space.
    // Single space is char
    if (clickIsOnSelection && (sText !== ' ')) {
      break;
    }
  }

  // Bring textarea at the cursor position
  if (!clickIsOnSelection) {
    term.textarea.style.position = 'fixed';
    term.textarea.style.width = '10px';
    term.textarea.style.height = '10px';
    term.textarea.style.left = x + 'px';
    term.textarea.style.top = y + 'px';
    term.textarea.style.zIndex = 1000;
    term.textarea.focus();

    // Reset the terminal textarea's styling
    setTimeout(function () {
      term.textarea.style.position = null;
      term.textarea.style.width = null;
      term.textarea.style.height = null;
      term.textarea.style.left = null;
      term.textarea.style.top = null;
      term.textarea.style.zIndex = null;
    }, 1);
  }
}

export {
  prepareTextForClipboard, copyHandler, pasteHandler, rightClickHandler
};
