/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IParsingState, IParams, ParamsArray, IOscParser, IOscHandler, OscFallbackHandlerType, IFunctionIdentifier, IParserStackState, ParserStackType, ResumableHandlersType } from 'common/parser/Types';
import { EscapeSequenceParser, TransitionTable, VT500_TRANSITION_TABLE } from 'common/parser/EscapeSequenceParser';
import { assert } from 'chai';
import { StringToUtf32, stringFromCodePoint, utf32ToString } from 'common/input/TextDecoder';
import { ParserState } from 'common/parser/Constants';
import { Params } from 'common/parser/Params';
import { OscHandler } from 'common/parser/OscParser';
import { IDisposable } from 'common/Types';
import { DcsHandler } from 'common/parser/DcsParser';


function r(a: number, b: number): string[] {
  let c = b - a;
  const arr = new Array(c);
  while (c--) {
    arr[c] = String.fromCharCode(--b);
  }
  return arr;
}

class MockOscPutParser implements IOscParser {
  private _fallback: OscFallbackHandlerType = () => { };
  public data = '';
  public reset(): void {
    this.data = '';
  }
  public put(data: Uint32Array, start: number, end: number): void {
    this.data += utf32ToString(data, start, end);
  }
  public dispose(): void { }
  public start(): void { }
  public end(success: boolean): void {
    this.data += `, success: ${success}`;
    const id = parseInt(this.data.slice(0, this.data.indexOf(';')));
    if (!isNaN(id)) {
      this._fallback(id, 'END', this.data.slice(this.data.indexOf(';') + 1));
    }
  }
  public registerHandler(ident: number, handler: IOscHandler): IDisposable {
    throw new Error('not implemented');
  }
  public setHandler(ident: number, handler: IOscHandler): void {
    throw new Error('not implemented');
  }
  public clearHandler(ident: number): void {
    throw new Error('not implemented');
  }
  public setHandlerFallback(handler: OscFallbackHandlerType): void {
    this._fallback = handler;
  }
}
const oscPutParser = new MockOscPutParser();

// derived parser with access to internal states
class TestEscapeSequenceParser extends EscapeSequenceParser {
  public get transitions(): TransitionTable {
    return this._transitions;
  }
  public get osc(): string {
    return (this._oscParser as MockOscPutParser).data;
  }
  public set osc(value: string) {
    (this._oscParser as MockOscPutParser).data = value;
  }
  public get params(): ParamsArray {
    return this._params.toArray();
  }
  public set params(value: ParamsArray) {
    this._params = Params.fromArray(value);
  }
  public get realParams(): IParams {
    return this._params;
  }
  public get collect(): string {
    return this.identToString(this._collect);
  }
  public set collect(value: string) {
    this._collect = 0;
    for (let i = 0; i < value.length; ++i) {
      this._collect <<= 8;
      this._collect |= value.charCodeAt(i);
    }
  }
  public mockOscParser(): void {
    (this as any)._oscParser = oscPutParser;
  }
  public identifier(id: IFunctionIdentifier): number {
    return this._identifier(id);
  }
  public get parseStack(): IParserStackState {
    return this._parseStack;
  }
  private _trackStack = false;
  public trackStackSavesOnPause(): void {
    this._trackStack = true;
  }
  public trackedStack: IParserStackState[] = [];
  public parse(data: Uint32Array, length: number, promiseResult?: boolean): void | Promise<boolean> {
    const result = super.parse(data, length, promiseResult);
    if (result instanceof Promise && this._trackStack) {
      this.trackedStack.push({ ...this.parseStack });
    }
    return result;
  }
}

// test object to collect parser actions and compare them with expected values
const testTerminal: any = {
  calls: [],
  clear(): void {
    this.calls = [];
  },
  compare(value: any): void {
    assert.deepEqual(this.calls, value);
  },
  print(data: Uint32Array, start: number, end: number): void {
    let s = '';
    for (let i = start; i < end; ++i) {
      s += stringFromCodePoint(data[i]);
    }
    this.calls.push(['print', s]);
  },
  actionOSC(s: string): void {
    this.calls.push(['osc', s]);
  },
  actionExecute(flag: string): void {
    this.calls.push(['exe', flag]);
  },
  actionCSI(collect: string, params: IParams, flag: string): void {
    this.calls.push(['csi', collect, params.toArray(), flag]);
  },
  actionESC(collect: string, flag: string): void {
    this.calls.push(['esc', collect, flag]);
  },
  actionDCSHook(params: IParams): void {
    this.calls.push(['dcs hook', params.toArray()]);
  },
  actionDCSPrint(s: string): void {
    this.calls.push(['dcs put', s]);
  },
  actionDCSUnhook(success: boolean): void {
    this.calls.push(['dcs unhook', success]);
  }
};

const states: number[] = [
  ParserState.GROUND,
  ParserState.ESCAPE,
  ParserState.ESCAPE_INTERMEDIATE,
  ParserState.CSI_ENTRY,
  ParserState.CSI_PARAM,
  ParserState.CSI_INTERMEDIATE,
  ParserState.CSI_IGNORE,
  ParserState.SOS_PM_APC_STRING,
  ParserState.OSC_STRING,
  ParserState.DCS_ENTRY,
  ParserState.DCS_PARAM,
  ParserState.DCS_IGNORE,
  ParserState.DCS_INTERMEDIATE,
  ParserState.DCS_PASSTHROUGH
];
let state: any;

// parser with Uint8Array based transition table
const testParser = new TestEscapeSequenceParser();
testParser.mockOscParser();
testParser.setPrintHandler(testTerminal.print.bind(testTerminal));
testParser.setCsiHandlerFallback((ident: number, params: IParams) => {
  const id = testParser.identToString(ident);
  testTerminal.actionCSI(id.slice(0, -1), params, id.slice(-1));
});
testParser.setEscHandlerFallback((ident: number) => {
  const id = testParser.identToString(ident);
  testTerminal.actionESC(id.slice(0, -1), id.slice(-1));
});
testParser.setExecuteHandlerFallback((code: number) => {
  testTerminal.actionExecute(String.fromCharCode(code));
});
testParser.setOscHandlerFallback((identifier, action, data) => {
  if (identifier === -1) testTerminal.actionOSC(data);  // handle error condition silently
  else if (action === 'END') testTerminal.actionOSC('' + identifier + ';' + data); // collect only data at END
});
testParser.setDcsHandlerFallback((collectAndFlag, action, payload) => {
  switch (action) {
    case 'HOOK':
      testTerminal.actionDCSHook(payload);
      break;
    case 'PUT':
      testTerminal.actionDCSPrint(payload);
      break;
    case 'UNHOOK':
      testTerminal.actionDCSUnhook(payload);
  }
});


// translate string based parse calls into typed array based
function parse(parser: TestEscapeSequenceParser, data: string): void {
  const container = new Uint32Array(data.length);
  const decoder = new StringToUtf32();
  parser.parse(container, decoder.decode(data, container));
}

describe('EscapeSequenceParser', () => {
  const parser = testParser;
  describe('Parser init and methods', () => {
    it('constructor', () => {
      let p = new TestEscapeSequenceParser();
      assert.deepEqual(p.transitions, VT500_TRANSITION_TABLE);
      p = new TestEscapeSequenceParser(VT500_TRANSITION_TABLE);
      assert.deepEqual(p.transitions, VT500_TRANSITION_TABLE);
      const tansitions: TransitionTable = new TransitionTable(10);
      p = new TestEscapeSequenceParser(tansitions);
      assert.deepEqual(p.transitions, tansitions);
    });
    it('inital states', () => {
      assert.equal(parser.initialState, ParserState.GROUND);
      assert.equal(parser.currentState, ParserState.GROUND);
      assert.equal(parser.osc, '');
      assert.deepEqual(parser.params, [0]);
      assert.equal(parser.collect, '');
    });
    it('reset states', () => {
      parser.currentState = 124;
      parser.osc = '#';
      parser.params = [123];
      parser.collect = '#';

      parser.reset();
      assert.equal(parser.currentState, ParserState.GROUND);
      assert.equal(parser.osc, '');
      assert.deepEqual(parser.params, [0]);
      assert.equal(parser.collect, '');
    });
  });
  describe('state transitions and actions', () => {
    it('state GROUND execute action', () => {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.GROUND;
        parse(parser, exes[i]);
        assert.equal(parser.currentState, ParserState.GROUND);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state GROUND print action', () => {
      parser.reset();
      testTerminal.clear();
      const printables = r(0x20, 0x7f); // NOTE: DEL excluded
      for (let i = 0; i < printables.length; ++i) {
        parser.currentState = ParserState.GROUND;
        parse(parser, printables[i]);
        assert.equal(parser.currentState, ParserState.GROUND);
        testTerminal.compare([['print', printables[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE --> GROUND with actions', () => {
      const exes = [
        '\x18', '\x1a',
        '\x80', '\x81', '\x82', '\x83', '\x84', '\x85', '\x86', '\x87', '\x88',
        '\x89', '\x8a', '\x8b', '\x8c', '\x8d', '\x8e', '\x8f',
        '\x91', '\x92', '\x93', '\x94', '\x95', '\x96', '\x97', '\x99', '\x9a'
      ];
      const exceptions: { [key: number]: { [key: string]: any[] } } = {
        8: { '\x18': [], '\x1a': [] }, // abort OSC_STRING
        13: { '\x18': [['dcs unhook', false]], '\x1a': [['dcs unhook', false]] } // abort DCS_PASSTHROUGH
      };
      parser.reset();
      testTerminal.clear();
      for (state in states) {
        for (let i = 0; i < exes.length; ++i) {
          parser.currentState = state;
          parse(parser, exes[i]);
          assert.equal(parser.currentState, ParserState.GROUND);
          testTerminal.compare((state in exceptions ? exceptions[state][exes[i]] : 0) || [['exe', exes[i]]]);
          parser.reset();
          testTerminal.clear();
        }
        parse(parser, '\x9c');
        assert.equal(parser.currentState, ParserState.GROUND);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE --> ESCAPE with clear', () => {
      parser.reset();
      for (state in states) {
        parser.currentState = state;
        parser.params = [23];
        parser.collect = '#';
        parse(parser, '\x1b');
        assert.equal(parser.currentState, ParserState.ESCAPE);
        assert.deepEqual(parser.params, [0]);
        assert.equal(parser.collect, '');
        parser.reset();
      }
    });
    it('state ESCAPE execute rules', () => {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.ESCAPE;
        parse(parser, exes[i]);
        assert.equal(parser.currentState, ParserState.ESCAPE);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state ESCAPE ignore', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.ESCAPE;
      parse(parser, '\x7f');
      assert.equal(parser.currentState, ParserState.ESCAPE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans ESCAPE --> GROUND with ecs_dispatch action', () => {
      parser.reset();
      testTerminal.clear();
      let dispatches = r(0x30, 0x50);
      dispatches = dispatches.concat(r(0x51, 0x58));
      dispatches = dispatches.concat(['\x59', '\x5a']); // excluded \x5c
      dispatches = dispatches.concat(r(0x60, 0x7f));
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.ESCAPE;
        parse(parser, dispatches[i]);
        assert.equal(parser.currentState, ParserState.GROUND);
        testTerminal.compare([['esc', '', dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ESCAPE --> ESCAPE_INTERMEDIATE with collect action', () => {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.ESCAPE;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.ESCAPE_INTERMEDIATE);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('state ESCAPE_INTERMEDIATE execute rules', () => {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
        parse(parser, exes[i]);
        assert.equal(parser.currentState, ParserState.ESCAPE_INTERMEDIATE);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state ESCAPE_INTERMEDIATE ignore', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
      parse(parser, '\x7f');
      assert.equal(parser.currentState, ParserState.ESCAPE_INTERMEDIATE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('state ESCAPE_INTERMEDIATE collect action', () => {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.ESCAPE_INTERMEDIATE);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('trans ESCAPE_INTERMEDIATE --> GROUND with esc_dispatch action', () => {
      parser.reset();
      testTerminal.clear();
      const collect = r(0x30, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.GROUND);
        // '\x5c' --> ESC + \ (7bit ST) parser does not expose this as it already got handled
        testTerminal.compare((collect[i] === '\x5c') ? [] : [['esc', '', collect[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE/ESCAPE --> CSI_ENTRY with clear', () => {
      parser.reset();
      // C0
      parser.currentState = ParserState.ESCAPE;
      parser.params = [123];
      parser.collect = '#';
      parse(parser, '[');
      assert.equal(parser.currentState, ParserState.CSI_ENTRY);
      assert.deepEqual(parser.params, [0]);
      assert.equal(parser.collect, '');
      parser.reset();
      // C1
      for (state in states) {
        parser.currentState = state;
        parser.params = [123];
        parser.collect = '#';
        parse(parser, '\x9b');
        assert.equal(parser.currentState, ParserState.CSI_ENTRY);
        assert.deepEqual(parser.params, [0]);
        assert.equal(parser.collect, '');
        parser.reset();
      }
    });
    it('state CSI_ENTRY execute rules', () => {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, exes[i]);
        assert.equal(parser.currentState, ParserState.CSI_ENTRY);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_ENTRY ignore', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_ENTRY;
      parse(parser, '\x7f');
      assert.equal(parser.currentState, ParserState.CSI_ENTRY);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans CSI_ENTRY --> GROUND with csi_dispatch action', () => {
      parser.reset();
      const dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, dispatches[i]);
        assert.equal(parser.currentState, ParserState.GROUND);
        testTerminal.compare([['csi', '', [0], dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_ENTRY --> CSI_PARAM with param/collect actions', () => {
      parser.reset();
      const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      const collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, params[i]);
        assert.equal(parser.currentState, ParserState.CSI_PARAM);
        assert.deepEqual(parser.params, [params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.CSI_ENTRY;
      parse(parser, '\x3b');
      assert.equal(parser.currentState, ParserState.CSI_PARAM);
      assert.deepEqual(parser.params, [0, 0]);
      parser.reset();
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.CSI_PARAM);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('state CSI_PARAM execute rules', () => {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, exes[i]);
        assert.equal(parser.currentState, ParserState.CSI_PARAM);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_PARAM param action', () => {
      parser.reset();
      const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, params[i]);
        assert.equal(parser.currentState, ParserState.CSI_PARAM);
        assert.deepEqual(parser.params, [params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.CSI_PARAM;
      parse(parser, '\x3b');
      assert.equal(parser.currentState, ParserState.CSI_PARAM);
      assert.deepEqual(parser.params, [0, 0]);
      parser.reset();
    });
    it('state CSI_PARAM ignore', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_PARAM;
      parse(parser, '\x7f');
      assert.equal(parser.currentState, ParserState.CSI_PARAM);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans CSI_PARAM --> GROUND with csi_dispatch action', () => {
      parser.reset();
      const dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parser.params = [0, 1];
        parse(parser, dispatches[i]);
        assert.equal(parser.currentState, ParserState.GROUND);
        testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_ENTRY --> CSI_INTERMEDIATE with collect action', () => {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.CSI_INTERMEDIATE);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('trans CSI_PARAM --> CSI_INTERMEDIATE with collect action', () => {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.CSI_INTERMEDIATE);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('state CSI_INTERMEDIATE execute rules', () => {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parse(parser, exes[i]);
        assert.equal(parser.currentState, ParserState.CSI_INTERMEDIATE);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_INTERMEDIATE collect', () => {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.CSI_INTERMEDIATE);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('state CSI_INTERMEDIATE ignore', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_INTERMEDIATE;
      parse(parser, '\x7f');
      assert.equal(parser.currentState, ParserState.CSI_INTERMEDIATE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans CSI_INTERMEDIATE --> GROUND with csi_dispatch action', () => {
      parser.reset();
      const dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parser.params = [0, 1];
        parse(parser, dispatches[i]);
        assert.equal(parser.currentState, ParserState.GROUND);
        testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_ENTRY --> CSI_PARAM for ":" (0x3a)', () => {
      parser.reset();
      parser.currentState = ParserState.CSI_ENTRY;
      parse(parser, '\x3a');
      assert.equal(parser.currentState, ParserState.CSI_PARAM);
      parser.reset();
    });
    it('trans CSI_PARAM --> CSI_IGNORE', () => {
      parser.reset();
      const chars = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, '\x3b' + chars[i]);
        assert.equal(parser.currentState, ParserState.CSI_IGNORE);
        assert.deepEqual(parser.params, [0, 0]);
        parser.reset();
      }
    });
    it('trans CSI_PARAM --> CSI_IGNORE', () => {
      parser.reset();
      const chars = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < chars.length; ++i) {
        assert.deepEqual(parser.params, [0]);
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, '\x3b' + chars[i]);
        assert.equal(parser.currentState, ParserState.CSI_IGNORE);
        assert.deepEqual(parser.params, [0, 0]);
        parser.reset();
      }
    });
    it('trans CSI_INTERMEDIATE --> CSI_IGNORE', () => {
      parser.reset();
      const chars = r(0x30, 0x40);
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parse(parser, chars[i]);
        assert.equal(parser.currentState, ParserState.CSI_IGNORE);
        assert.deepEqual(parser.params, [0]);
        parser.reset();
      }
    });
    it('state CSI_IGNORE execute rules', () => {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_IGNORE;
        parse(parser, exes[i]);
        assert.equal(parser.currentState, ParserState.CSI_IGNORE);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_IGNORE ignore', () => {
      parser.reset();
      testTerminal.clear();
      let ignored = r(0x20, 0x40);
      ignored = ignored.concat(['\x7f']);
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.CSI_IGNORE;
        parse(parser, ignored[i]);
        assert.equal(parser.currentState, ParserState.CSI_IGNORE);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_IGNORE --> GROUND', () => {
      parser.reset();
      const dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_IGNORE;
        parser.params = [0, 1];
        parse(parser, dispatches[i]);
        assert.equal(parser.currentState, ParserState.GROUND);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE/ESCAPE --> SOS_PM_APC_STRING', () => {
      parser.reset();
      // C0
      let initializers = ['\x58', '\x5e', '\x5f'];
      for (let i = 0; i < initializers.length; ++i) {
        parse(parser, '\x1b' + initializers[i]);
        assert.equal(parser.currentState, ParserState.SOS_PM_APC_STRING);
        parser.reset();
      }
      // C1
      for (state in states) {
        parser.currentState = state;
        initializers = ['\x98', '\x9e', '\x9f'];
        for (let i = 0; i < initializers.length; ++i) {
          parse(parser, initializers[i]);
          assert.equal(parser.currentState, ParserState.SOS_PM_APC_STRING);
          parser.reset();
        }
      }
    });
    it('state SOS_PM_APC_STRING ignore rules', () => {
      parser.reset();
      let ignored = r(0x00, 0x18);
      ignored = ignored.concat(['\x19']);
      ignored = ignored.concat(r(0x1c, 0x20));
      ignored = ignored.concat(r(0x20, 0x80));
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.SOS_PM_APC_STRING;
        parse(parser, ignored[i]);
        assert.equal(parser.currentState, ParserState.SOS_PM_APC_STRING);
        parser.reset();
      }
    });
    it('trans ANYWHERE/ESCAPE --> OSC_STRING', () => {
      parser.reset();
      // C0
      parse(parser, '\x1b]');
      assert.equal(parser.currentState, ParserState.OSC_STRING);
      parser.reset();
      // C1
      for (state in states) {
        parser.currentState = state;
        parse(parser, '\x9d');
        assert.equal(parser.currentState, ParserState.OSC_STRING);
        parser.reset();
      }
    });
    it('state OSC_STRING ignore rules', () => {
      parser.reset();
      const ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', /* '\x07', */ '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.OSC_STRING;
        parse(parser, ignored[i]);
        assert.equal(parser.currentState, ParserState.OSC_STRING);
        assert.equal(parser.osc, '');
        parser.reset();
      }
    });
    it('state OSC_STRING put action', () => {
      parser.reset();
      const puts = r(0x20, 0x80);
      for (let i = 0; i < puts.length; ++i) {
        parser.currentState = ParserState.OSC_STRING;
        parse(parser, puts[i]);
        assert.equal(parser.currentState, ParserState.OSC_STRING);
        assert.equal(parser.osc, puts[i]);
        parser.reset();
      }
    });
    it('state DCS_ENTRY', () => {
      parser.reset();
      // C0
      parse(parser, '\x1bP');
      assert.equal(parser.currentState, ParserState.DCS_ENTRY);
      parser.reset();
      // C1
      for (state in states) {
        parser.currentState = state;
        parse(parser, '\x90');
        assert.equal(parser.currentState, ParserState.DCS_ENTRY);
        parser.reset();
      }
    });
    it('state DCS_ENTRY ignore rules', () => {
      parser.reset();
      const ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, ignored[i]);
        assert.equal(parser.currentState, ParserState.DCS_ENTRY);
        parser.reset();
      }
    });
    it('state DCS_ENTRY --> DCS_PARAM with param/collect actions', () => {
      parser.reset();
      const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      const collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, params[i]);
        assert.equal(parser.currentState, ParserState.DCS_PARAM);
        assert.deepEqual(parser.params, [params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.DCS_ENTRY;
      parse(parser, '\x3b');
      assert.equal(parser.currentState, ParserState.DCS_PARAM);
      assert.deepEqual(parser.params, [0, 0]);
      parser.reset();
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.DCS_PARAM);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('state DCS_PARAM ignore rules', () => {
      parser.reset();
      const ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, ignored[i]);
        assert.equal(parser.currentState, ParserState.DCS_PARAM);
        parser.reset();
      }
    });
    it('state DCS_PARAM param action', () => {
      parser.reset();
      const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, params[i]);
        assert.equal(parser.currentState, ParserState.DCS_PARAM);
        assert.deepEqual(parser.params, [params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.DCS_PARAM;
      parse(parser, '\x3b');
      assert.equal(parser.currentState, ParserState.DCS_PARAM);
      assert.deepEqual(parser.params, [0, 0]);
      parser.reset();
    });
    it('trans DCS_ENTRY --> DCS_PARAM for ":" (0x3a)', () => {
      parser.reset();
      parser.currentState = ParserState.DCS_ENTRY;
      parse(parser, '\x3a');
      assert.equal(parser.currentState, ParserState.DCS_PARAM);
      parser.reset();
    });
    it('trans DCS_PARAM --> DCS_IGNORE', () => {
      parser.reset();
      const chars = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, '\x3b' + chars[i]);
        assert.equal(parser.currentState, ParserState.DCS_IGNORE);
        assert.deepEqual(parser.params, [0, 0]);
        parser.reset();
      }
    });
    it('trans DCS_INTERMEDIATE --> DCS_IGNORE', () => {
      parser.reset();
      const chars = r(0x30, 0x40);
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, chars[i]);
        assert.equal(parser.currentState, ParserState.DCS_IGNORE);
        parser.reset();
      }
    });
    it('state DCS_IGNORE ignore rules', () => {
      parser.reset();
      let ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      ignored = ignored.concat(r(0x20, 0x80));
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_IGNORE;
        parse(parser, ignored[i]);
        assert.equal(parser.currentState, ParserState.DCS_IGNORE);
        parser.reset();
      }
    });
    it('trans DCS_ENTRY --> DCS_INTERMEDIATE with collect action', () => {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.DCS_INTERMEDIATE);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('trans DCS_PARAM --> DCS_INTERMEDIATE with collect action', () => {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.DCS_INTERMEDIATE);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('state DCS_INTERMEDIATE ignore rules', () => {
      parser.reset();
      const ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, ignored[i]);
        assert.equal(parser.currentState, ParserState.DCS_INTERMEDIATE);
        parser.reset();
      }
    });
    it('state DCS_INTERMEDIATE collect action', () => {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.DCS_INTERMEDIATE);
        assert.equal(parser.collect, collect[i]);
        parser.reset();
      }
    });
    it('trans DCS_INTERMEDIATE --> DCS_IGNORE', () => {
      parser.reset();
      const chars = r(0x30, 0x40);
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, '\x20' + chars[i]);
        assert.equal(parser.currentState, ParserState.DCS_IGNORE);
        assert.equal(parser.collect, '\x20');
        parser.reset();
      }
    });
    it('trans DCS_ENTRY --> DCS_PASSTHROUGH with hook', () => {
      parser.reset();
      testTerminal.clear();
      const collect = r(0x40, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs hook', [0]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans DCS_PARAM --> DCS_PASSTHROUGH with hook', () => {
      parser.reset();
      testTerminal.clear();
      const collect = r(0x40, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs hook', [0]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans DCS_INTERMEDIATE --> DCS_PASSTHROUGH with hook', () => {
      parser.reset();
      testTerminal.clear();
      const collect = r(0x40, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, collect[i]);
        assert.equal(parser.currentState, ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs hook', [0]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state DCS_PASSTHROUGH put action', () => {
      parser.reset();
      testTerminal.clear();
      let puts = r(0x00, 0x18);
      puts = puts.concat(['\x19']);
      puts = puts.concat(r(0x1c, 0x20));
      puts = puts.concat(r(0x20, 0x7f));
      for (let i = 0; i < puts.length; ++i) {
        parser.currentState = ParserState.DCS_PASSTHROUGH;
        parse(parser, puts[i]);
        assert.equal(parser.currentState, ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs put', puts[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state DCS_PASSTHROUGH ignore', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.DCS_PASSTHROUGH;
      parse(parser, '\x7f');
      assert.equal(parser.currentState, ParserState.DCS_PASSTHROUGH);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
  });

  function test(s: string, value: any, noReset: any): void {
    if (!noReset) {
      parser.reset();
      testTerminal.clear();
    }
    parse(parser, s);
    testTerminal.compare(value);
  }

  describe('escape sequence examples', () => {
    it('CSI with print and execute', () => {
      test('\x1b[<31;5mHello World! öäü€\nabc',
        [
          ['csi', '<', [31, 5], 'm'],
          ['print', 'Hello World! öäü€'],
          ['exe', '\n'],
          ['print', 'abc']
        ], null);
    });
    it('OSC', () => {
      test('\x1b]0;abc123€öäü\x07', [
        ['osc', '0;abc123€öäü, success: true']
      ], null);
    });
    it('single DCS', () => {
      test('\x1bP1;2;3+$aäbc;däe\x9c', [
        ['dcs hook', [1, 2, 3]],
        ['dcs put', 'äbc;däe'],
        ['dcs unhook', true]
      ], null);
    });
    it('multi DCS', () => {
      test('\x1bP1;2;3+$abc;de', [
        ['dcs hook', [1, 2, 3]],
        ['dcs put', 'bc;de']
      ], null);
      testTerminal.clear();
      test('abc\x9c', [
        ['dcs put', 'abc'],
        ['dcs unhook', true]
      ], true);
    });
    it('print + DCS(C1)', () => {
      test('abc\x901;2;3+$abc;de\x9c', [
        ['print', 'abc'],
        ['dcs hook', [1, 2, 3]],
        ['dcs put', 'bc;de'],
        ['dcs unhook', true]
      ], null);
    });
    it('print + PM(C1) + print', () => {
      test('abc\x98123tzf\x9cdefg', [
        ['print', 'abc'],
        ['print', 'defg']
      ], null);
    });
    it('print + OSC(C1) + print', () => {
      test('abc\x9d123;tzf\x9cdefg', [
        ['print', 'abc'],
        ['osc', '123;tzf, success: true'],
        ['print', 'defg']
      ], null);
    });
    it('error recovery', () => {
      test('\x1b[1€abcdefg\x9b<;c', [
        ['print', 'abcdefg'],
        ['csi', '<', [0, 0], 'c']
      ], null);
    });
    it('7bit ST should be swallowed', () => {
      test('abc\x9d123;tzf\x1b\\defg', [
        ['print', 'abc'],
        ['osc', '123;tzf, success: true'],
        ['print', 'defg']
      ], null);
    });
    it('colon notation in CSI params', () => {
      test('\x1b[<31;5::123:;8mHello World! öäü€\nabc',
        [
          ['csi', '<', [31, 5, [-1, 123, -1], 8], 'm'],
          ['print', 'Hello World! öäü€'],
          ['exe', '\n'],
          ['print', 'abc']
        ], null);
    });
    it('colon notation in DCS params', () => {
      test('abc\x901;2::55;3+$abc;de\x9c', [
        ['print', 'abc'],
        ['dcs hook', [1, 2, [-1, 55], 3]],
        ['dcs put', 'bc;de'],
        ['dcs unhook', true]
      ], null);
    });
    it('CAN should abort DCS', () => {
      test('abc\x901;2::55;3+$abc;de\x18', [
        ['print', 'abc'],
        ['dcs hook', [1, 2, [-1, 55], 3]],
        ['dcs put', 'bc;de'],
        ['dcs unhook', false] // false for abort
      ], null);
    });
    it('SUB should abort DCS', () => {
      test('abc\x901;2::55;3+$abc;de\x1a', [
        ['print', 'abc'],
        ['dcs hook', [1, 2, [-1, 55], 3]],
        ['dcs put', 'bc;de'],
        ['dcs unhook', false] // false for abort
      ], null);
    });
    it('CAN should abort OSC', () => {
      test('\x1b]0;abc123€öäü\x18', [
        ['osc', '0;abc123€öäü, success: false']
      ], null);
    });
    it('SUB should abort OSC', () => {
      test('\x1b]0;abc123€öäü\x1a', [
        ['osc', '0;abc123€öäü, success: false']
      ], null);
    });
  });

  describe('coverage tests', () => {
    it('CSI_IGNORE error', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_IGNORE;
      parse(parser, '€öäü');
      assert.equal(parser.currentState, ParserState.CSI_IGNORE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('DCS_IGNORE error', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.DCS_IGNORE;
      parse(parser, '€öäü');
      assert.equal(parser.currentState, ParserState.DCS_IGNORE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('DCS_PASSTHROUGH error', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.DCS_PASSTHROUGH;
      parse(parser, '\x901;2;3+$a€öäü');
      assert.equal(parser.currentState, ParserState.DCS_PASSTHROUGH);
      testTerminal.compare([['dcs hook', [1, 2, 3]], ['dcs put', '€öäü']]);
      parser.reset();
      testTerminal.clear();
    });
    it('error else of if (code > 159)', () => {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.GROUND;
      parse(parser, '\x9c');
      assert.equal(parser.currentState, ParserState.GROUND);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
  });

  describe('set/clear handler', () => {
    const INPUT = '\x1b[1;31mhello \x1b%Gwor\x1bEld!\x1b[0m\r\n$>\x1b]1;foo=bar\x1b\\';
    let parser2: TestEscapeSequenceParser;
    let print = '';
    const esc: string[] = [];
    const csi: [string, ParamsArray, string][] = [];
    const exe: string[] = [];
    const osc: [number, string][] = [];
    const dcs: ([string] | [string, string] | [string, string, ParamsArray, number])[] = [];
    function clearAccu(): void {
      print = '';
      esc.length = 0;
      csi.length = 0;
      exe.length = 0;
      osc.length = 0;
      dcs.length = 0;
    }
    beforeEach(() => {
      parser2 = new TestEscapeSequenceParser();
      clearAccu();
    });
    it('print handler', () => {
      parser2.setPrintHandler(function (data: Uint32Array, start: number, end: number): void {
        for (let i = start; i < end; ++i) {
          print += stringFromCodePoint(data[i]);
        }
      });
      parse(parser2, INPUT);
      assert.equal(print, 'hello world!$>');
      parser2.clearPrintHandler();
      parser2.clearPrintHandler(); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      assert.equal(print, '');
    });
    it('ESC handler', () => {
      parser2.registerEscHandler({ intermediates: '%', final: 'G' }, function (): boolean {
        esc.push('%G');
        return true;
      });
      parser2.registerEscHandler({ final: 'E' }, function (): boolean {
        esc.push('E');
        return true;
      });
      parse(parser2, INPUT);
      assert.deepEqual(esc, ['%G', 'E']);
      parser2.clearEscHandler({ intermediates: '%', final: 'G' });
      parser2.clearEscHandler({ intermediates: '%', final: 'G' }); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      assert.deepEqual(esc, ['E']);
      parser2.clearEscHandler({ final: 'E' });
      clearAccu();
      parse(parser2, INPUT);
      assert.deepEqual(esc, []);
    });
    describe('ESC custom handlers', () => {
      it('prevent fallback', () => {
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('default - %G'); return true; });
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('custom - %G'); return true; });
        parse(parser2, INPUT);
        assert.deepEqual(esc, ['custom - %G']);
      });
      it('allow fallback', () => {
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('default - %G'); return true; });
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('custom - %G'); return false; });
        parse(parser2, INPUT);
        assert.deepEqual(esc, ['custom - %G', 'default - %G']);
      });
      it('Multiple custom handlers fallback once', () => {
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('default - %G'); return true; });
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('custom - %G'); return true; });
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('custom2 - %G'); return false; });
        parse(parser2, INPUT);
        assert.deepEqual(esc, ['custom2 - %G', 'custom - %G']);
      });
      it('Multiple custom handlers no fallback', () => {
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('default - %G'); return true; });
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('custom - %G'); return true; });
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('custom2 - %G'); return true; });
        parse(parser2, INPUT);
        assert.deepEqual(esc, ['custom2 - %G']);
      });
      it('Execution order should go from latest handler down to the original', () => {
        const order: number[] = [];
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { order.push(1); return true; });
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { order.push(2); return false; });
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { order.push(3); return false; });
        parse(parser2, '\x1b%G');
        assert.deepEqual(order, [3, 2, 1]);
      });
      it('Dispose should work', () => {
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('default - %G'); return true; });
        const dispo = parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('custom - %G'); return true; });
        dispo.dispose();
        parse(parser2, INPUT);
        assert.deepEqual(esc, ['default - %G']);
      });
      it('Should not corrupt the parser when dispose is called twice', () => {
        parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('default - %G'); return true; });
        const dispo = parser2.registerEscHandler({ intermediates: '%', final: 'G' }, () => { esc.push('custom - %G'); return true; });
        dispo.dispose();
        dispo.dispose();
        parse(parser2, INPUT);
        assert.deepEqual(esc, ['default - %G']);
      });
    });
    it('CSI handler', () => {
      parser2.registerCsiHandler({ final: 'm' }, function (params: IParams): boolean {
        csi.push(['m', params.toArray(), '']);
        return true;
      });
      parse(parser2, INPUT);
      assert.deepEqual(csi, [['m', [1, 31], ''], ['m', [0], '']]);
      parser2.clearCsiHandler({ final: 'm' });
      parser2.clearCsiHandler({ final: 'm' }); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      assert.deepEqual(csi, []);
    });
    describe('CSI custom handlers', () => {
      it('Prevent fallback', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        parser2.registerCsiHandler({ final: 'm' }, params => { csi.push(['m', params.toArray(), '']); return true; });
        parser2.registerCsiHandler({ final: 'm' }, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        parse(parser2, INPUT);
        assert.deepEqual(csi, [], 'Should not fallback to original handler');
        assert.deepEqual(csiCustom, [['m', [1, 31], ''], ['m', [0], '']]);
      });
      it('Allow fallback', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        parser2.registerCsiHandler({ final: 'm' }, params => { csi.push(['m', params.toArray(), '']); return true; });
        parser2.registerCsiHandler({ final: 'm' }, params => { csiCustom.push(['m', params.toArray(), '']); return false; });
        parse(parser2, INPUT);
        assert.deepEqual(csi, [['m', [1, 31], ''], ['m', [0], '']], 'Should fallback to original handler');
        assert.deepEqual(csiCustom, [['m', [1, 31], ''], ['m', [0], '']]);
      });
      it('Multiple custom handlers fallback once', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        const csiCustom2: [string, ParamsArray, string][] = [];
        parser2.registerCsiHandler({ final: 'm' }, params => { csi.push(['m', params.toArray(), '']); return true; });
        parser2.registerCsiHandler({ final: 'm' }, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        parser2.registerCsiHandler({ final: 'm' }, params => { csiCustom2.push(['m', params.toArray(), '']); return false; });
        parse(parser2, INPUT);
        assert.deepEqual(csi, [], 'Should not fallback to original handler');
        assert.deepEqual(csiCustom, [['m', [1, 31], ''], ['m', [0], '']]);
        assert.deepEqual(csiCustom2, [['m', [1, 31], ''], ['m', [0], '']]);
      });
      it('Multiple custom handlers no fallback', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        const csiCustom2: [string, ParamsArray, string][] = [];
        parser2.registerCsiHandler({ final: 'm' }, params => { csi.push(['m', params.toArray(), '']); return true; });
        parser2.registerCsiHandler({ final: 'm' }, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        parser2.registerCsiHandler({ final: 'm' }, params => { csiCustom2.push(['m', params.toArray(), '']); return true; });
        parse(parser2, INPUT);
        assert.deepEqual(csi, [], 'Should not fallback to original handler');
        assert.deepEqual(csiCustom, [], 'Should not fallback once');
        assert.deepEqual(csiCustom2, [['m', [1, 31], ''], ['m', [0], '']]);
      });
      it('Execution order should go from latest handler down to the original', () => {
        const order: number[] = [];
        parser2.registerCsiHandler({ final: 'm' }, () => { order.push(1); return true; });
        parser2.registerCsiHandler({ final: 'm' }, () => { order.push(2); return false; });
        parser2.registerCsiHandler({ final: 'm' }, () => { order.push(3); return false; });
        parse(parser2, '\x1b[0m');
        assert.deepEqual(order, [3, 2, 1]);
      });
      it('Dispose should work', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        parser2.registerCsiHandler({ final: 'm' }, params => { csi.push(['m', params.toArray(), '']); return true; });
        const customHandler = parser2.registerCsiHandler({ final: 'm' }, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        customHandler.dispose();
        parse(parser2, INPUT);
        assert.deepEqual(csi, [['m', [1, 31], ''], ['m', [0], '']]);
        assert.deepEqual(csiCustom, [], 'Should not use custom handler as it was disposed');
      });
      it('Should not corrupt the parser when dispose is called twice', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        parser2.registerCsiHandler({ final: 'm' }, params => { csi.push(['m', params.toArray(), '']); return true; });
        const customHandler = parser2.registerCsiHandler({ final: 'm' }, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        customHandler.dispose();
        customHandler.dispose();
        parse(parser2, INPUT);
        assert.deepEqual(csi, [['m', [1, 31], ''], ['m', [0], '']]);
        assert.deepEqual(csiCustom, [], 'Should not use custom handler as it was disposed');
      });
    });
    it('EXECUTE handler', () => {
      parser2.setExecuteHandler('\n', function (): boolean {
        exe.push('\n');
        return true;
      });
      parser2.setExecuteHandler('\r', function (): boolean {
        exe.push('\r');
        return true;
      });
      parse(parser2, INPUT);
      assert.deepEqual(exe, ['\r', '\n']);
      parser2.clearExecuteHandler('\r');
      parser2.clearExecuteHandler('\r'); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      assert.deepEqual(exe, ['\n']);
    });
    it('OSC handler', () => {
      parser2.registerOscHandler(1, new OscHandler(function (data: string): boolean {
        osc.push([1, data]);
        return true;
      }));
      parse(parser2, INPUT);
      assert.deepEqual(osc, [[1, 'foo=bar']]);
      parser2.clearOscHandler(1);
      parser2.clearOscHandler(1); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      assert.deepEqual(osc, []);
    });
    describe('OSC custom handlers', () => {
      it('Prevent fallback', () => {
        const oscCustom: [number, string][] = [];
        parser2.registerOscHandler(1, new OscHandler(data => { osc.push([1, data]); return true; }));
        parser2.registerOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        parse(parser2, INPUT);
        assert.deepEqual(osc, [], 'Should not fallback to original handler');
        assert.deepEqual(oscCustom, [[1, 'foo=bar']]);
      });
      it('Allow fallback', () => {
        const oscCustom: [number, string][] = [];
        parser2.registerOscHandler(1, new OscHandler(data => { osc.push([1, data]); return true; }));
        parser2.registerOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return false; }));
        parse(parser2, INPUT);
        assert.deepEqual(osc, [[1, 'foo=bar']], 'Should fallback to original handler');
        assert.deepEqual(oscCustom, [[1, 'foo=bar']]);
      });
      it('Multiple custom handlers fallback once', () => {
        const oscCustom: [number, string][] = [];
        const oscCustom2: [number, string][] = [];
        parser2.registerOscHandler(1, new OscHandler(data => { osc.push([1, data]); return true; }));
        parser2.registerOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        parser2.registerOscHandler(1, new OscHandler(data => { oscCustom2.push([1, data]); return false; }));
        parse(parser2, INPUT);
        assert.deepEqual(osc, [], 'Should not fallback to original handler');
        assert.deepEqual(oscCustom, [[1, 'foo=bar']]);
        assert.deepEqual(oscCustom2, [[1, 'foo=bar']]);
      });
      it('Multiple custom handlers no fallback', () => {
        const oscCustom: [number, string][] = [];
        const oscCustom2: [number, string][] = [];
        parser2.registerOscHandler(1, new OscHandler(data => { osc.push([1, data]); return true; }));
        parser2.registerOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        parser2.registerOscHandler(1, new OscHandler(data => { oscCustom2.push([1, data]); return true; }));
        parse(parser2, INPUT);
        assert.deepEqual(osc, [], 'Should not fallback to original handler');
        assert.deepEqual(oscCustom, [], 'Should not fallback once');
        assert.deepEqual(oscCustom2, [[1, 'foo=bar']]);
      });
      it('Execution order should go from latest handler down to the original', () => {
        const order: number[] = [];
        parser2.registerOscHandler(1, new OscHandler(() => { order.push(1); return true; }));
        parser2.registerOscHandler(1, new OscHandler(() => { order.push(2); return false; }));
        parser2.registerOscHandler(1, new OscHandler(() => { order.push(3); return false; }));
        parse(parser2, '\x1b]1;foo=bar\x1b\\');
        assert.deepEqual(order, [3, 2, 1]);
      });
      it('Dispose should work', () => {
        const oscCustom: [number, string][] = [];
        parser2.registerOscHandler(1, new OscHandler(data => { osc.push([1, data]); return true; }));
        const customHandler = parser2.registerOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        customHandler.dispose();
        parse(parser2, INPUT);
        assert.deepEqual(osc, [[1, 'foo=bar']]);
        assert.deepEqual(oscCustom, [], 'Should not use custom handler as it was disposed');
      });
      it('Should not corrupt the parser when dispose is called twice', () => {
        const oscCustom: [number, string][] = [];
        parser2.registerOscHandler(1, new OscHandler(data => { osc.push([1, data]); return true; }));
        const customHandler = parser2.registerOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        customHandler.dispose();
        customHandler.dispose();
        parse(parser2, INPUT);
        assert.deepEqual(osc, [[1, 'foo=bar']]);
        assert.deepEqual(oscCustom, [], 'Should not use custom handler as it was disposed');
      });
    });
    it('DCS handler', () => {
      parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, {
        hook: function (params: IParams): void {
          dcs.push(['hook', '', params.toArray(), 0]);
        },
        put: function (data: Uint32Array, start: number, end: number): void {
          let s = '';
          for (let i = start; i < end; ++i) {
            s += stringFromCodePoint(data[i]);
          }
          dcs.push(['put', s]);
        },
        unhook: function (): boolean {
          dcs.push(['unhook']);
          return true;
        }
      });
      parse(parser2, '\x1bP1;2;3+pabc');
      parse(parser2, ';de\x9c');
      assert.deepEqual(dcs, [
        ['hook', '', [1, 2, 3], 0],
        ['put', 'abc'], ['put', ';de'],
        ['unhook']
      ]);
      parser2.clearDcsHandler({ intermediates: '+', final: 'p' });
      parser2.clearDcsHandler({ intermediates: '+', final: 'p' }); // should not throw
      clearAccu();
      parse(parser2, '\x1bP1;2;3+pabc');
      parse(parser2, ';de\x9c');
      assert.deepEqual(dcs, []);
    });
    describe('DCS custom handlers', () => {
      const DCS_INPUT = '\x1bP1;2;3+pabc\x1b\\';
      it('Prevent fallback', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['A', params.toArray(), data]); return true; }));
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        parse(parser2, DCS_INPUT);
        assert.deepEqual(dcsCustom, [['B', [1, 2, 3], 'abc']]);
      });
      it('Allow fallback', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['A', params.toArray(), data]); return true; }));
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return false; }));
        parse(parser2, DCS_INPUT);
        assert.deepEqual(dcsCustom, [['B', [1, 2, 3], 'abc'], ['A', [1, 2, 3], 'abc']]);
      });
      it('Multiple custom handlers fallback once', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['A', params.toArray(), data]); return true; }));
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['C', params.toArray(), data]); return false; }));
        parse(parser2, DCS_INPUT);
        assert.deepEqual(dcsCustom, [['C', [1, 2, 3], 'abc'], ['B', [1, 2, 3], 'abc']]);
      });
      it('Multiple custom handlers no fallback', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['A', params.toArray(), data]); return true; }));
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['C', params.toArray(), data]); return true; }));
        parse(parser2, DCS_INPUT);
        assert.deepEqual(dcsCustom, [['C', [1, 2, 3], 'abc']]);
      });
      it('Execution order should go from latest handler down to the original', () => {
        const order: number[] = [];
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler(() => { order.push(1); return true; }));
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler(() => { order.push(2); return false; }));
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler(() => { order.push(3); return false; }));
        parse(parser2, DCS_INPUT);
        assert.deepEqual(order, [3, 2, 1]);
      });
      it('Dispose should work', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['A', params.toArray(), data]); return true; }));
        const dispo = parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        dispo.dispose();
        parse(parser2, DCS_INPUT);
        assert.deepEqual(dcsCustom, [['A', [1, 2, 3], 'abc']]);
      });
      it('Should not corrupt the parser when dispose is called twice', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['A', params.toArray(), data]); return true; }));
        const dispo = parser2.registerDcsHandler({ intermediates: '+', final: 'p' }, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        dispo.dispose();
        dispo.dispose();
        parse(parser2, DCS_INPUT);
        assert.deepEqual(dcsCustom, [['A', [1, 2, 3], 'abc']]);
      });
    });
    it('ERROR handler', () => {
      let errorState: IParsingState | null = null;
      parser2.setErrorHandler(function (state: IParsingState): IParsingState {
        errorState = state;
        return state;
      });
      parse(parser2, '\x1b[1;2;€;3m'); // faulty escape sequence
      assert.deepEqual(errorState, {
        position: 6,
        code: '€'.charCodeAt(0),
        currentState: ParserState.CSI_PARAM,
        collect: 0,
        params: Params.fromArray([1, 2, 0]), // extra zero here
        abort: false
      });
      parser2.clearErrorHandler();
      parser2.clearErrorHandler(); // should not throw
      errorState = null;
      parse(parser2, '\x1b[1;2;a;3m');
      assert.equal(errorState, null);
    });
  });
  describe('function identifiers', () => {
    describe('registration limits', () => {
      it('prefix range 0x3c .. 0x3f, one byte', () => {
        for (let i = 0x3c; i <= 0x3f; ++i) {
          const c = String.fromCharCode(i);
          assert.equal(parser.identToString(parser.identifier({ prefix: c, final: 'z' })), c + 'z');
        }
        assert.throws(() => { parser.identifier({ prefix: '\x3b', final: 'z' }); }, 'prefix must be in range 0x3c .. 0x3f');
        assert.throws(() => { parser.identifier({ prefix: '\x40', final: 'z' }); }, 'prefix must be in range 0x3c .. 0x3f');
        assert.throws(() => { parser.identifier({ prefix: '??', final: 'z' }); }, 'only one byte as prefix supported');
      });
      it('intermediates range 0x20 .. 0x2f, up to two bytes', () => {
        for (let i = 0x20; i <= 0x2f; ++i) {
          const c = String.fromCharCode(i);
          assert.equal(parser.identToString(parser.identifier({ intermediates: c + c, final: 'z' })), c + c + 'z');
        }
        assert.throws(() => { parser.identifier({ intermediates: '\x1f', final: 'z' }); }, 'intermediate must be in range 0x20 .. 0x2f');
        assert.throws(() => { parser.identifier({ intermediates: '\x30', final: 'z' }); }, 'intermediate must be in range 0x20 .. 0x2f');
        assert.throws(() => { parser.identifier({ intermediates: '!!!', final: 'z' }); }, 'only two bytes as intermediates are supported');
      });
      it('final CSI/DCS range 0x40 .. 0x7e (default), one byte', () => {
        for (let i = 0x40; i <= 0x7e; ++i) {
          const c = String.fromCharCode(i);
          assert.equal(parser.identToString(parser.identifier({ final: c })), c);
        }
        assert.throws(() => { parser.identifier({ final: '\x3f' }); }, 'final must be in range 64 .. 126');
        assert.throws(() => { parser.identifier({ final: '\x7f' }); }, 'final must be in range 64 .. 126');
        assert.throws(() => { parser.identifier({ final: 'zz' }); }, 'final must be a single byte');
      });
      it('final ESC range 0x30 .. 0x7e, one byte', () => {
        for (let i = 0x30; i <= 0x7e; ++i) {
          const final = String.fromCharCode(i);
          let handler: IDisposable | undefined;
          assert.doesNotThrow(() => { handler = parser.registerEscHandler({ final }, () => true); }, 'final must be in range 48 .. 126');
          if (handler) handler.dispose();
        }
        assert.throws(() => { parser.registerEscHandler({ final: '\x2f' }, () => true); }, 'final must be in range 48 .. 126');
        assert.throws(() => { parser.registerEscHandler({ final: '\x7f' }, () => true); }, 'final must be in range 48 .. 126');
      });
      it('id calculation - should stacking prefix -> intermediate -> final', () => {
        assert.equal(parser.identToString(parser.identifier({ final: 'z' })), 'z');
        assert.equal(parser.identToString(parser.identifier({ prefix: '?', final: 'z' })), '?z');
        assert.equal(parser.identToString(parser.identifier({ intermediates: '!', final: 'z' })), '!z');
        assert.equal(parser.identToString(parser.identifier({ prefix: '?', intermediates: '!', final: 'z' })), '?!z');
        assert.equal(parser.identToString(parser.identifier({ prefix: '?', intermediates: '!!', final: 'z' })), '?!!z');
      });
    });
    describe('identifier invocation', () => {
      it('ESC', () => {
        const callstack: string[] = [];
        const h1 = parser.registerEscHandler({ final: 'z' }, () => { callstack.push('z'); return true; });
        const h2 = parser.registerEscHandler({ intermediates: '!', final: 'z' }, () => { callstack.push('!z'); return true; });
        const h3 = parser.registerEscHandler({ intermediates: '!!', final: 'z' }, () => { callstack.push('!!z'); return true; });
        parse(parser, '\x1bz\x1b!z\x1b!!z');
        h1.dispose();
        h2.dispose();
        h3.dispose();
        parse(parser, '\x1bz\x1b!z\x1b!!z');
        assert.deepEqual(callstack, ['z', '!z', '!!z']);
      });
      it('CSI', () => {
        const callstack: any[] = [];
        const h1 = parser.registerCsiHandler({ final: 'z' }, params => { callstack.push(['z', params.toArray()]); return true; });
        const h2 = parser.registerCsiHandler({ intermediates: '!', final: 'z' }, params => { callstack.push(['!z', params.toArray()]); return true; });
        const h3 = parser.registerCsiHandler({ intermediates: '!!', final: 'z' }, params => { callstack.push(['!!z', params.toArray()]); return true; });
        const h4 = parser.registerCsiHandler({ prefix: '?', final: 'z' }, params => { callstack.push(['?z', params.toArray()]); return true; });
        const h5 = parser.registerCsiHandler({ prefix: '?', intermediates: '!', final: 'z' }, params => { callstack.push(['?!z', params.toArray()]); return true; });
        const h6 = parser.registerCsiHandler({ prefix: '?', intermediates: '!!', final: 'z' }, params => { callstack.push(['?!!z', params.toArray()]); return true; });
        parse(parser, '\x1b[1;z\x1b[1;!z\x1b[1;!!z\x1b[?1;z\x1b[?1;!z\x1b[?1;!!z');
        h1.dispose();
        h2.dispose();
        h3.dispose();
        h4.dispose();
        h5.dispose();
        h6.dispose();
        parse(parser, '\x1b[1;z\x1b[1;!z\x1b[1;!!z\x1b[?1;z\x1b[?1;!z\x1b[?1;!!z');
        assert.deepEqual(
          callstack,
          [['z', [1, 0]], ['!z', [1, 0]], ['!!z', [1, 0]], ['?z', [1, 0]], ['?!z', [1, 0]], ['?!!z', [1, 0]]]
        );
      });
      it('DCS', () => {
        const callstack: any[] = [];
        const h1 = parser.registerDcsHandler({ final: 'z' }, new DcsHandler((data, params) => { callstack.push(['z', params.toArray(), data]); return true; }));
        const h2 = parser.registerDcsHandler({ intermediates: '!', final: 'z' }, new DcsHandler((data, params) => { callstack.push(['!z', params.toArray(), data]); return true; }));
        const h3 = parser.registerDcsHandler({ intermediates: '!!', final: 'z' }, new DcsHandler((data, params) => { callstack.push(['!!z', params.toArray(), data]); return true; }));
        const h4 = parser.registerDcsHandler({ prefix: '?', final: 'z' }, new DcsHandler((data, params) => { callstack.push(['?z', params.toArray(), data]); return true; }));
        const h5 = parser.registerDcsHandler({ prefix: '?', intermediates: '!', final: 'z' }, new DcsHandler((data, params) => { callstack.push(['?!z', params.toArray(), data]); return true; }));
        const h6 = parser.registerDcsHandler({ prefix: '?', intermediates: '!!', final: 'z' }, new DcsHandler((data, params) => { callstack.push(['?!!z', params.toArray(), data]); return true; }));
        parse(parser, '\x1bP1;zAB\x1b\\\x1bP1;!zAB\x1b\\\x1bP1;!!zAB\x1b\\\x1bP?1;zAB\x1b\\\x1bP?1;!zAB\x1b\\\x1bP?1;!!zAB\x1b\\');
        h1.dispose();
        h2.dispose();
        h3.dispose();
        h4.dispose();
        h5.dispose();
        h6.dispose();
        parse(parser, '\x1bP1;zAB\x1b\\\x1bP1;!zAB\x1b\\\x1bP1;!!zAB\x1b\\\x1bP?1;zAB\x1b\\\x1bP?1;!zAB\x1b\\\x1bP?1;!!zAB\x1b\\');
        assert.deepEqual(
          callstack,
          [
            ['z', [1, 0], 'AB'],
            ['!z', [1, 0], 'AB'],
            ['!!z', [1, 0], 'AB'],
            ['?z', [1, 0], 'AB'],
            ['?!z', [1, 0], 'AB'],
            ['?!!z', [1, 0], 'AB']
          ]
        );
      });
    });
  });
  // TODO: error conditions and error recovery (not implemented yet in parser)
});


/**
 * async handler tests.
 */

function parseSync(parser: TestEscapeSequenceParser, data: string): void | Promise<boolean> {
  const container = new Uint32Array(data.length);
  const decoder = new StringToUtf32();
  return parser.parse(container, decoder.decode(data, container));
}
async function parseP(parser: TestEscapeSequenceParser, data: string): Promise<void> {
  const container = new Uint32Array(data.length);
  const decoder = new StringToUtf32();
  const len = decoder.decode(data, container);
  let result: void | Promise<boolean>;
  let prev: boolean | undefined;
  while (result = parser.parse(container, len, prev)) {
    prev = await result;
  }
}
function evalStackSaves(stackSaves: IParserStackState[], data: [number, ParserStackType, number][]): void {
  assert.equal(stackSaves.length, data.length);
  for (let i = 0; i < data.length; ++i) {
    assert.equal(stackSaves[i].chunkPos, data[i][0]);
    assert.equal(stackSaves[i].state, data[i][1]);
    assert.equal(stackSaves[i].handlerPos, data[i][2]);
  }
}
// helper similiar to assert.throws for async functions
async function throwsAsync(fn: () => Promise<any>, message?: string | undefined): Promise<void> {
  let msg: string | undefined;
  try {
    await fn();
  } catch (e) {
    if (e instanceof Error) {
      msg = e.message;
    } else if (typeof e === 'string') {
      msg = e;
    }
    if (typeof message === 'string') {
      assert.equal(msg, message);
    }
    return;
  }
  assert.throws(fn, message);
}

describe('EscapeSequenceParser - async', () => {
  // sequences: SGR 1;31 | hello SP | ESC %G | wor | ESC E | ld! | SGR 0 | EXE \r\n | $> | DCS 1;2 a [xyz] ST | OSC 1;foo=bar ST | FIN
  // needed handlers: CSI m, PRINT, ESC %G, ESC E, EXE \r, EXE \n, OSC 1
  const INPUT = '\x1b[1;31mhello \x1b%Gwor\x1bEld!\x1b[0m\r\n$>\x1bP1;2axyz\x1b\\\x1b]1;foo=bar\x1b\\FIN';
  let RESULT: any[];
  let parser: TestEscapeSequenceParser;
  const callstack: any[] = [];
  function clearAccu(): void {
    callstack.length = 0;
    parser.trackedStack.length = 0;
  }
  beforeEach(() => {
    RESULT = [
      ['SGR', [1, 31]],
      ['PRINT', 'hello '],
      ['ESC %G'],
      ['PRINT', 'wor'],
      ['ESC E'],
      ['PRINT', 'ld!'],
      ['SGR', [0]],
      ['EXE \r'],
      ['EXE \n'],
      ['PRINT', '$>'],
      ['DCS a', ['xyz', [1, 2]]],
      ['OSC 1', 'foo=bar'],
      ['PRINT', 'FIN']
    ];
    parser = new TestEscapeSequenceParser();
    parser.reset();
    parser.trackStackSavesOnPause();
    clearAccu();
  });
  describe('sync handlers should behave as before', () => {
    beforeEach(() => {
      parser.setPrintHandler((data, start, end) => {
        let result = '';
        for (let i = start; i < end; ++i) {
          result += stringFromCodePoint(data[i]);
        }
        callstack.push(['PRINT', result]);
      });
      parser.registerCsiHandler({ final: 'm' }, params => { callstack.push(['SGR', params.toArray()]); return true; });
      parser.registerEscHandler({ intermediates: '%', final: 'G' }, () => { callstack.push(['ESC %G']); return true; });
      parser.registerEscHandler({ final: 'E' }, () => { callstack.push(['ESC E']); return true; });
      parser.setExecuteHandler('\r', () => { callstack.push(['EXE \r']); return true; });
      parser.setExecuteHandler('\n', () => { callstack.push(['EXE \n']); return true; });
      parser.registerOscHandler(1, new OscHandler(data => { callstack.push(['OSC 1', data]); return true; }));
      parser.registerDcsHandler({final: 'a'}, new DcsHandler((data, params) => { callstack.push(['DCS a', [data, params.toArray()]]); return true;}));
    });

    it('sync handlers keep being parsed in sync mode', () => {
      // note: if we have only sync handlers, a parse call should never return anything
      assert.equal(!parseSync(parser, INPUT), true);
      assert.equal(parser.parseStack.state, ParserStackType.NONE);  // not paused
      assert.equal(parser.trackedStack.length, 0);                  // never got paused
    });
    it('correct result on sync parse call', () => {
      parseSync(parser, INPUT);
      assert.deepEqual(callstack, RESULT);
      assert.equal(parser.trackedStack.length, 0);
    });
    it('correct result on async parse call', async () => {
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT);
      assert.equal(parser.trackedStack.length, 0);
    });
  });
  describe('async handlers', () => {
    beforeEach(() => {
      parser.setPrintHandler((data, start, end) => {
        let result = '';
        for (let i = start; i < end; ++i) {
          result += stringFromCodePoint(data[i]);
        }
        callstack.push(['PRINT', result]);
      });
      parser.registerCsiHandler({ final: 'm' }, async params => { callstack.push(['SGR', params.toArray()]); return true; });
      parser.registerEscHandler({ intermediates: '%', final: 'G' }, async () => { callstack.push(['ESC %G']); return true; });
      parser.registerEscHandler({ final: 'E' }, async () => { callstack.push(['ESC E']); return true; });
      parser.setExecuteHandler('\r', () => { callstack.push(['EXE \r']); return true; });
      parser.setExecuteHandler('\n', () => { callstack.push(['EXE \n']); return true; });
      parser.registerOscHandler(1, new OscHandler(async data => { callstack.push(['OSC 1', data]); return true; }));
      parser.registerDcsHandler({final: 'a'}, new DcsHandler(async (data, params) => { callstack.push(['DCS a', [data, params.toArray()]]); return true;}));
    });

    it('sync parse call does not work anymore', () => {
      assert.notEqual(!parseSync(parser, INPUT), true);
      assert.notDeepEqual(callstack, RESULT);
      // due to sync calling we should save exactly one saved stack
      // proper continuation is not possible anymore, as we lost the promise resolve value
      assert.equal(parser.trackedStack.length, 1);
    });
    it('improper continuation should throw', async () => {
      /**
       * Explanation:
       * The first sync call will stop at the first promise returned,
       * but does not await its resolve value.
       * The second sync call to parse will fail due to missing `promiseResult`,
       * which is needed for correct continuation.
       */
      assert.notEqual(!parseSync(parser, INPUT), true);
      assert.notDeepEqual(callstack, RESULT);
      assert.throws(() => parseSync(parser, INPUT), 'improper continuation due to previous async handler, giving up parsing');
      // keeps being broken for further parse calls (sync and async)
      assert.throws(() => parseSync(parser, 'random'), 'improper continuation due to previous async handler, giving up parsing');
      await throwsAsync(() => parseP(parser, 'foobar'), 'improper continuation due to previous async handler, giving up parsing');
      // reset should lift the error condition
      parser.reset();
      await parseP(parser, INPUT); // does not throw anymore
    });
    it('correct result on awaited parse call', async () => {
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT);
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
    });
    it('correct result on chunked awaited parse calls', async () => {
      RESULT = [
        ['SGR', [1, 31]],
        ['PRINT', 'h'],  // due to single char input PRINT is split
        ['PRINT', 'e'],
        ['PRINT', 'l'],
        ['PRINT', 'l'],
        ['PRINT', 'o'],
        ['PRINT', ' '],
        ['ESC %G'],
        ['PRINT', 'w'],
        ['PRINT', 'o'],
        ['PRINT', 'r'],
        ['ESC E'],
        ['PRINT', 'l'],
        ['PRINT', 'd'],
        ['PRINT', '!'],
        ['SGR', [0]],
        ['EXE \r'],
        ['EXE \n'],
        ['PRINT', '$'],
        ['PRINT', '>'],
        ['DCS a', ['xyz', [1, 2]]],
        ['OSC 1', 'foo=bar'],
        ['PRINT', 'F'],
        ['PRINT', 'I'],
        ['PRINT', 'N']
      ];

      // split to single char input
      for (let i = 0; i < INPUT.length; ++i) {
        // Note: a single fully awaited parse call always ends in sync mode,
        // which re-enables faster sync processing in the higher up callstack
        await parseP(parser, INPUT[i]);
      }
      assert.deepEqual(callstack, RESULT);
      evalStackSaves(parser.trackedStack, [
        [0, ParserStackType.CSI, 0],
        [0, ParserStackType.ESC, 0],
        [0, ParserStackType.ESC, 0],
        [0, ParserStackType.CSI, 0],
        [0, ParserStackType.DCS, 0],
        [0, ParserStackType.OSC, 0]
      ]);
    });
    it('multiple async SGR handlers', async () => {
      // register with fallback
      const SGR2 = parser.registerCsiHandler({ final: 'm' }, async params => { callstack.push(['2# SGR', params.toArray()]); return false; });
      await parseP(parser, INPUT);
      // should contain [2# SGR, SGR] call pairs
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '2# SGR') assert.equal(callstack[i + 1][0], 'SGR', 'Should fallback to original handler');
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 1],
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 1],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // after dispose we should be back to RESULT
      SGR2.dispose();
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT, 'Should not call custom handler');
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();

      // register without fallback
      const SGR22 = parser.registerCsiHandler({ final: 'm' }, async params => { callstack.push(['2# SGR', params.toArray()]); return true; });
      await parseP(parser, INPUT);
      // should only contain 2# SGR
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '2# SGR') assert.notEqual(callstack[i + 1][0], 'SGR', 'Should not fallback to original handler');
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 1],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 1],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // after dispose we should be back to RESULT
      SGR22.dispose();
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT, 'Should not call custom handler');
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
    });
    it('multiple async ESC handlers', async () => {
      // register with fallback
      const ESC2 = parser.registerEscHandler({ final: 'E' }, async () => { callstack.push(['2# ESC E']); return false; });
      await parseP(parser, INPUT);
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '2# ESC E') assert.equal(callstack[i + 1][0], 'ESC E', 'Should fallback to original handler');
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 1],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // after dispose we should be back to RESULT
      ESC2.dispose();
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT, 'Should not call custom handler');
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();

      // register without fallback
      const ESC22 = parser.registerEscHandler({ final: 'E' }, async () => { callstack.push(['2# ESC E']); return true; });
      await parseP(parser, INPUT);
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '2# ESC E') assert.notEqual(callstack[i + 1][0], 'ESC E', 'Should not fallback to original handler');
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 1],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // after dispose we should be back to RESULT
      ESC22.dispose();
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT, 'Should not call custom handler');
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
    });
    it('sync/async SGR mixed', async () => {
      // sync with fallback
      const SGR2 = parser.registerCsiHandler({ final: 'm' }, params => { callstack.push(['2# SGR', params.toArray()]); return false; });
      // async with fallback
      const SGR3 = parser.registerCsiHandler({ final: 'm' }, async params => { callstack.push(['3# SGR', params.toArray()]); return false; });
      await parseP(parser, INPUT);
      // should contain [3# SGR, 2# SGR, SGR] call triples
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '3# SGR') {
          assert.equal(callstack[i + 1][0], '2# SGR', 'Should fallback to next handler');
          assert.equal(callstack[i + 2][0], 'SGR', 'Should fallback to original handler');
        }
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 2],
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 2],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // dispose SGR2 (sync one)
      SGR2.dispose();
      await parseP(parser, INPUT);
      // should contain [3# SGR, SGR] call pairs
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '3# SGR') {
          assert.equal(callstack[i + 1][0], 'SGR', 'Should fallback to original handler');
        }
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 1],
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 1],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // dispose SGR3 (async one)
      SGR3.dispose();
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT, 'Should not call custom handler');
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
    });
    it('multiple async OSC handlers', async () => {
      // register with fallback
      const OSC2 = parser.registerOscHandler(1, new OscHandler(async data => { callstack.push(['2# OSC 1', data]); return false; }));
      await parseP(parser, INPUT);
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '2# OSC 1') assert.equal(callstack[i + 1][0], 'OSC 1', 'Should fallback to original handler');
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // after dispose we should be back to RESULT
      OSC2.dispose();
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT, 'Should not call custom handler');
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();

      // register without fallback
      const OSC22 = parser.registerOscHandler(1, new OscHandler(async data => { callstack.push(['2# OSC 1', data]); return true; }));
      await parseP(parser, INPUT);
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '2# OSC 1') assert.notEqual(callstack[i + 1][0], 'OSC 1', 'Should fallback to original handler');
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // after dispose we should be back to RESULT
      OSC22.dispose();
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT, 'Should not call custom handler');
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
    });
    it('multiple async DCS handlers', async () => {
      // register with fallback
      const DCS2 = parser.registerDcsHandler({final: 'a'}, new DcsHandler(async (data, params) => { callstack.push(['#2 DCS a', [data, params.toArray()]]); return false;}));
      await parseP(parser, INPUT);
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '2# DCS a') assert.equal(callstack[i + 1][0], 'DCS a', 'Should fallback to original handler');
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // after dispose we should be back to RESULT
      DCS2.dispose();
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT, 'Should not call custom handler');
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();

      // register without fallback
      const DCS22 = parser.registerDcsHandler({final: 'a'}, new DcsHandler(async (data, params) => { callstack.push(['#2 DCS a', [data, params.toArray()]]); return true;}));
      await parseP(parser, INPUT);
      for (let i = 0; i < callstack.length; ++i) {
        const entry = callstack[i];
        if (entry[0] === '2# DCS a') assert.notEqual(callstack[i + 1][0], 'DCS a', 'Should fallback to original handler');
      }
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
      // after dispose we should be back to RESULT
      DCS22.dispose();
      await parseP(parser, INPUT);
      assert.deepEqual(callstack, RESULT, 'Should not call custom handler');
      evalStackSaves(parser.trackedStack, [
        [6, ParserStackType.CSI, 0],
        [15, ParserStackType.ESC, 0],
        [20, ParserStackType.ESC, 0],
        [27, ParserStackType.CSI, 0],
        [41, ParserStackType.DCS, 0],
        [54, ParserStackType.OSC, 0]
      ]);
      clearAccu();
    });
  });
});
