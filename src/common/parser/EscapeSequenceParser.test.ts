/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IParsingState, IParams, ParamsArray, IOscParser, IOscHandler, OscFallbackHandlerType, IFunctionIdentifier } from 'common/parser/Types';
import { EscapeSequenceParser, TransitionTable, VT500_TRANSITION_TABLE } from 'common/parser/EscapeSequenceParser';
import * as chai from 'chai';
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
  private _fallback: OscFallbackHandlerType = () => {};
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
  addHandler(ident: number, handler: IOscHandler): IDisposable {
    throw new Error('not implemented');
  }
  setHandler(ident: number, handler: IOscHandler): void {
    throw new Error('not implemented');
  }
  clearHandler(ident: number): void {
    throw new Error('not implemented');
  }
  setHandlerFallback(handler: OscFallbackHandlerType): void {
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
    this._oscParser = oscPutParser;
  }
  public identifier(id: IFunctionIdentifier): number {
    return this._identifier(id);
  }
}

// test object to collect parser actions and compare them with expected values
const testTerminal: any = {
  calls: [],
  clear: function (): void {
    this.calls = [];
  },
  compare: function (value: any): void {
    chai.expect(this.calls.slice()).eql(value); // weird bug w'o slicing here
  },
  print: function (data: Uint32Array, start: number, end: number): void {
    let s = '';
    for (let i = start; i < end; ++i) {
      s += stringFromCodePoint(data[i]);
    }
    this.calls.push(['print', s]);
  },
  actionOSC: function (s: string): void {
    this.calls.push(['osc', s]);
  },
  actionExecute: function (flag: string): void {
    this.calls.push(['exe', flag]);
  },
  actionCSI: function (collect: string, params: IParams, flag: string): void {
    this.calls.push(['csi', collect, params.toArray(), flag]);
  },
  actionESC: function (collect: string, flag: string): void {
    this.calls.push(['esc', collect, flag]);
  },
  actionDCSHook: function (params: IParams): void {
    this.calls.push(['dcs hook', params.toArray()]);
  },
  actionDCSPrint: function (s: string): void {
    this.calls.push(['dcs put', s]);
  },
  actionDCSUnhook: function (success: boolean): void {
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

describe('EscapeSequenceParser', function (): void {
  const parser = testParser;
  describe('Parser init and methods', function (): void {
    it('constructor', function (): void {
      let p = new TestEscapeSequenceParser();
      chai.expect(p.transitions).equal(VT500_TRANSITION_TABLE);
      p = new TestEscapeSequenceParser(VT500_TRANSITION_TABLE);
      chai.expect(p.transitions).equal(VT500_TRANSITION_TABLE);
      const tansitions: TransitionTable = new TransitionTable(10);
      p = new TestEscapeSequenceParser(tansitions);
      chai.expect(p.transitions).equal(tansitions);
    });
    it('inital states', function (): void {
      chai.expect(parser.initialState).equal(ParserState.GROUND);
      chai.expect(parser.currentState).equal(ParserState.GROUND);
      chai.expect(parser.osc).equal('');
      chai.expect(parser.params).eql([0]);
      chai.expect(parser.collect).equal('');
    });
    it('reset states', function (): void {
      parser.currentState = 124;
      parser.osc = '#';
      parser.params = [123];
      parser.collect = '#';

      parser.reset();
      chai.expect(parser.currentState).equal(ParserState.GROUND);
      chai.expect(parser.osc).equal('');
      chai.expect(parser.params).eql([0]);
      chai.expect(parser.collect).equal('');
    });
  });
  describe('state transitions and actions', function (): void {
    it('state GROUND execute action', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.GROUND;
        parse(parser, exes[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state GROUND print action', function (): void {
      parser.reset();
      testTerminal.clear();
      const printables = r(0x20, 0x7f); // NOTE: DEL excluded
      for (let i = 0; i < printables.length; ++i) {
        parser.currentState = ParserState.GROUND;
        parse(parser, printables[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['print', printables[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE --> GROUND with actions', function (): void {
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
          chai.expect(parser.currentState).equal(ParserState.GROUND);
          testTerminal.compare((state in exceptions ? exceptions[state][exes[i]] : 0) || [['exe', exes[i]]]);
          parser.reset();
          testTerminal.clear();
        }
        parse(parser, '\x9c');
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE --> ESCAPE with clear', function (): void {
      parser.reset();
      for (state in states) {
        parser.currentState = state;
        parser.params = [23];
        parser.collect = '#';
        parse(parser, '\x1b');
        chai.expect(parser.currentState).equal(ParserState.ESCAPE);
        chai.expect(parser.params).eql([0]);
        chai.expect(parser.collect).equal('');
        parser.reset();
      }
    });
    it('state ESCAPE execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.ESCAPE;
        parse(parser, exes[i]);
        chai.expect(parser.currentState).equal(ParserState.ESCAPE);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state ESCAPE ignore', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.ESCAPE;
      parse(parser, '\x7f');
      chai.expect(parser.currentState).equal(ParserState.ESCAPE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans ESCAPE --> GROUND with ecs_dispatch action', function (): void {
      parser.reset();
      testTerminal.clear();
      let dispatches = r(0x30, 0x50);
      dispatches = dispatches.concat(r(0x51, 0x58));
      dispatches = dispatches.concat(['\x59', '\x5a']); // excluded \x5c
      dispatches = dispatches.concat(r(0x60, 0x7f));
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.ESCAPE;
        parse(parser, dispatches[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['esc', '', dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ESCAPE --> ESCAPE_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.ESCAPE;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.ESCAPE_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state ESCAPE_INTERMEDIATE execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
        parse(parser, exes[i]);
        chai.expect(parser.currentState).equal(ParserState.ESCAPE_INTERMEDIATE);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state ESCAPE_INTERMEDIATE ignore', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
      parse(parser, '\x7f');
      chai.expect(parser.currentState).equal(ParserState.ESCAPE_INTERMEDIATE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('state ESCAPE_INTERMEDIATE collect action', function (): void {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.ESCAPE_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('trans ESCAPE_INTERMEDIATE --> GROUND with esc_dispatch action', function (): void {
      parser.reset();
      testTerminal.clear();
      const collect = r(0x30, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        // '\x5c' --> ESC + \ (7bit ST) parser does not expose this as it already got handled
        testTerminal.compare((collect[i] === '\x5c') ? [] : [['esc', '', collect[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE/ESCAPE --> CSI_ENTRY with clear', function (): void {
      parser.reset();
      // C0
      parser.currentState = ParserState.ESCAPE;
      parser.params = [123];
      parser.collect = '#';
      parse(parser, '[');
      chai.expect(parser.currentState).equal(ParserState.CSI_ENTRY);
      chai.expect(parser.params).eql([0]);
      chai.expect(parser.collect).equal('');
      parser.reset();
      // C1
      for (state in states) {
        parser.currentState = state;
        parser.params = [123];
        parser.collect = '#';
        parse(parser, '\x9b');
        chai.expect(parser.currentState).equal(ParserState.CSI_ENTRY);
        chai.expect(parser.params).eql([0]);
        chai.expect(parser.collect).equal('');
        parser.reset();
      }
    });
    it('state CSI_ENTRY execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, exes[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_ENTRY);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_ENTRY ignore', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_ENTRY;
      parse(parser, '\x7f');
      chai.expect(parser.currentState).equal(ParserState.CSI_ENTRY);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans CSI_ENTRY --> GROUND with csi_dispatch action', function (): void {
      parser.reset();
      const dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, dispatches[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['csi', '', [0], dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_ENTRY --> CSI_PARAM with param/collect actions', function (): void {
      parser.reset();
      const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      const collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, params[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
        chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.CSI_ENTRY;
      parse(parser, '\x3b');
      chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
      chai.expect(parser.params).eql([0, 0]);
      parser.reset();
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state CSI_PARAM execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, exes[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_PARAM param action', function (): void {
      parser.reset();
      const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, params[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
        chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.CSI_PARAM;
      parse(parser, '\x3b');
      chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
      chai.expect(parser.params).eql([0, 0]);
      parser.reset();
    });
    it('state CSI_PARAM ignore', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_PARAM;
      parse(parser, '\x7f');
      chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans CSI_PARAM --> GROUND with csi_dispatch action', function (): void {
      parser.reset();
      const dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parser.params = [0, 1];
        parse(parser, dispatches[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_ENTRY --> CSI_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('trans CSI_PARAM --> CSI_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state CSI_INTERMEDIATE execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parse(parser, exes[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_INTERMEDIATE collect', function (): void {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state CSI_INTERMEDIATE ignore', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_INTERMEDIATE;
      parse(parser, '\x7f');
      chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans CSI_INTERMEDIATE --> GROUND with csi_dispatch action', function (): void {
      parser.reset();
      const dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parser.params = [0, 1];
        parse(parser, dispatches[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_ENTRY --> CSI_PARAM for ":" (0x3a)', function (): void {
      parser.reset();
      parser.currentState = ParserState.CSI_ENTRY;
      parse(parser, '\x3a');
      chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
      parser.reset();
    });
    it('trans CSI_PARAM --> CSI_IGNORE', function (): void {
      parser.reset();
      const chars = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, '\x3b' + chars[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
        chai.expect(parser.params).eql([0, 0]);
        parser.reset();
      }
    });
    it('trans CSI_PARAM --> CSI_IGNORE', function (): void {
      parser.reset();
      const chars = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < chars.length; ++i) {
        chai.expect(parser.params).eql([0]);
        parser.currentState = ParserState.CSI_PARAM;
        parse(parser, '\x3b' + chars[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
        chai.expect(parser.params).eql([0, 0]);
        parser.reset();
      }
    });
    it('trans CSI_INTERMEDIATE --> CSI_IGNORE', function (): void {
      parser.reset();
      const chars = r(0x30, 0x40);
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parse(parser, chars[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
        chai.expect(parser.params).eql([0]);
        parser.reset();
      }
    });
    it('state CSI_IGNORE execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes = exes.concat(['\x19']);
      exes = exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_IGNORE;
        parse(parser, exes[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_IGNORE ignore', function (): void {
      parser.reset();
      testTerminal.clear();
      let ignored = r(0x20, 0x40);
      ignored = ignored.concat(['\x7f']);
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.CSI_IGNORE;
        parse(parser, ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_IGNORE --> GROUND', function (): void {
      parser.reset();
      const dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_IGNORE;
        parser.params = [0, 1];
        parse(parser, dispatches[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE/ESCAPE --> SOS_PM_APC_STRING', function (): void {
      parser.reset();
      // C0
      let initializers = ['\x58', '\x5e', '\x5f'];
      for (let i = 0; i < initializers.length; ++i) {
        parse(parser, '\x1b' + initializers[i]);
        chai.expect(parser.currentState).equal(ParserState.SOS_PM_APC_STRING);
        parser.reset();
      }
      // C1
      for (state in states) {
        parser.currentState = state;
        initializers = ['\x98', '\x9e', '\x9f'];
        for (let i = 0; i < initializers.length; ++i) {
          parse(parser, initializers[i]);
          chai.expect(parser.currentState).equal(ParserState.SOS_PM_APC_STRING);
          parser.reset();
        }
      }
    });
    it('state SOS_PM_APC_STRING ignore rules', function (): void {
      parser.reset();
      let ignored = r(0x00, 0x18);
      ignored = ignored.concat(['\x19']);
      ignored = ignored.concat(r(0x1c, 0x20));
      ignored = ignored.concat(r(0x20, 0x80));
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.SOS_PM_APC_STRING;
        parse(parser, ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.SOS_PM_APC_STRING);
        parser.reset();
      }
    });
    it('trans ANYWHERE/ESCAPE --> OSC_STRING', function (): void {
      parser.reset();
      // C0
      parse(parser, '\x1b]');
      chai.expect(parser.currentState).equal(ParserState.OSC_STRING);
      parser.reset();
      // C1
      for (state in states) {
        parser.currentState = state;
        parse(parser, '\x9d');
        chai.expect(parser.currentState).equal(ParserState.OSC_STRING);
        parser.reset();
      }
    });
    it('state OSC_STRING ignore rules', function (): void {
      parser.reset();
      const ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', /* '\x07', */ '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.OSC_STRING;
        parse(parser, ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.OSC_STRING);
        chai.expect(parser.osc).equal('');
        parser.reset();
      }
    });
    it('state OSC_STRING put action', function (): void {
      parser.reset();
      const puts = r(0x20, 0x80);
      for (let i = 0; i < puts.length; ++i) {
        parser.currentState = ParserState.OSC_STRING;
        parse(parser, puts[i]);
        chai.expect(parser.currentState).equal(ParserState.OSC_STRING);
        chai.expect(parser.osc).equal(puts[i]);
        parser.reset();
      }
    });
    it('state DCS_ENTRY', function (): void {
      parser.reset();
      // C0
      parse(parser, '\x1bP');
      chai.expect(parser.currentState).equal(ParserState.DCS_ENTRY);
      parser.reset();
      // C1
      for (state in states) {
        parser.currentState = state;
        parse(parser, '\x90');
        chai.expect(parser.currentState).equal(ParserState.DCS_ENTRY);
        parser.reset();
      }
    });
    it('state DCS_ENTRY ignore rules', function (): void {
      parser.reset();
      const ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_ENTRY);
        parser.reset();
      }
    });
    it('state DCS_ENTRY --> DCS_PARAM with param/collect actions', function (): void {
      parser.reset();
      const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      const collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, params[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
        chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.DCS_ENTRY;
      parse(parser, '\x3b');
      chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
      chai.expect(parser.params).eql([0, 0]);
      parser.reset();
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state DCS_PARAM ignore rules', function (): void {
      parser.reset();
      const ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
        parser.reset();
      }
    });
    it('state DCS_PARAM param action', function (): void {
      parser.reset();
      const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, params[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
        chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.DCS_PARAM;
      parse(parser, '\x3b');
      chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
      chai.expect(parser.params).eql([0, 0]);
      parser.reset();
    });
    it('trans DCS_ENTRY --> DCS_PARAM for ":" (0x3a)', function (): void {
      parser.reset();
      parser.currentState = ParserState.DCS_ENTRY;
      parse(parser, '\x3a');
      chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
      parser.reset();
    });
    it('trans DCS_PARAM --> DCS_IGNORE', function (): void {
      parser.reset();
      const chars = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, '\x3b' + chars[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
        chai.expect(parser.params).eql([0, 0]);
        parser.reset();
      }
    });
    it('trans DCS_INTERMEDIATE --> DCS_IGNORE', function (): void {
      parser.reset();
      const chars = r(0x30, 0x40);
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, chars[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
        parser.reset();
      }
    });
    it('state DCS_IGNORE ignore rules', function (): void {
      parser.reset();
      let ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      ignored = ignored.concat(r(0x20, 0x80));
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_IGNORE;
        parse(parser, ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
        parser.reset();
      }
    });
    it('trans DCS_ENTRY --> DCS_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('trans DCS_PARAM --> DCS_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state DCS_INTERMEDIATE ignore rules', function (): void {
      parser.reset();
      const ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_INTERMEDIATE);
        parser.reset();
      }
    });
    it('state DCS_INTERMEDIATE collect action', function (): void {
      parser.reset();
      const collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('trans DCS_INTERMEDIATE --> DCS_IGNORE', function (): void {
      parser.reset();
      const chars = r(0x30, 0x40);
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, '\x20' + chars[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
        chai.expect(parser.collect).equal('\x20');
        parser.reset();
      }
    });
    it('trans DCS_ENTRY --> DCS_PASSTHROUGH with hook', function (): void {
      parser.reset();
      testTerminal.clear();
      const collect = r(0x40, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs hook', [0]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans DCS_PARAM --> DCS_PASSTHROUGH with hook', function (): void {
      parser.reset();
      testTerminal.clear();
      const collect = r(0x40, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs hook', [0]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans DCS_INTERMEDIATE --> DCS_PASSTHROUGH with hook', function (): void {
      parser.reset();
      testTerminal.clear();
      const collect = r(0x40, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parse(parser, collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs hook', [0]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state DCS_PASSTHROUGH put action', function (): void {
      parser.reset();
      testTerminal.clear();
      let puts = r(0x00, 0x18);
      puts = puts.concat(['\x19']);
      puts = puts.concat(r(0x1c, 0x20));
      puts = puts.concat(r(0x20, 0x7f));
      for (let i = 0; i < puts.length; ++i) {
        parser.currentState = ParserState.DCS_PASSTHROUGH;
        parse(parser, puts[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs put', puts[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state DCS_PASSTHROUGH ignore', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.DCS_PASSTHROUGH;
      parse(parser, '\x7f');
      chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
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

  describe('escape sequence examples', function (): void {
    it('CSI with print and execute', function (): void {
      test('\x1b[<31;5mHello World! öäü€\nabc',
        [
          ['csi', '<', [31, 5], 'm'],
          ['print', 'Hello World! öäü€'],
          ['exe', '\n'],
          ['print', 'abc']
        ], null);
    });
    it('OSC', function (): void {
      test('\x1b]0;abc123€öäü\x07', [
        ['osc', '0;abc123€öäü, success: true']
      ], null);
    });
    it('single DCS', function (): void {
      test('\x1bP1;2;3+$aäbc;däe\x9c', [
        ['dcs hook', [1, 2, 3]],
        ['dcs put', 'äbc;däe'],
        ['dcs unhook', true]
      ], null);
    });
    it('multi DCS', function (): void {
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
    it('print + DCS(C1)', function (): void {
      test('abc\x901;2;3+$abc;de\x9c', [
        ['print', 'abc'],
        ['dcs hook', [1, 2, 3]],
        ['dcs put', 'bc;de'],
        ['dcs unhook', true]
      ], null);
    });
    it('print + PM(C1) + print', function (): void {
      test('abc\x98123tzf\x9cdefg', [
        ['print', 'abc'],
        ['print', 'defg']
      ], null);
    });
    it('print + OSC(C1) + print', function (): void {
      test('abc\x9d123;tzf\x9cdefg', [
        ['print', 'abc'],
        ['osc', '123;tzf, success: true'],
        ['print', 'defg']
      ], null);
    });
    it('error recovery', function (): void {
      test('\x1b[1€abcdefg\x9b<;c', [
        ['print', 'abcdefg'],
        ['csi', '<', [0, 0], 'c']
      ], null);
    });
    it('7bit ST should be swallowed', function (): void {
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
    it('colon notation in DCS params', function (): void {
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

  describe('coverage tests', function (): void {
    it('CSI_IGNORE error', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_IGNORE;
      parse(parser, '€öäü');
      chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('DCS_IGNORE error', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.DCS_IGNORE;
      parse(parser, '€öäü');
      chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('DCS_PASSTHROUGH error', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.DCS_PASSTHROUGH;
      parse(parser, '\x901;2;3+$a€öäü');
      chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
      testTerminal.compare([['dcs hook', [1, 2, 3]], ['dcs put', '€öäü']]);
      parser.reset();
      testTerminal.clear();
    });
    it('error else of if (code > 159)', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.GROUND;
      parse(parser, '\x9c');
      chai.expect(parser.currentState).equal(ParserState.GROUND);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
  });

  describe('set/clear handler', function (): void {
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
    beforeEach(function (): void {
      parser2 = new TestEscapeSequenceParser();
      clearAccu();
    });
    it('print handler', function (): void {
      parser2.setPrintHandler(function (data: Uint32Array, start: number, end: number): void {
        for (let i = start; i < end; ++i) {
          print += stringFromCodePoint(data[i]);
        }
      });
      parse(parser2, INPUT);
      chai.expect(print).equal('hello world!$>');
      parser2.clearPrintHandler();
      parser2.clearPrintHandler(); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      chai.expect(print).equal('');
    });
    it('ESC handler', function (): void {
      parser2.setEscHandler({intermediates: '%', final: 'G'}, function (): void {
        esc.push('%G');
      });
      parser2.setEscHandler({final: 'E'}, function (): void {
        esc.push('E');
      });
      parse(parser2, INPUT);
      chai.expect(esc).eql(['%G', 'E']);
      parser2.clearEscHandler({intermediates: '%', final: 'G'});
      parser2.clearEscHandler({intermediates: '%', final: 'G'}); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      chai.expect(esc).eql(['E']);
      parser2.clearEscHandler({final: 'E'});
      clearAccu();
      parse(parser2, INPUT);
      chai.expect(esc).eql([]);
    });
    describe('ESC custom handlers', () => {
      it('prevent fallback', () => {
        parser2.setEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('default - %G'); });
        parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('custom - %G'); return true; });
        parse(parser2, INPUT);
        chai.expect(esc).eql(['custom - %G']);
      });
      it('allow fallback', () => {
        parser2.setEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('default - %G'); });
        parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('custom - %G'); return false; });
        parse(parser2, INPUT);
        chai.expect(esc).eql(['custom - %G', 'default - %G']);
      });
      it('Multiple custom handlers fallback once', () => {
        parser2.setEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('default - %G'); });
        parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('custom - %G'); return true; });
        parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('custom2 - %G'); return false; });
        parse(parser2, INPUT);
        chai.expect(esc).eql(['custom2 - %G', 'custom - %G']);
      });
      it('Multiple custom handlers no fallback', () => {
        parser2.setEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('default - %G'); });
        parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('custom - %G'); return true; });
        parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('custom2 - %G'); return true; });
        parse(parser2, INPUT);
        chai.expect(esc).eql(['custom2 - %G']);
      });
      it('Execution order should go from latest handler down to the original', () => {
        const order: number[] = [];
        parser2.setEscHandler({intermediates: '%', final: 'G'}, () => { order.push(1); });
        parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { order.push(2); return false; });
        parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { order.push(3); return false; });
        parse(parser2, '\x1b%G');
        chai.expect(order).eql([3, 2, 1]);
      });
      it('Dispose should work', () => {
        parser2.setEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('default - %G'); });
        const dispo = parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('custom - %G'); return true; });
        dispo.dispose();
        parse(parser2, INPUT);
        chai.expect(esc).eql(['default - %G']);
      });
      it('Should not corrupt the parser when dispose is called twice', () => {
        parser2.setEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('default - %G'); });
        const dispo = parser2.addEscHandler({intermediates: '%', final: 'G'}, () => { esc.push('custom - %G'); return true; });
        dispo.dispose();
        dispo.dispose();
        parse(parser2, INPUT);
        chai.expect(esc).eql(['default - %G']);
      });
    });
    it('CSI handler', function (): void {
      parser2.setCsiHandler({final: 'm'}, function (params: IParams): void {
        csi.push(['m', params.toArray(), '']);
      });
      parse(parser2, INPUT);
      chai.expect(csi).eql([['m', [1, 31], ''], ['m', [0], '']]);
      parser2.clearCsiHandler({final: 'm'});
      parser2.clearCsiHandler({final: 'm'}); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      chai.expect(csi).eql([]);
    });
    describe('CSI custom handlers', () => {
      it('Prevent fallback', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        parser2.setCsiHandler({final: 'm'}, params => { csi.push(['m', params.toArray(), '']); });
        parser2.addCsiHandler({final: 'm'}, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        parse(parser2, INPUT);
        chai.expect(csi).eql([], 'Should not fallback to original handler');
        chai.expect(csiCustom).eql([['m', [1, 31], ''], ['m', [0], '']]);
      });
      it('Allow fallback', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        parser2.setCsiHandler({final: 'm'}, params => { csi.push(['m', params.toArray(), '']); });
        parser2.addCsiHandler({final: 'm'}, params => { csiCustom.push(['m', params.toArray(), '']); return false; });
        parse(parser2, INPUT);
        chai.expect(csi).eql([['m', [1, 31], ''], ['m', [0], '']], 'Should fallback to original handler');
        chai.expect(csiCustom).eql([['m', [1, 31], ''], ['m', [0], '']]);
      });
      it('Multiple custom handlers fallback once', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        const csiCustom2: [string, ParamsArray, string][] = [];
        parser2.setCsiHandler({final: 'm'}, params => { csi.push(['m', params.toArray(), '']); });
        parser2.addCsiHandler({final: 'm'}, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        parser2.addCsiHandler({final: 'm'}, params => { csiCustom2.push(['m', params.toArray(), '']); return false; });
        parse(parser2, INPUT);
        chai.expect(csi).eql([], 'Should not fallback to original handler');
        chai.expect(csiCustom).eql([['m', [1, 31], ''], ['m', [0], '']]);
        chai.expect(csiCustom2).eql([['m', [1, 31], ''], ['m', [0], '']]);
      });
      it('Multiple custom handlers no fallback', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        const csiCustom2: [string, ParamsArray, string][] = [];
        parser2.setCsiHandler({final: 'm'}, params => { csi.push(['m', params.toArray(), '']); });
        parser2.addCsiHandler({final: 'm'}, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        parser2.addCsiHandler({final: 'm'}, params => { csiCustom2.push(['m', params.toArray(), '']); return true; });
        parse(parser2, INPUT);
        chai.expect(csi).eql([], 'Should not fallback to original handler');
        chai.expect(csiCustom).eql([], 'Should not fallback once');
        chai.expect(csiCustom2).eql([['m', [1, 31], ''], ['m', [0], '']]);
      });
      it('Execution order should go from latest handler down to the original', () => {
        const order: number[] = [];
        parser2.setCsiHandler({final: 'm'}, () => { order.push(1); });
        parser2.addCsiHandler({final: 'm'}, () => { order.push(2); return false; });
        parser2.addCsiHandler({final: 'm'}, () => { order.push(3); return false; });
        parse(parser2, '\x1b[0m');
        chai.expect(order).eql([3, 2, 1]);
      });
      it('Dispose should work', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        parser2.setCsiHandler({final: 'm'}, params => { csi.push(['m', params.toArray(), '']); });
        const customHandler = parser2.addCsiHandler({final: 'm'}, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        customHandler.dispose();
        parse(parser2, INPUT);
        chai.expect(csi).eql([['m', [1, 31], ''], ['m', [0], '']]);
        chai.expect(csiCustom).eql([], 'Should not use custom handler as it was disposed');
      });
      it('Should not corrupt the parser when dispose is called twice', () => {
        const csiCustom: [string, ParamsArray, string][] = [];
        parser2.setCsiHandler({final: 'm'}, params => { csi.push(['m', params.toArray(), '']); });
        const customHandler = parser2.addCsiHandler({final: 'm'}, params => { csiCustom.push(['m', params.toArray(), '']); return true; });
        customHandler.dispose();
        customHandler.dispose();
        parse(parser2, INPUT);
        chai.expect(csi).eql([['m', [1, 31], ''], ['m', [0], '']]);
        chai.expect(csiCustom).eql([], 'Should not use custom handler as it was disposed');
      });
    });
    it('EXECUTE handler', function (): void {
      parser2.setExecuteHandler('\n', function (): void {
        exe.push('\n');
      });
      parser2.setExecuteHandler('\r', function (): void {
        exe.push('\r');
      });
      parse(parser2, INPUT);
      chai.expect(exe).eql(['\r', '\n']);
      parser2.clearExecuteHandler('\r');
      parser2.clearExecuteHandler('\r'); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      chai.expect(exe).eql(['\n']);
    });
    it('OSC handler', function (): void {
      parser2.setOscHandler(1, new OscHandler(function (data: string): void {
        osc.push([1, data]);
      }));
      parse(parser2, INPUT);
      chai.expect(osc).eql([[1, 'foo=bar']]);
      parser2.clearOscHandler(1);
      parser2.clearOscHandler(1); // should not throw
      clearAccu();
      parse(parser2, INPUT);
      chai.expect(osc).eql([]);
    });
    describe('OSC custom handlers', () => {
      it('Prevent fallback', () => {
        const oscCustom: [number, string][] = [];
        parser2.setOscHandler(1, new OscHandler(data => osc.push([1, data])));
        parser2.addOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        parse(parser2, INPUT);
        chai.expect(osc).eql([], 'Should not fallback to original handler');
        chai.expect(oscCustom).eql([[1, 'foo=bar']]);
      });
      it('Allow fallback', () => {
        const oscCustom: [number, string][] = [];
        parser2.setOscHandler(1, new OscHandler(data => osc.push([1, data])));
        parser2.addOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return false; }));
        parse(parser2, INPUT);
        chai.expect(osc).eql([[1, 'foo=bar']], 'Should fallback to original handler');
        chai.expect(oscCustom).eql([[1, 'foo=bar']]);
      });
      it('Multiple custom handlers fallback once', () => {
        const oscCustom: [number, string][] = [];
        const oscCustom2: [number, string][] = [];
        parser2.setOscHandler(1, new OscHandler(data => osc.push([1, data])));
        parser2.addOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        parser2.addOscHandler(1, new OscHandler(data => { oscCustom2.push([1, data]); return false; }));
        parse(parser2, INPUT);
        chai.expect(osc).eql([], 'Should not fallback to original handler');
        chai.expect(oscCustom).eql([[1, 'foo=bar']]);
        chai.expect(oscCustom2).eql([[1, 'foo=bar']]);
      });
      it('Multiple custom handlers no fallback', () => {
        const oscCustom: [number, string][] = [];
        const oscCustom2: [number, string][] = [];
        parser2.setOscHandler(1, new OscHandler(data => osc.push([1, data])));
        parser2.addOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        parser2.addOscHandler(1, new OscHandler(data => { oscCustom2.push([1, data]); return true; }));
        parse(parser2, INPUT);
        chai.expect(osc).eql([], 'Should not fallback to original handler');
        chai.expect(oscCustom).eql([], 'Should not fallback once');
        chai.expect(oscCustom2).eql([[1, 'foo=bar']]);
      });
      it('Execution order should go from latest handler down to the original', () => {
        const order: number[] = [];
        parser2.setOscHandler(1, new OscHandler(() => order.push(1)));
        parser2.addOscHandler(1, new OscHandler(() => { order.push(2); return false; }));
        parser2.addOscHandler(1, new OscHandler(() => { order.push(3); return false; }));
        parse(parser2, '\x1b]1;foo=bar\x1b\\');
        chai.expect(order).eql([3, 2, 1]);
      });
      it('Dispose should work', () => {
        const oscCustom: [number, string][] = [];
        parser2.setOscHandler(1, new OscHandler(data => osc.push([1, data])));
        const customHandler = parser2.addOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        customHandler.dispose();
        parse(parser2, INPUT);
        chai.expect(osc).eql([[1, 'foo=bar']]);
        chai.expect(oscCustom).eql([], 'Should not use custom handler as it was disposed');
      });
      it('Should not corrupt the parser when dispose is called twice', () => {
        const oscCustom: [number, string][] = [];
        parser2.setOscHandler(1, new OscHandler(data => osc.push([1, data])));
        const customHandler = parser2.addOscHandler(1, new OscHandler(data => { oscCustom.push([1, data]); return true; }));
        customHandler.dispose();
        customHandler.dispose();
        parse(parser2, INPUT);
        chai.expect(osc).eql([[1, 'foo=bar']]);
        chai.expect(oscCustom).eql([], 'Should not use custom handler as it was disposed');
      });
    });
    it('DCS handler', function (): void {
      parser2.setDcsHandler({intermediates: '+', final: 'p'}, {
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
        unhook: function (): void {
          dcs.push(['unhook']);
        }
      });
      parse(parser2, '\x1bP1;2;3+pabc');
      parse(parser2, ';de\x9c');
      chai.expect(dcs).eql([
        ['hook', '', [1, 2, 3], 0],
        ['put', 'abc'], ['put', ';de'],
        ['unhook']
      ]);
      parser2.clearDcsHandler({intermediates: '+', final: 'p'});
      parser2.clearDcsHandler({intermediates: '+', final: 'p'}); // should not throw
      clearAccu();
      parse(parser2, '\x1bP1;2;3+pabc');
      parse(parser2, ';de\x9c');
      chai.expect(dcs).eql([]);
    });
    describe('DCS custom handlers', () => {
      const DCS_INPUT = '\x1bP1;2;3+pabc\x1b\\';
      it('Prevent fallback', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.setDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => dcsCustom.push(['A', params.toArray(), data])));
        parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        parse(parser2, DCS_INPUT);
        chai.expect(dcsCustom).eql([['B', [1, 2, 3], 'abc']]);
      });
      it('Allow fallback', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.setDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => dcsCustom.push(['A', params.toArray(), data])));
        parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return false; }));
        parse(parser2, DCS_INPUT);
        chai.expect(dcsCustom).eql([['B', [1, 2, 3], 'abc'], ['A', [1, 2, 3], 'abc']]);
      });
      it('Multiple custom handlers fallback once', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.setDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => dcsCustom.push(['A', params.toArray(), data])));
        parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => { dcsCustom.push(['C', params.toArray(), data]); return false; }));
        parse(parser2, DCS_INPUT);
        chai.expect(dcsCustom).eql([['C', [1, 2, 3], 'abc'], ['B', [1, 2, 3], 'abc']]);
      });
      it('Multiple custom handlers no fallback', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.setDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => dcsCustom.push(['A', params.toArray(), data])));
        parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => { dcsCustom.push(['C', params.toArray(), data]); return true; }));
        parse(parser2, DCS_INPUT);
        chai.expect(dcsCustom).eql([['C', [1, 2, 3], 'abc']]);
      });
      it('Execution order should go from latest handler down to the original', () => {
        const order: number[] = [];
        parser2.setDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler(() => order.push(1)));
        parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler(() => { order.push(2); return false; }));
        parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler(() => { order.push(3); return false; }));
        parse(parser2, DCS_INPUT);
        chai.expect(order).eql([3, 2, 1]);
      });
      it('Dispose should work', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.setDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => dcsCustom.push(['A', params.toArray(), data])));
        const dispo = parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        dispo.dispose();
        parse(parser2, DCS_INPUT);
        chai.expect(dcsCustom).eql([['A', [1, 2, 3], 'abc']]);
      });
      it('Should not corrupt the parser when dispose is called twice', () => {
        const dcsCustom: [string, (number | number[])[], string][] = [];
        parser2.setDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => dcsCustom.push(['A', params.toArray(), data])));
        const dispo = parser2.addDcsHandler({intermediates: '+', final: 'p'}, new DcsHandler((data, params) => { dcsCustom.push(['B', params.toArray(), data]); return true; }));
        dispo.dispose();
        dispo.dispose();
        parse(parser2, DCS_INPUT);
        chai.expect(dcsCustom).eql([['A', [1, 2, 3], 'abc']]);
      });
    });
    it('ERROR handler', function (): void {
      let errorState: IParsingState | null = null;
      parser2.setErrorHandler(function (state: IParsingState): IParsingState {
        errorState = state;
        return state;
      });
      parse(parser2, '\x1b[1;2;€;3m'); // faulty escape sequence
      chai.expect(errorState).eql({
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
      chai.expect(errorState).eql(null);
    });
  });
  describe('function identifiers', () => {
    describe('registration limits', () => {
      it('prefix range 0x3c .. 0x3f, one byte', () => {
        for (let i = 0x3c; i <= 0x3f; ++i) {
          const c = String.fromCharCode(i);
          chai.expect(parser.identToString(parser.identifier({prefix: c, final: 'z'}))).eql(c + 'z');
        }
        chai.assert.throws(() => { parser.identifier({prefix: '\x3b', final: 'z'}); }, 'prefix must be in range 0x3c .. 0x3f');
        chai.assert.throws(() => { parser.identifier({prefix: '\x40', final: 'z'}); }, 'prefix must be in range 0x3c .. 0x3f');
        chai.assert.throws(() => { parser.identifier({prefix: '??', final: 'z'}); }, 'only one byte as prefix supported');
      });
      it('intermediates range 0x20 .. 0x2f, up to two bytes', () => {
        for (let i = 0x20; i <= 0x2f; ++i) {
          const c = String.fromCharCode(i);
          chai.expect(parser.identToString(parser.identifier({intermediates: c + c, final: 'z'}))).eql(c + c + 'z');
        }
        chai.assert.throws(() => { parser.identifier({intermediates: '\x1f', final: 'z'}); }, 'intermediate must be in range 0x20 .. 0x2f');
        chai.assert.throws(() => { parser.identifier({intermediates: '\x30', final: 'z'}); }, 'intermediate must be in range 0x20 .. 0x2f');
        chai.assert.throws(() => { parser.identifier({intermediates: '!!!', final: 'z'}); }, 'only two bytes as intermediates are supported');
      });
      it('final CSI/DCS range 0x40 .. 0x7e (default), one byte', () => {
        for (let i = 0x40; i <= 0x7e; ++i) {
          const c = String.fromCharCode(i);
          chai.expect(parser.identToString(parser.identifier({final: c}))).eql(c);
        }
        chai.assert.throws(() => { parser.identifier({final: '\x3f'}); }, 'final must be in range 64 .. 126');
        chai.assert.throws(() => { parser.identifier({final: '\x7f'}); }, 'final must be in range 64 .. 126');
        chai.assert.throws(() => { parser.identifier({final: 'zz'}); }, 'final must be a single byte');
      });
      it('final ESC range 0x30 .. 0x7e, one byte', () => {
        for (let i = 0x30; i <= 0x7e; ++i) {
          const c = String.fromCharCode(i);
          let handler: IDisposable | undefined;
          chai.assert.doesNotThrow(() => { handler = parser.addEscHandler({final: c}, () => {}); }, 'final must be in range 48 .. 126');
          if (handler) handler.dispose();
        }
        chai.assert.throws(() => { parser.addEscHandler({final: '\x2f'}, () => {}); }, 'final must be in range 48 .. 126');
        chai.assert.throws(() => { parser.addEscHandler({final: '\x7f'}, () => {}); }, 'final must be in range 48 .. 126');
      });
      it('id calculation - should stacking prefix -> intermediate -> final', () => {
        chai.expect(parser.identToString(parser.identifier({final: 'z'}))).eql('z');
        chai.expect(parser.identToString(parser.identifier({prefix: '?', final: 'z'}))).eql('?z');
        chai.expect(parser.identToString(parser.identifier({intermediates: '!', final: 'z'}))).eql('!z');
        chai.expect(parser.identToString(parser.identifier({prefix: '?', intermediates: '!', final: 'z'}))).eql('?!z');
        chai.expect(parser.identToString(parser.identifier({prefix: '?', intermediates: '!!', final: 'z'}))).eql('?!!z');
      });
    });
    describe('identifier invocation', () => {
      it('ESC', () => {
        const callstack: string[] = [];
        const h1 = parser.addEscHandler({final: 'z'}, () => { callstack.push('z'); });
        const h2 = parser.addEscHandler({intermediates: '!', final: 'z'}, () => { callstack.push('!z'); });
        const h3 = parser.addEscHandler({intermediates: '!!', final: 'z'}, () => { callstack.push('!!z'); });
        parse(parser, '\x1bz\x1b!z\x1b!!z');
        h1.dispose();
        h2.dispose();
        h3.dispose();
        parse(parser, '\x1bz\x1b!z\x1b!!z');
        chai.expect(callstack).eql(['z', '!z', '!!z']);
      });
      it('CSI', () => {
        const callstack: any[] = [];
        const h1 = parser.addCsiHandler({final: 'z'}, params => { callstack.push(['z', params.toArray()]); });
        const h2 = parser.addCsiHandler({intermediates: '!', final: 'z'}, params => { callstack.push(['!z', params.toArray()]); });
        const h3 = parser.addCsiHandler({intermediates: '!!', final: 'z'}, params => { callstack.push(['!!z', params.toArray()]); });
        const h4 = parser.addCsiHandler({prefix: '?', final: 'z'}, params => { callstack.push(['?z', params.toArray()]); });
        const h5 = parser.addCsiHandler({prefix: '?', intermediates: '!', final: 'z'}, params => { callstack.push(['?!z', params.toArray()]); });
        const h6 = parser.addCsiHandler({prefix: '?', intermediates: '!!', final: 'z'}, params => { callstack.push(['?!!z', params.toArray()]); });
        parse(parser, '\x1b[1;z\x1b[1;!z\x1b[1;!!z\x1b[?1;z\x1b[?1;!z\x1b[?1;!!z');
        h1.dispose();
        h2.dispose();
        h3.dispose();
        h4.dispose();
        h5.dispose();
        h6.dispose();
        parse(parser, '\x1b[1;z\x1b[1;!z\x1b[1;!!z\x1b[?1;z\x1b[?1;!z\x1b[?1;!!z');
        chai.expect(callstack).eql([['z', [1, 0]], ['!z', [1, 0]], ['!!z', [1, 0]], ['?z', [1, 0]], ['?!z', [1, 0]], ['?!!z', [1, 0]]]);
      });
      it('DCS', () => {
        const callstack: any[] = [];
        const h1 = parser.addDcsHandler({final: 'z'}, new DcsHandler((data, params) => { callstack.push(['z', params.toArray(), data]); }));
        const h2 = parser.addDcsHandler({intermediates: '!', final: 'z'}, new DcsHandler((data, params) => { callstack.push(['!z', params.toArray(), data]); }));
        const h3 = parser.addDcsHandler({intermediates: '!!', final: 'z'}, new DcsHandler((data, params) => { callstack.push(['!!z', params.toArray(), data]); }));
        const h4 = parser.addDcsHandler({prefix: '?', final: 'z'}, new DcsHandler((data, params) => { callstack.push(['?z', params.toArray(), data]); }));
        const h5 = parser.addDcsHandler({prefix: '?', intermediates: '!', final: 'z'}, new DcsHandler((data, params) => { callstack.push(['?!z', params.toArray(), data]); }));
        const h6 = parser.addDcsHandler({prefix: '?', intermediates: '!!', final: 'z'}, new DcsHandler((data, params) => { callstack.push(['?!!z', params.toArray(), data]); }));
        parse(parser, '\x1bP1;zAB\x1b\\\x1bP1;!zAB\x1b\\\x1bP1;!!zAB\x1b\\\x1bP?1;zAB\x1b\\\x1bP?1;!zAB\x1b\\\x1bP?1;!!zAB\x1b\\');
        h1.dispose();
        h2.dispose();
        h3.dispose();
        h4.dispose();
        h5.dispose();
        h6.dispose();
        parse(parser, '\x1bP1;zAB\x1b\\\x1bP1;!zAB\x1b\\\x1bP1;!!zAB\x1b\\\x1bP?1;zAB\x1b\\\x1bP?1;!zAB\x1b\\\x1bP?1;!!zAB\x1b\\');
        chai.expect(callstack).eql([
          ['z', [1, 0], 'AB'],
          ['!z', [1, 0], 'AB'],
          ['!!z', [1, 0], 'AB'],
          ['?z', [1, 0], 'AB'],
          ['?!z', [1, 0], 'AB'],
          ['?!!z', [1, 0], 'AB']
        ]);
      });
    });
  });
  // TODO: error conditions and error recovery (not implemented yet in parser)
});
