/**
 * Debug test to reproduce the Alt+- keyboard issue
 */

import { MockCompositionHelper, MockRenderer, MockViewport, TestTerminal } from 'browser/TestUtils.test';
import type { IBrowser } from 'browser/Types';
import { evaluateKeyboardEvent } from 'common/input/Keyboard';

// Create a test to simulate the keyboard event handling
function testAltMinusKeyHandling() {
  const term = new TestTerminal({ cols: 80, rows: 24 });
  (term as any).renderer = new MockRenderer();
  (term as any).viewport = new MockViewport();
  
  // Mock the composition helper to not intercept our events
  const mockCompositionHelper = {
    keydown: () => true,
    isComposing: false
  };
  (term as any)._compositionHelper = mockCompositionHelper;
  
  (term as any).element = {
    classList: {
      toggle: () => { },
      remove: () => { }
    }
  };

  // Mock browser detection for Linux
  (term as any).browser = {
    isMac: false,
    isWindows: false,
    isNode: false,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0',
    platform: 'linux',
    isFirefox: true,
    isIpad: false,
    isIphone: false
  } as IBrowser;

  // Mock textarea element
  (term as any).textarea = {
    value: ''
  };

  // Mock necessary services
  (term as any).coreService = {
    decPrivateModes: {
      applicationCursorKeys: false
    },
    triggerDataEvent: () => {}
  };

  // Mock necessary options directly on term.options
  (term as any).options.macOptionIsMeta = false;
  (term as any).options.scrollOnUserInput = false;

  (term as any).optionsService = {
    rawOptions: {
      screenReaderMode: false
    }
  };

  let keyEventFired = false;
  let capturedKey = '';

  // Listen for onKey events
  term.onKey((event) => {
    keyEventFired = true;
    capturedKey = event.key;
    console.log('Key event fired:', event);
  });

  // Create a mock KeyboardEvent for Alt+-
  const mockEvent = {
    type: 'keydown',
    keyCode: 189,
    key: '-',
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    getModifierState: (modifier: string) => {
      if (modifier === 'AltGraph') return false;
      return false;
    },
    preventDefault: () => {},
    stopPropagation: () => {}
  } as KeyboardEvent;

  console.log('Testing Alt+- key handling...');
  console.log('Mock event:', mockEvent);

  // Test the individual components
  console.log('\n=== Testing evaluateKeyboardEvent directly ===');
  const keyResult = evaluateKeyboardEvent(mockEvent, false, false, false);
  console.log('evaluateKeyboardEvent result:', keyResult);

  console.log('\n=== Testing _isThirdLevelShift ===');
  const isThirdLevel = (term as any)._isThirdLevelShift((term as any).browser, mockEvent);
  console.log('_isThirdLevelShift result:', isThirdLevel);

  console.log('\n=== Testing full _keyDown method ===');
  // Call the _keyDown method directly
  const result = (term as any)._keyDown(mockEvent);
  
  console.log('_keyDown result:', result);
  console.log('Key event fired:', keyEventFired);
  console.log('Captured key:', capturedKey);
  console.log('Expected key: \\x1b-');

  return {
    keyEventFired,
    capturedKey,
    result,
    keyResult,
    isThirdLevel
  };
}

export { testAltMinusKeyHandling };