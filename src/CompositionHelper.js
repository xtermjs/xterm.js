/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, SourceLair Limited <www.sourcelair.com> (MIT License)
 */

/**
 * Encapsulates the logic for handling compositionstart, compositionupdate and compositionend
 * events, displaying the in-progress composition to the UI and forwarding the final composition
 * to the handler.
 * @param {HTMLTextAreaElement} textarea The textarea that xterm uses for input.
 * @param {HTMLElement} compositionView The element to display the in-progress composition in.
 * @param {Terminal} terminal The Terminal to forward the finished composition to.
 */
function CompositionHelper(textarea, compositionView, terminal) {
  this.textarea = textarea;
  this.compositionView = compositionView;
  this.terminal = terminal;

  // Whether input composition is currently happening, eg. via a mobile keyboard, speech input
  // or IME. This variable determines whether the compositionText should be displayed on the UI.
  this.isComposing = false;

  // The input currently being composed, eg. via a mobile keyboard, speech input or IME.
  this.compositionText = null;

  // The position within the input textarea's value of the current composition.
  this.compositionPosition = { start: null, end: null };

  // Whether a composition is in the process of being sent, setting this to false will cancel
  // any in-progress composition.
  this.isSendingComposition = false;
}

/**
 * Handles the compositionstart event, activating the composition view.
 */
CompositionHelper.prototype.compositionstart = function() {
  this.isComposing = true;
  this.compositionPosition.start = this.textarea.value.length;
  this.compositionView.textContent = '';
  this.compositionView.classList.add('active');
};

/**
 * Handles the compositionupdate event, updating the composition view.
 * @param {CompositionEvent} ev The event.
 */
CompositionHelper.prototype.compositionupdate = function(ev) {
  this.compositionView.textContent = ev.data;
  this.updateCompositionElements();
  var self = this;
  setTimeout(function() {
    self.compositionPosition.end = self.textarea.value.length;
  }, 0);
};

/**
 * Handles the compositionend event, hiding the composition view and sending the composition to
 * the handler.
 */
CompositionHelper.prototype.compositionend = function() {
  this.finalizeComposition(true);
};

/**
 * Handles the keydown event, routing any necessary events to the CompositionHelper functions.
 * @return Whether the Terminal should continue processing the keydown event.
 */
CompositionHelper.prototype.keydown = function(ev) {
  if (this.isComposing || this.isSendingComposition) {
    if (ev.keyCode === 229) {
      // Continue composing if the keyCode is the "composition character"
      return false;
    } else if (ev.keyCode === 16 || ev.keyCode === 17 || ev.keyCode === 18) {
      // Continue composing if the keyCode is a modifier key
      return false;
    } else {
      // Finish composition immediately. This is mainly here for the case where enter is
      // pressed and the handler needs to be triggered before the command is executed.
      this.finalizeComposition(false);
    }
  }

  if (ev.keyCode === 229) {
    // If the "composition character" is used but gets to this point it means a non-composition
    // character (eg. numbers and punctuation) was pressed when the IME was active.
    this.handleAnyTextareaChanges();
    return false;
  }

  return true;
};

/**
 * Finalizes the composition, resuming regular input actions. This is called when a composition
 * is ending.
 * @param {boolean} waitForPropogation Whether to wait for events to propogate before sending
 *   the input. This should be false if a non-composition keystroke is entered before the
 *   compositionend event is triggered, such as enter, so that the composition is send before
 *   the command is executed.
 */
CompositionHelper.prototype.finalizeComposition = function(waitForPropogation) {
  this.compositionView.classList.remove('active');
  this.isComposing = false;
  this.clearTextareaPosition();

  if (!waitForPropogation) {
    // Cancel any delayed composition send requests and send the input immediately.
    this.isSendingComposition = false;
    var input = this.textarea.value.substring(this.compositionPosition.start, this.compositionPosition.end);
    this.terminal.handler(input);
  } else {
    // Make a deep copy of the composition position here as a new compositionstart event may
    // fire before the setTimeout executes.
    var currentCompositionPosition = {
      start: this.compositionPosition.start,
      end: this.compositionPosition.end,
    }

    // Since composition* events happen before the changes take place in the textarea on most
    // browsers, use a setTimeout with 0ms time to allow the native compositionend event to
    // complete. This ensures the correct character is retrieved, this solution was used
    // because:
    // - The compositionend event's data property is unreliable, at least on Chromium
    // - The last compositionupdate event's data property does not always accurately describe
    //   the character, a counter example being Korean where an ending consonsant can move to
    //   the following character if the following input is a vowel.
    var self = this;
    this.isSendingComposition = true;
    setTimeout(function () {
      // Ensure that the input has not already been sent
      if (self.isSendingComposition) {
        self.isSendingComposition = false;
        var input;
        if (self.isComposing) {
          // Use the end position to get the string if a new composition has started.
          input = self.textarea.value.substring(currentCompositionPosition.start, currentCompositionPosition.end);
        } else {
          // Don't use the end position here in order to pick up any characters after the
          // composition has finished, for example when typing a non-composition character
          // (eg. 2) after a composition character.
          input = self.textarea.value.substring(currentCompositionPosition.start);
        }
        self.terminal.handler(input);
      }
    }, 0);
  }
};

/**
 * Apply any changes made to the textarea after the current event chain is allowed to complete.
 * This should be called when not currently composing but a keydown event with the "composition
 * character" (229) is triggered, in order to allow non-composition text to be entered when an
 * IME is active.
 */
CompositionHelper.prototype.handleAnyTextareaChanges = function() {
  var oldValue = this.textarea.value;
  var self = this;
  setTimeout(function() {
    // Ignore if a composition has started since the timeout
    if (!self.isComposing) {
      var newValue = self.textarea.value;
      var diff = newValue.replace(oldValue, '');
      if (diff.length > 0) {
        self.terminal.handler(diff);
      }
    }
  }, 0);
};

/**
 * Positions the composition view on top of the cursor and the textarea just below it (so the
 * IME helper dialog is positioned correctly).
 */
CompositionHelper.prototype.updateCompositionElements = function(dontRecurse) {
  if (!this.isComposing) {
    return;
  }
  var cursor = this.terminal.element.querySelector('.terminal-cursor');
  if (cursor) {
    this.compositionView.style.left = cursor.offsetLeft + 'px';
    this.compositionView.style.top = cursor.offsetTop + 'px';
    var compositionViewBounds = this.compositionView.getBoundingClientRect();
    this.textarea.style.left = cursor.offsetLeft + compositionViewBounds.width + 'px';
    this.textarea.style.top = (cursor.offsetTop + cursor.offsetHeight) + 'px';
  }
  if (!dontRecurse) {
    setTimeout(this.updateCompositionElements.bind(this, true), 0);
  }
};

/**
 * Clears the textarea's position so that the cursor does not blink on IE.
 * @private
 */
CompositionHelper.prototype.clearTextareaPosition = function() {
  this.textarea.style.left = '';
  this.textarea.style.top = '';
};

export { CompositionHelper };
