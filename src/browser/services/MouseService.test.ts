/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { AltMouseCursorController, MouseEventCssClasses, MouseService } from './MouseService';
import { MouseStateService } from '../../common/services/MouseStateService';
import { CoreMouseAction, CoreMouseButton } from '../../common/Types';
import { IBufferService, ICoreService, ILogService, IOptionsService } from '../../common/services/Services';
import { OptionsService } from '../../common/services/OptionsService';
import { MockCoreBrowserService, MockRenderService, MockSelectionService } from '../TestUtils.test';

function toBytes(s: string | undefined): number[] {
  if (!s) {
    return [];
  }
  const res: number[] = [];
  for (let i = 0; i < s.length; ++i) {
    res.push(s.charCodeAt(i));
  }
  return res;
}

// Minimal mocks for deps that MouseService touches in these tests
const bufferService: IBufferService = {
  buffer: { hasScrollback: true } as any,
  cols: 500,
  rows: 500
} as any;

const optionsService: IOptionsService = {
  rawOptions: {
    logLevel: 'info',
    fastScrollSensitivity: 1,
    scrollSensitivity: 1
  }
} as any;

const logService: ILogService = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
} as any;

class TestSelectionService extends MockSelectionService {
  public enableCount = 0;
  public disableCount = 0;

  public override enable(): void {
    this.enableCount++;
  }

  public override disable(): void {
    this.disableCount++;
  }

  public override shouldForceSelection(): boolean {
    return false;
  }
}

function createTestMouseTargetElement(): HTMLElement {
  const classes = new Set<string>();
  return {
    classList: {
      add: (className: string) => classes.add(className),
      remove: (className: string) => classes.delete(className),
      contains: (className: string) => classes.has(className)
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  } as any;
}

describe('MouseService _triggerMouseEvent', () => {
  let mouseService: MouseService;
  let mouseStateService: MouseStateService;
  let coreService: ICoreService;
  let reports: string[];

  beforeEach(() => {
    reports = [];
    mouseStateService = new MouseStateService();
    coreService = {
      triggerDataEvent: (data: string) => reports.push(data),
      triggerBinaryEvent: (data: string) => reports.push(data),
      decPrivateModes: { applicationCursorKeys: false }
    } as any;

    mouseService = new MouseService(
      new MockRenderService(),
      {
        getMouseReportCoords: (_ev: MouseEvent, _el: HTMLElement) => ({ col: 0, row: 0, x: 0, y: 0 })
      } as any,
      mouseStateService,
      coreService,
      bufferService,
      optionsService,
      new MockSelectionService(),
      logService,
      new MockCoreBrowserService()
    );
  });

  function trigger(e: Parameters<any>[0]): boolean {
    return (mouseService as any)._triggerMouseEvent(e);
  }

  it('NONE', () => {
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), false);
  });

  it('X10', () => {
    mouseStateService.activeProtocol = 'X10';
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), false);
  });

  it('VT200', () => {
    mouseStateService.activeProtocol = 'VT200';
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), false);
  });

  it('DRAG', () => {
    mouseStateService.activeProtocol = 'DRAG';
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), true);
  });

  it('ANY', () => {
    mouseStateService.activeProtocol = 'ANY';
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), true);
    // should not report in any case
    // invalid button + action combinations
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.MOVE }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.UP }), false);
    // invalid coords
    assert.equal(trigger({ col: -1, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 500, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: -1, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 500, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
  });

  describe('coords', () => {
    it('DEFAULT encoding', () => {
      mouseStateService.activeProtocol = 'ANY';
      for (let i = 0; i < bufferService.cols; ++i) {
        assert.equal(trigger({ col: i, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
        if (i > 222) {
          // suppress mouse reports if we are out of addressable range (max. 222)
          assert.deepEqual(toBytes(reports.pop()), []);
        } else {
          assert.deepEqual(toBytes(reports.pop()), [0x1b, 0x5b, 0x4d, 0x20, i + 33, 0x21]);
        }
      }
    });

    it('SGR encoding', () => {
      mouseStateService.activeProtocol = 'ANY';
      mouseStateService.activeEncoding = 'SGR';
      for (let i = 0; i < bufferService.cols; ++i) {
        assert.equal(trigger({ col: i, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
        assert.deepEqual(reports.pop(), `\x1b[<0;${i + 1};1M`);
      }
    });

    it('SGR_PIXELS encoding', () => {
      mouseStateService.activeProtocol = 'ANY';
      mouseStateService.activeEncoding = 'SGR_PIXELS';
      for (let i = 0; i < 500; ++i) {
        assert.equal(trigger({ col: 0, row: 0, x: i, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
        assert.deepEqual(reports.pop(), `\x1b[<0;${i};0M`);
      }
    });
  });

  it('eventCodes with modifiers (DEFAULT encoding)', () => {
    // TODO: implement AUX button tests
    mouseStateService.activeProtocol = 'ANY';
    mouseStateService.activeEncoding = 'DEFAULT';
    // all buttons + down + no modifer
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
    assert.deepEqual(reports, ['\x1b[M !!', '\x1b[M!!!', '\x1b[M"!!', '\x1b[Ma!!']);
    reports = [];

    // all buttons + up + no modifier
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
    assert.deepEqual(reports, ['\x1b[M#!!', '\x1b[M#!!', '\x1b[M#!!', '\x1b[M`!!']);
    reports = [];

    // all buttons + move + no modifier
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
    assert.deepEqual(reports, ['\x1b[M@!!', '\x1b[MA!!', '\x1b[MB!!', '\x1b[MC!!']);
    reports = [];

    // button none + move + modifiers
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: true, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: true, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: true }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: true, alt: true, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: true, shift: true }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: true, alt: true, shift: true }), true);
    assert.deepEqual(reports, ['\x1b[MS!!', '\x1b[MK!!', '\x1b[MG!!', '\x1b[M[!!', '\x1b[MO!!', '\x1b[M_!!']);
    reports = [];
  });
});

describe('MouseService mouseEventsRequireAlt', () => {
  it('should update selection state and cursor class when toggled while mouse events are active', () => {
    const mouseStateService = new MouseStateService();
    const optionsService = new OptionsService({});
    const selectionService = new TestSelectionService();
    const mouseService = new MouseService(
      new MockRenderService(),
      {
        getMouseReportCoords: (_ev: MouseEvent, _el: HTMLElement) => ({ col: 0, row: 0, x: 0, y: 0 })
      } as any,
      mouseStateService,
      {
        triggerDataEvent: () => {},
        triggerBinaryEvent: () => {},
        decPrivateModes: { applicationCursorKeys: false }
      } as any,
      bufferService,
      optionsService,
      selectionService,
      logService,
      new MockCoreBrowserService()
    );
    const element = createTestMouseTargetElement();
    const screenElement = createTestMouseTargetElement();
    const document = {
      addEventListener: () => {},
      removeEventListener: () => {}
    } as any;

    mouseService.bindMouse({
      element,
      screenElement,
      document
    }, disposable => disposable, () => {});

    mouseStateService.activeProtocol = 'ANY';
    assert.isTrue(element.classList.contains(MouseEventCssClasses.ENABLE_MOUSE_EVENTS));
    assert.equal(selectionService.disableCount, 1);

    optionsService.options.mouseEventsRequireAlt = true;
    assert.isFalse(element.classList.contains(MouseEventCssClasses.ENABLE_MOUSE_EVENTS));
    assert.equal(selectionService.enableCount, 2);

    optionsService.options.mouseEventsRequireAlt = false;
    assert.isTrue(element.classList.contains(MouseEventCssClasses.ENABLE_MOUSE_EVENTS));
    assert.equal(selectionService.disableCount, 2);
  });

  it('should strip alt modifier from forwarded mouse reports', () => {
    const mouseStateService = new MouseStateService();
    mouseStateService.activeProtocol = 'ANY';
    mouseStateService.activeEncoding = 'SGR';
    const optionsService = new OptionsService({ mouseEventsRequireAlt: true });
    const reports: string[] = [];
    const mouseService = new MouseService(
      new MockRenderService(),
      {
        getMouseReportCoords: () => ({ col: 0, row: 0, x: 0, y: 0 })
      } as any,
      mouseStateService,
      {
        triggerDataEvent: (data: string) => reports.push(data),
        triggerBinaryEvent: () => {},
        decPrivateModes: { applicationCursorKeys: false }
      } as any,
      bufferService,
      optionsService,
      new TestSelectionService(),
      logService,
      new MockCoreBrowserService()
    );
    const ctx = {
      target: {
        screenElement: createTestMouseTargetElement()
      },
      requestedEvents: {}
    } as any;

    const sent = (mouseService as any)._sendEvent(ctx, {
      type: 'mousedown',
      button: 0,
      altKey: true,
      ctrlKey: false,
      shiftKey: false
    } as MouseEvent);

    assert.isTrue(sent);
    assert.deepEqual(reports, ['\x1b[<0;1;1M']);
  });

  it('should toggle enable-mouse-events class when alt modifier changes', () => {
    const element = createTestMouseTargetElement();
    const altMouseCursor = new AltMouseCursorController(element, {
      addEventListener: () => {},
      removeEventListener: () => {}
    } as any, () => true);

    const sync = (altHeld: boolean) => altMouseCursor.syncFromModifier({
      getModifierState: (key: string) => key === 'Alt' && altHeld
    } as KeyboardEvent);

    assert.isFalse(element.classList.contains(MouseEventCssClasses.ENABLE_MOUSE_EVENTS));
    sync(true);
    assert.isTrue(element.classList.contains(MouseEventCssClasses.ENABLE_MOUSE_EVENTS));
    sync(false);
    assert.isFalse(element.classList.contains(MouseEventCssClasses.ENABLE_MOUSE_EVENTS));
  });
});

describe('MouseService multi-window', () => {
  interface IRecordingDocument {
    doc: Document;
    added: string[];
    removed: string[];
    listeners: { [type: string]: EventListener[] };
  }

  function createRecordingDocument(): IRecordingDocument {
    const added: string[] = [];
    const removed: string[] = [];
    const listeners: { [type: string]: EventListener[] } = {};
    const doc = {
      addEventListener: (type: string, listener: EventListener) => {
        added.push(type);
        (listeners[type] ??= []).push(listener);
      },
      removeEventListener: (type: string) => removed.push(type)
    } as any;
    return { doc, added, removed, listeners };
  }

  it('should manage protocol mouseup/mousemove listeners on the element\'s current document, not the document the terminal was opened with', () => {
    const mouseStateService = new MouseStateService();
    const optionsService = new OptionsService({});
    const mouseService = new MouseService(
      new MockRenderService(),
      {
        getMouseReportCoords: () => ({ col: 0, row: 0, x: 0, y: 0 })
      } as any,
      mouseStateService,
      {
        triggerDataEvent: () => {},
        triggerBinaryEvent: () => {},
        decPrivateModes: { applicationCursorKeys: false }
      } as any,
      bufferService,
      optionsService,
      new TestSelectionService(),
      logService,
      new MockCoreBrowserService()
    );

    // Simulate a terminal that was opened with one document but whose element now lives in
    // another document (eg. it was moved to a child window)
    const openDocument = createRecordingDocument();
    const childDocument = createRecordingDocument();
    const elementListeners: { [type: string]: EventListener[] } = {};
    const element = {
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
      },
      addEventListener: (type: string, listener: EventListener) => {
        (elementListeners[type] ??= []).push(listener);
      },
      removeEventListener: () => {},
      ownerDocument: childDocument.doc
    } as any;

    mouseService.bindMouse({
      element,
      screenElement: createTestMouseTargetElement(),
      document: openDocument.doc
    }, disposable => disposable, () => {});
    mouseStateService.activeProtocol = 'ANY';

    elementListeners['mousedown'][0]({
      type: 'mousedown',
      button: 0,
      buttons: 1,
      altKey: false,
      ctrlKey: false,
      shiftKey: false,
      preventDefault: () => {}
    } as any);
    assert.deepEqual(childDocument.added, ['mouseup', 'mousemove']);
    assert.deepEqual(openDocument.added, []);

    childDocument.listeners['mouseup'][0]({
      type: 'mouseup',
      button: 0,
      buttons: 0,
      altKey: false,
      ctrlKey: false,
      shiftKey: false
    } as any);
    assert.deepEqual(childDocument.removed, ['mouseup', 'mousemove']);
    assert.deepEqual(openDocument.removed, []);
  });
});
