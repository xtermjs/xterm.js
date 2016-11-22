/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, SourceLair Private Company <www.sourcelair.com> (MIT License)
 */

/**
 * Keyboard utilities module. This module contains utilities for dealing with keyboard interaction.
 * @module xterm/utils/Keyboard
 */

/**
 * Gets whether a KeyboardEvent is made up entirely of modifier keys.
 *
 * @param event The event to check.
 * @return Whether the KeyboardEvent is made up entirely of modifier keys.
 */
export function isModifierOnlyKeyboardEvent(event: KeyboardEvent): boolean {
  return event.keyCode === 16 || // Shift
      event.keyCode === 17 || // Control
      event.keyCode === 18 || // Alt
      event.keyCode === 91; // Meta
}
