/**
 * @license MIT
 */

/// <reference path="../../typings/xterm.d.ts" />

import { Terminal } from 'xterm';

namespace constructor {
  {
    new Terminal();
    new Terminal({});
    new Terminal({
      cols: 1,
      rows: 1
    });
    new Terminal({
      'cols': 1,
      'cursorBlink': true,
      'cursorStyle': 'block',
      'disableStdin': false,
      'rows': 1,
      'scrollback': 10,
      'tabStopWidth': 2,
    });
  }
}

namespace properties {
  {
    const t: Terminal = new Terminal();
    const element: HTMLElement = t.element;
    const textarea: HTMLTextAreaElement = t.textarea;
  }
}

namespace static_methods {
  {
    Terminal.loadAddon('attach');
    Terminal.loadAddon('fit');
    Terminal.loadAddon('fullscreen');
    Terminal.loadAddon('search');
    Terminal.loadAddon('terminado');
    Terminal.loadAddon('winptyCompat');
  }
}

namespace methods_core {
  {
    const t: Terminal = new Terminal();
    t.blur();
    t.focus();
    t.destroy();
    t.clear();
    t.refresh(0, 1);
    t.reset();
    t.resize(1, 1);
    t.write('foo');
    t.writeln('foo');
  }
  {
    const t: Terminal = new Terminal();
    // no arg
    t.on('blur', () => {});
    t.on('focus', () => {});
    t.on('lineFeed', () => {});
    t.on('selection', () => {});
    // args
    t.on('data', () => {});
    t.on('data', (data: string) => console.log(data));
    t.on('key', () => {});
    t.on('key', (key: string) => console.log(key, event));
    t.on('key', (key: string, event: KeyboardEvent) => console.log(key, event));
    t.on('keydown', () => {});
    t.on('keydown', (event: KeyboardEvent) => console.log(event));
    t.on('keypress', () => {});
    t.on('keypress', (event: KeyboardEvent) => console.log(event));
    t.on('refresh', () => {});
    t.on('refresh', (data: {start: number, end: number}) => console.log(data));
    t.on('resize', () => {});
    t.on('resize', (data: {cols: number, rows: number}) => console.log(data));
    t.on('scroll', () => {});
    t.on('scroll', (ydisp: number) => console.log(ydisp));
    t.on('title', () => {});
    t.on('title', (title: string) => console.log(title));
  }
  {
    const t: Terminal = new Terminal();
    // no arg
    t.off('blur', () => {});
    t.off('focus', () => {});
    t.off('lineFeed', () => {});
    t.off('selection', () => {});
    // args
    t.off('data', () => {});
    t.off('data', (data: string) => console.log(data));
    t.off('key', () => {});
    t.off('key', (key: string) => console.log(key, event));
    t.off('key', (key: string, event: KeyboardEvent) => console.log(key, event));
    t.off('keydown', () => {});
    t.off('keydown', (event: KeyboardEvent) => console.log(event));
    t.off('keypress', () => {});
    t.off('keypress', (event: KeyboardEvent) => console.log(event));
    t.off('refresh', () => {});
    t.off('refresh', (data: {element: HTMLElement, start: number, end: number}) => console.log(data));
    t.off('resize', () => {});
    t.off('resize', (data: {terminal: Terminal, cols: number, rows: number}) => console.log(data));
    t.off('scroll', () => {});
    t.off('scroll', (ydisp: number) => console.log(ydisp));
    t.off('title', () => {});
    t.off('title', (title: string) => console.log(title));
  }
  {
    const t: Terminal = new Terminal();
    const e: HTMLElement = null;
    t.open(e);
  }
  {
    const t: Terminal = new Terminal();
    t.attachCustomKeyEventHandler((e: KeyboardEvent) => true);
    t.attachCustomKeyEventHandler((e: KeyboardEvent) => false);
  }
  namespace options {
    {
      const t: Terminal = new Terminal();
      const r01: string = t.getOption('cursorStyle');
      const r02: string = t.getOption('termName');
      const r03: boolean = t.getOption('cancelEvents');
      const r04: boolean = t.getOption('convertEol');
      const r05: boolean = t.getOption('cursorBlink');
      const r06: boolean = t.getOption('debug');
      const r07: boolean = t.getOption('disableStdin');
      const r08: boolean = t.getOption('popOnBell');
      const r09: boolean = t.getOption('screenKeys');
      const r10: boolean = t.getOption('useFlowControl');
      const r11: boolean = t.getOption('visualBell');
      const r12: string[] = t.getOption('colors');
      const r13: number = t.getOption('cols');
      const r14: number = t.getOption('rows');
      const r15: number = t.getOption('tabStopWidth');
      const r16: number = t.getOption('scrollback');
      const r17: [number, number] = t.getOption('geometry');
      const r18: (data: string) => void = t.getOption('handler');
      const r19: string = t.getOption('bellSound');
      const r20: string = t.getOption('bellStyle');
      const r21: boolean = t.getOption('enableBold');
      const r22: number = t.getOption('letterSpacing');
    }
    {
      const t: Terminal = new Terminal();
      t.setOption('cursorStyle', 'bar');
      t.setOption('cursorStyle', 'block');
      t.setOption('cursorStyle', 'underline');
      t.setOption('termName', 'foo');
      t.setOption('cancelEvents', true);
      t.setOption('convertEol', true);
      t.setOption('cursorBlink', true);
      t.setOption('debug', true);
      t.setOption('disableStdin', true);
      t.setOption('enableBold', true);
      t.setOption('popOnBell', true);
      t.setOption('screenKeys', true);
      t.setOption('useFlowControl', true);
      t.setOption('visualBell', true);
      t.setOption('colors', ['a', 'b']);
      t.setOption('letterSpacing', 1);
      t.setOption('cols', 1);
      t.setOption('rows', 1);
      t.setOption('tabStopWidth', 1);
      t.setOption('scrollback', 1);
      t.setOption('geometry', [1, 1]);
      t.setOption('handler', (data: string) => console.log(data));
      t.setOption('bellSound', 'foo');
      t.setOption('bellStyle', 'none');
      t.setOption('bellStyle', 'visual');
      t.setOption('bellStyle', 'sound');
      t.setOption('bellStyle', 'both');
      t.setOption('fontSize', 1);
      t.setOption('lineHeight', 1);
      t.setOption('fontFamily', 'foo');
      t.setOption('theme', {background: '#ff0000'});
    }
  }
  namespace scrolling {
    {
      const t: Terminal = new Terminal();
      t.scrollLines(-1);
      t.scrollLines(1);
      t.scrollLines(-1);
      t.scrollLines(1);
      t.scrollToTop();
      t.scrollToBottom();
    }
  }
  namespace selection {
    {
      const t: Terminal = new Terminal();
      const r1: boolean = t.hasSelection();
      const r2: string = t.getSelection();
      t.clearSelection();
      t.selectAll();
    }
  }
}

namespace methods_experimental {
  {
    const t: Terminal = new Terminal();
    t.registerLinkMatcher(/foo/, () => {});
    t.registerLinkMatcher(new RegExp('foo'), () => {});
    t.registerLinkMatcher(/foo/, () => {}, {});
    t.registerLinkMatcher(/foo/, (event: MouseEvent, uri: string) => {
      console.log(event, uri);
      return void 0;
    }, {});
    t.registerLinkMatcher(/foo/, () => true, {});
    t.registerLinkMatcher(/foo/, () => false, {});
    t.registerLinkMatcher(/foo/, () => true, {
      matchIndex: 1
    });
    t.registerLinkMatcher(/foo/, () => true, {
      matchIndex: 1,
      priority: 1,
      validationCallback: (uri: string, callback: (isValid: boolean) => void) => {
        console.log(uri, callback);
      },
      tooltipCallback: (e: MouseEvent, uri: string) => {
        console.log(e, uri);
      },
      leaveCallback: () => {}
    });
    t.deregisterLinkMatcher(1);
  }
}
