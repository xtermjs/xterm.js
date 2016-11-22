import { assert } from 'chai';
import * as Keyboard from './Keyboard';

describe('Keyboard', () => {
  describe('isModifierOnlyKeyboardEvent', () => {
    it('should return true when only modifier keys are used', () => {
      // Note that KeyboardEvent.keyCode is deprecated but we're using it to improve browser
      // compatibility. This helper returns the `any` type because KeyboardEvent doesn't exist under
      // NodeJS.
      function createEvent(keyCode: number): any {
        return { keyCode };
      }
      assert.isTrue(Keyboard.isModifierOnlyKeyboardEvent(createEvent(16)));
      assert.isTrue(Keyboard.isModifierOnlyKeyboardEvent(createEvent(17)));
      assert.isTrue(Keyboard.isModifierOnlyKeyboardEvent(createEvent(18)));
      assert.isTrue(Keyboard.isModifierOnlyKeyboardEvent(createEvent(91)));
      assert.isFalse(Keyboard.isModifierOnlyKeyboardEvent(createEvent(19)));
      assert.isFalse(Keyboard.isModifierOnlyKeyboardEvent(createEvent(90)));
    });
  });
});
