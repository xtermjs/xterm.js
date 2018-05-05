/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ParserState, IDcsHandler, IParsingState } from './Types';
import { EscapeSequenceParser, TransitionTable, VT500_TRANSITION_TABLE } from './EscapeSequenceParser';
import * as chai from 'chai';

function r(a: number, b: number): string[] {
  let c = b - a;
  let arr = new Array(c);
  while (c--) {
    arr[c] = String.fromCharCode(--b);
  }
  return arr;
}

class TestEscapeSequenceParser extends EscapeSequenceParser {
  public get osc(): string {
    return this._osc;
  }
  public set osc(value: string) {
    this._osc = value;
  }
  public get params(): number[] {
    return this._params;
  }
  public set params(value: number[]) {
    this._params = value;
  }
  public get collect(): string {
    return this._collect;
  }
  public set collect(value: string) {
    this._collect = value;
  }
  public mockActiveDcsHandler(): void {
    this._activeDcsHandler = this._dcsHandlerFb;
  }
}

let testTerminal: any = {
  calls: [],
  clear: function (): void {
    this.calls = [];
  },
  compare: function (value: any): void {
    chai.expect(this.calls.slice()).eql(value); // weird bug w'o slicing here
  },
  print: function (data: string, start: number, end: number): void {
    this.calls.push(['print', data.substring(start, end)]);
  },
  actionOSC: function (s: string): void {
    this.calls.push(['osc', s]);
  },
  actionExecute: function (flag: string): void {
    this.calls.push(['exe', flag]);
  },
  actionCSI: function (collect: string, params: number[], flag: string): void {
    this.calls.push(['csi', collect, params, flag]);
  },
  actionESC: function (collect: string, flag: string): void {
    this.calls.push(['esc', collect, flag]);
  },
  actionDCSHook: function (collect: string, params: number[], flag: string): void {
    this.calls.push(['dcs hook', collect, params, flag]);
  },
  actionDCSPrint: function (data: string, start: number, end: number): void {
    this.calls.push(['dcs put', data.substring(start, end)]);
  },
  actionDCSUnhook: function (): void {
    this.calls.push(['dcs unhook']);
  }
};

class DcsTest implements IDcsHandler {
  hook(collect: string, params: number[], flag: number): void {
    testTerminal.actionDCSHook(collect, params, String.fromCharCode(flag));
  }
  put(data: string, start: number, end: number): void {
    testTerminal.actionDCSPrint(data, start, end);
  }
  unhook(): void {
    testTerminal.actionDCSUnhook();
  }
}

let states: number[] = [
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

let parser = new TestEscapeSequenceParser();
parser.setPrintHandler(testTerminal.print.bind(testTerminal));
parser.setCsiHandlerFallback((...params: any[]) => {
  testTerminal.actionCSI(params[0], params[1], String.fromCharCode(params[2]));
});
parser.setEscHandlerFallback((...params: any[]) => {
  testTerminal.actionESC(params[0], String.fromCharCode(params[1]));
});
parser.setExecuteHandlerFallback((...params: any[]) => {
  testTerminal.actionExecute(String.fromCharCode(params[0]));
});
parser.setOscHandlerFallback((...params: any[]) => {
  if (params[0] === -1) testTerminal.actionOSC(params[1]);  // handle error condition silently
  else testTerminal.actionOSC(params[0] + ';' + params[1]);
});
parser.setDcsHandlerFallback(new DcsTest());


describe('EscapeSequenceParser', function (): void {
  describe('Parser init and methods', function (): void {
    it('constructor', function(): void {
      let p: EscapeSequenceParser = new EscapeSequenceParser();
      chai.expect(p.transitions).equal(VT500_TRANSITION_TABLE);
      p = new EscapeSequenceParser(VT500_TRANSITION_TABLE);
      chai.expect(p.transitions).equal(VT500_TRANSITION_TABLE);
      let tansitions: TransitionTable = new TransitionTable(10);
      p = new EscapeSequenceParser(tansitions);
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
      exes.concat(['\x19']);
      exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.GROUND;
        parser.parse(exes[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state GROUND print action', function (): void {
      parser.reset();
      testTerminal.clear();
      let printables = r(0x20, 0x7f); // NOTE: DEL excluded
      for (let i = 0; i < printables.length; ++i) {
        parser.currentState = ParserState.GROUND;
        parser.parse(printables[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['print', printables[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE --> GROUND with actions', function (): void {
      let exes = [
        '\x18', '\x1a',
        '\x80', '\x81', '\x82', '\x83', '\x84', '\x85', '\x86', '\x87', '\x88',
        '\x89', '\x8a', '\x8b', '\x8c', '\x8d', '\x8e', '\x8f',
        '\x91', '\x92', '\x93', '\x94', '\x95', '\x96', '\x97', '\x99', '\x9a'
      ];
      let exceptions = {
        8: { '\x18': [], '\x1a': [] } // simply abort osc state
      };
      parser.reset();
      testTerminal.clear();
      for (state in states) {
        for (let i = 0; i < exes.length; ++i) {
          parser.currentState = state;
          parser.parse(exes[i]);
          chai.expect(parser.currentState).equal(ParserState.GROUND);
          testTerminal.compare(((exceptions[state]) ? exceptions[state][exes[i]] : 0) || [['exe', exes[i]]]);
          parser.reset();
          testTerminal.clear();
        }
        parser.parse('\x9c');
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
        parser.osc = '#';
        parser.params = [23];
        parser.collect = '#';
        parser.parse('\x1b');
        chai.expect(parser.currentState).equal(ParserState.ESCAPE);
        chai.expect(parser.osc).equal('');
        chai.expect(parser.params).eql([0]);
        chai.expect(parser.collect).equal('');
        parser.reset();
      }
    });
    it('state ESCAPE execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes.concat(['\x19']);
      exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.ESCAPE;
        parser.parse(exes[i]);
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
      parser.parse('\x7f');
      chai.expect(parser.currentState).equal(ParserState.ESCAPE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans ESCAPE --> GROUND with ecs_dispatch action', function (): void {
      parser.reset();
      testTerminal.clear();
      let dispatches = r(0x30, 0x50);
      dispatches.concat(r(0x51, 0x58));
      dispatches.concat(['\x59', '\x5a', '\x5c']);
      dispatches.concat(r(0x60, 0x7f));
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.ESCAPE;
        parser.parse(dispatches[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['esc', '', dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ESCAPE --> ESCAPE_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      let collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.ESCAPE;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.ESCAPE_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state ESCAPE_INTERMEDIATE execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes.concat(['\x19']);
      exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
        parser.parse(exes[i]);
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
      parser.parse('\x7f');
      chai.expect(parser.currentState).equal(ParserState.ESCAPE_INTERMEDIATE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('state ESCAPE_INTERMEDIATE collect action', function (): void {
      parser.reset();
      let collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.ESCAPE_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('trans ESCAPE_INTERMEDIATE --> GROUND with esc_dispatch action', function (): void {
      parser.reset();
      testTerminal.clear();
      let collect = r(0x30, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['esc', '', collect[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans ANYWHERE/ESCAPE --> CSI_ENTRY with clear', function (): void {
      parser.reset();
      // C0
      parser.currentState = ParserState.ESCAPE;
      parser.osc = '#';
      parser.params = [123];
      parser.collect = '#';
      parser.parse('[');
      chai.expect(parser.currentState).equal(ParserState.CSI_ENTRY);
      chai.expect(parser.osc).equal('');
      chai.expect(parser.params).eql([0]);
      chai.expect(parser.collect).equal('');
      parser.reset();
      // C1
      for (state in states) {
        parser.currentState = state;
        parser.osc = '#';
        parser.params = [123];
        parser.collect = '#';
        parser.parse('\x9b');
        chai.expect(parser.currentState).equal(ParserState.CSI_ENTRY);
        chai.expect(parser.osc).equal('');
        chai.expect(parser.params).eql([0]);
        chai.expect(parser.collect).equal('');
        parser.reset();
      }
    });
    it('state CSI_ENTRY execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes.concat(['\x19']);
      exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parser.parse(exes[i]);
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
      parser.parse('\x7f');
      chai.expect(parser.currentState).equal(ParserState.CSI_ENTRY);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans CSI_ENTRY --> GROUND with csi_dispatch action', function (): void {
      parser.reset();
      let dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parser.parse(dispatches[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['csi', '', [0], dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_ENTRY --> CSI_PARAM with param/collect actions', function (): void {
      parser.reset();
      let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      let collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parser.parse(params[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
        chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.CSI_ENTRY;
      parser.parse('\x3b');
      chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
      chai.expect(parser.params).eql([0, 0]);
      parser.reset();
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state CSI_PARAM execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes.concat(['\x19']);
      exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parser.parse(exes[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_PARAM param action', function (): void {
      parser.reset();
      let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parser.parse(params[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
        chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.CSI_PARAM;
      parser.parse('\x3b');
      chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
      chai.expect(parser.params).eql([0, 0]);
      parser.reset();
    });
    it('state CSI_PARAM ignore', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_PARAM;
      parser.parse('\x7f');
      chai.expect(parser.currentState).equal(ParserState.CSI_PARAM);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans CSI_PARAM --> GROUND with csi_dispatch action', function (): void {
      parser.reset();
      let dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parser.params = [0, 1];
        parser.parse(dispatches[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_ENTRY --> CSI_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      let collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_ENTRY;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('trans CSI_PARAM --> CSI_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      let collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state CSI_INTERMEDIATE execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes.concat(['\x19']);
      exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parser.parse(exes[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
        testTerminal.compare([['exe', exes[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state CSI_INTERMEDIATE collect', function (): void {
      parser.reset();
      let collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state CSI_INTERMEDIATE ignore', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_INTERMEDIATE;
      parser.parse('\x7f');
      chai.expect(parser.currentState).equal(ParserState.CSI_INTERMEDIATE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('trans CSI_INTERMEDIATE --> GROUND with csi_dispatch action', function (): void {
      parser.reset();
      let dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parser.params = [0, 1];
        parser.parse(dispatches[i]);
        chai.expect(parser.currentState).equal(ParserState.GROUND);
        testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_ENTRY --> CSI_IGNORE', function (): void {
      parser.reset();
      parser.currentState = ParserState.CSI_ENTRY;
      parser.parse('\x3a');
      chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
      parser.reset();
    });
    it('trans CSI_PARAM --> CSI_IGNORE', function (): void {
      parser.reset();
      let chars = ['\x3a', '\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.CSI_PARAM;
        parser.parse('\x3b' + chars[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
        chai.expect(parser.params).eql([0, 0]);
        parser.reset();
      }
    });
    it('trans CSI_INTERMEDIATE --> CSI_IGNORE', function (): void {
      parser.reset();
      let chars = r(0x30, 0x40);
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.CSI_INTERMEDIATE;
        parser.parse(chars[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
        chai.expect(parser.params).eql([0]);
        parser.reset();
      }
    });
    it('state CSI_IGNORE execute rules', function (): void {
      parser.reset();
      testTerminal.clear();
      let exes = r(0x00, 0x18);
      exes.concat(['\x19']);
      exes.concat(r(0x1c, 0x20));
      for (let i = 0; i < exes.length; ++i) {
        parser.currentState = ParserState.CSI_IGNORE;
        parser.parse(exes[i]);
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
      ignored.concat(['\x7f']);
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.CSI_IGNORE;
        parser.parse(ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans CSI_IGNORE --> GROUND', function (): void {
      parser.reset();
      let dispatches = r(0x40, 0x7f);
      for (let i = 0; i < dispatches.length; ++i) {
        parser.currentState = ParserState.CSI_IGNORE;
        parser.params = [0, 1];
        parser.parse(dispatches[i]);
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
        parser.parse('\x1b' + initializers[i]);
        chai.expect(parser.currentState).equal(ParserState.SOS_PM_APC_STRING);
        parser.reset();
      }
      // C1
      for (state in states) {
        parser.currentState = state;
        initializers = ['\x98', '\x9e', '\x9f'];
        for (let i = 0; i < initializers.length; ++i) {
          parser.parse(initializers[i]);
          chai.expect(parser.currentState).equal(ParserState.SOS_PM_APC_STRING);
          parser.reset();
        }
      }
    });
    it('state SOS_PM_APC_STRING ignore rules', function (): void {
      parser.reset();
      let ignored = r(0x00, 0x18);
      ignored.concat(['\x19']);
      ignored.concat(r(0x1c, 0x20));
      ignored.concat(r(0x20, 0x80));
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.SOS_PM_APC_STRING;
        parser.parse(ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.SOS_PM_APC_STRING);
        parser.reset();
      }
    });
    it('trans ANYWHERE/ESCAPE --> OSC_STRING', function (): void {
      parser.reset();
      // C0
      parser.parse('\x1b]');
      chai.expect(parser.currentState).equal(ParserState.OSC_STRING);
      parser.reset();
      // C1
      for (state in states) {
        parser.currentState = state;
        parser.parse('\x9d');
        chai.expect(parser.currentState).equal(ParserState.OSC_STRING);
        parser.reset();
      }
    });
    it('state OSC_STRING ignore rules', function (): void {
      parser.reset();
      let ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', /*'\x07',*/ '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.OSC_STRING;
        parser.parse(ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.OSC_STRING);
        chai.expect(parser.osc).equal('');
        parser.reset();
      }
    });
    it('state OSC_STRING put action', function (): void {
      parser.reset();
      let puts = r(0x20, 0x80);
      for (let i = 0; i < puts.length; ++i) {
        parser.currentState = ParserState.OSC_STRING;
        parser.parse(puts[i]);
        chai.expect(parser.currentState).equal(ParserState.OSC_STRING);
        chai.expect(parser.osc).equal(puts[i]);
        parser.reset();
      }
    });
    it('state DCS_ENTRY', function (): void {
      parser.reset();
      // C0
      parser.parse('\x1bP');
      chai.expect(parser.currentState).equal(ParserState.DCS_ENTRY);
      parser.reset();
      // C1
      for (state in states) {
        parser.currentState = state;
        parser.parse('\x90');
        chai.expect(parser.currentState).equal(ParserState.DCS_ENTRY);
        parser.reset();
      }
    });
    it('state DCS_ENTRY ignore rules', function (): void {
      parser.reset();
      let ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parser.parse(ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_ENTRY);
        parser.reset();
      }
    });
    it('state DCS_ENTRY --> DCS_PARAM with param/collect actions', function (): void {
      parser.reset();
      let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      let collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parser.parse(params[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
        chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.DCS_ENTRY;
      parser.parse('\x3b');
      chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
      chai.expect(parser.params).eql([0, 0]);
      parser.reset();
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state DCS_PARAM ignore rules', function (): void {
      parser.reset();
      let ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parser.parse(ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
        parser.reset();
      }
    });
    it('state DCS_PARAM param action', function (): void {
      parser.reset();
      let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
      for (let i = 0; i < params.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parser.parse(params[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
        chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
        parser.reset();
      }
      parser.currentState = ParserState.DCS_PARAM;
      parser.parse('\x3b');
      chai.expect(parser.currentState).equal(ParserState.DCS_PARAM);
      chai.expect(parser.params).eql([0, 0]);
      parser.reset();
    });
    it('trans DCS_ENTRY --> DCS_IGNORE', function (): void {
      parser.reset();
      parser.currentState = ParserState.DCS_ENTRY;
      parser.parse('\x3a');
      chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
      parser.reset();
    });
    it('trans DCS_PARAM --> DCS_IGNORE', function (): void {
      parser.reset();
      let chars = ['\x3a', '\x3c', '\x3d', '\x3e', '\x3f'];
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parser.parse('\x3b' + chars[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
        chai.expect(parser.params).eql([0, 0]);
        parser.reset();
      }
    });
    it('trans DCS_INTERMEDIATE --> DCS_IGNORE', function (): void {
      parser.reset();
      let chars = r(0x30, 0x40);
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parser.parse(chars[i]);
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
      ignored.concat(r(0x20, 0x80));
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_IGNORE;
        parser.parse(ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
        parser.reset();
      }
    });
    it('trans DCS_ENTRY --> DCS_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      let collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('trans DCS_PARAM --> DCS_INTERMEDIATE with collect action', function (): void {
      parser.reset();
      let collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('state DCS_INTERMEDIATE ignore rules', function (): void {
      parser.reset();
      let ignored = [
        '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07', '\x08',
        '\x09', '\x0a', '\x0b', '\x0c', '\x0d', '\x0e', '\x0f', '\x10', '\x11',
        '\x12', '\x13', '\x14', '\x15', '\x16', '\x17', '\x19', '\x1c', '\x1d', '\x1e', '\x1f', '\x7f'];
      for (let i = 0; i < ignored.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parser.parse(ignored[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_INTERMEDIATE);
        parser.reset();
      }
    });
    it('state DCS_INTERMEDIATE collect action', function (): void {
      parser.reset();
      let collect = r(0x20, 0x30);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_INTERMEDIATE);
        chai.expect(parser.collect).equal(collect[i]);
        parser.reset();
      }
    });
    it('trans DCS_INTERMEDIATE --> DCS_IGNORE', function (): void {
      parser.reset();
      let chars = r(0x30, 0x40);
      for (let i = 0; i < chars.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parser.parse('\x20' + chars[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
        chai.expect(parser.collect).equal('\x20');
        parser.reset();
      }
    });
    it('trans DCS_ENTRY --> DCS_PASSTHROUGH with hook', function (): void {
      parser.reset();
      testTerminal.clear();
      let collect = r(0x40, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_ENTRY;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs hook', '', [0], collect[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans DCS_PARAM --> DCS_PASSTHROUGH with hook', function (): void {
      parser.reset();
      testTerminal.clear();
      let collect = r(0x40, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_PARAM;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs hook', '', [0], collect[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('trans DCS_INTERMEDIATE --> DCS_PASSTHROUGH with hook', function (): void {
      parser.reset();
      testTerminal.clear();
      let collect = r(0x40, 0x7f);
      for (let i = 0; i < collect.length; ++i) {
        parser.currentState = ParserState.DCS_INTERMEDIATE;
        parser.parse(collect[i]);
        chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
        testTerminal.compare([['dcs hook', '', [0], collect[i]]]);
        parser.reset();
        testTerminal.clear();
      }
    });
    it('state DCS_PASSTHROUGH put action', function (): void {
      parser.reset();
      testTerminal.clear();
      let puts = r(0x00, 0x18);
      puts.concat(['\x19']);
      puts.concat(r(0x1c, 0x20));
      puts.concat(r(0x20, 0x7f));
      for (let i = 0; i < puts.length; ++i) {
        parser.currentState = ParserState.DCS_PASSTHROUGH;
        parser.mockActiveDcsHandler();
        parser.parse(puts[i]);
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
      parser.parse('\x7f');
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
    parser.parse(s);
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
        ['osc', '0;abc123€öäü']
      ], null);
    });
    it('single DCS', function (): void {
      test('\x1bP1;2;3+$abc;de\x9c', [
        ['dcs hook', '+$', [1, 2, 3], 'a'],
        ['dcs put', 'bc;de'],
        ['dcs unhook']
      ], null);
    });
    it('multi DCS', function (): void {
      test('\x1bP1;2;3+$abc;de', [
        ['dcs hook', '+$', [1, 2, 3], 'a'],
        ['dcs put', 'bc;de']
      ], null);
      testTerminal.clear();
      test('abc\x9c', [
        ['dcs put', 'abc'],
        ['dcs unhook']
      ], true);
    });
    it('print + DCS(C1)', function (): void {
      test('abc\x901;2;3+$abc;de\x9c', [
        ['print', 'abc'],
        ['dcs hook', '+$', [1, 2, 3], 'a'],
        ['dcs put', 'bc;de'],
        ['dcs unhook']
      ], null);
    });
    it('print + PM(C1) + print', function (): void {
      test('abc\x98123tzf\x9cdefg', [
        ['print', 'abc'],
        ['print', 'defg']
      ], null);
    });
    it('print + OSC(C1) + print', function (): void {
      test('abc\x9d123tzf\x9cdefg', [
        ['print', 'abc'],
        ['osc', '123tzf'],
        ['print', 'defg']
      ], null);
    });
    it('error recovery', function (): void {
      test('\x1b[1€abcdefg\x9b<;c', [
        ['print', 'abcdefg'],
        ['csi', '<', [0, 0], 'c']
      ], null);
    });
  });

  describe('coverage tests', function (): void {
    it('CSI_IGNORE error', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.CSI_IGNORE;
      parser.parse('€öäü');
      chai.expect(parser.currentState).equal(ParserState.CSI_IGNORE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('DCS_IGNORE error', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.DCS_IGNORE;
      parser.parse('€öäü');
      chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
    it('DCS_PASSTHROUGH error', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.DCS_PASSTHROUGH;
      parser.parse('\x901;2;3+$a€öäü');
      chai.expect(parser.currentState).equal(ParserState.DCS_PASSTHROUGH);
      testTerminal.compare([['dcs hook', '+$', [1, 2, 3], 'a'], ['dcs put', '€öäü']]);
      parser.reset();
      testTerminal.clear();
    });
    it('error else of if (code > 159)', function (): void {
      parser.reset();
      testTerminal.clear();
      parser.currentState = ParserState.GROUND;
      parser.parse('\x1e');
      chai.expect(parser.currentState).equal(ParserState.GROUND);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
  });

  describe('set/clear handler', function(): void {
    const INPUT = '\x1b[1;31mhello \x1b%Gwor\x1bEld!\x1b[0m\r\n$>\x1b]1;foo=bar\x1b\\';
    let parser2 = null;
    let print = '';
    let esc = [];
    let csi = [];
    let exe = [];
    let osc = [];
    let dcs = [];
    function clearAccu(): void {
      print = '';
      esc = [];
      csi = [];
      exe = [];
      osc = [];
      dcs = [];
    }
    beforeEach(function(): void {
      parser2 = new TestEscapeSequenceParser();
      clearAccu();
    });
    it('print handler', function(): void {
      parser2.setPrintHandler(function(data: string, start: number, end: number): void {
        print += data.substring(start, end);
      });
      parser2.parse(INPUT);
      chai.expect(print).equal('hello world!$>');
      parser2.clearPrintHandler();
      parser2.clearPrintHandler(); // should not throw
      clearAccu();
      parser2.parse(INPUT);
      chai.expect(print).equal('');
    });
    it('ESC handler', function(): void {
      parser2.setEscHandler('%G', function (): void {
        esc.push('%G');
      });
      parser2.setEscHandler('E', function (): void {
        esc.push('E');
      });
      parser2.parse(INPUT);
      chai.expect(esc).eql(['%G', 'E']);
      parser2.clearEscHandler('%G');
      parser2.clearEscHandler('%G'); // should not throw
      clearAccu();
      parser2.parse(INPUT);
      chai.expect(esc).eql(['E']);
      parser2.clearEscHandler('E');
      clearAccu();
      parser2.parse(INPUT);
      chai.expect(esc).eql([]);
    });
    it('CSI handler', function(): void {
      parser2.setCsiHandler('m', function(params: number[], collect: string): void {
        csi.push(['m', params, collect]);
      });
      parser2.parse(INPUT);
      chai.expect(csi).eql([['m', [1, 31], ''], ['m', [0], '']]);
      parser2.clearCsiHandler('m');
      parser2.clearCsiHandler('m'); // should not throw
      clearAccu();
      parser2.parse(INPUT);
      chai.expect(csi).eql([]);
    });
    it('EXECUTE handler', function(): void {
      parser2.setExecuteHandler('\n', function(): void {
        exe.push('\n');
      });
      parser2.setExecuteHandler('\r', function(): void {
        exe.push('\r');
      });
      parser2.parse(INPUT);
      chai.expect(exe).eql(['\r', '\n']);
      parser2.clearExecuteHandler('\r');
      parser2.clearExecuteHandler('\r'); // should not throw
      clearAccu();
      parser2.parse(INPUT);
      chai.expect(exe).eql(['\n']);
    });
    it('OSC handler', function(): void {
      parser2.setOscHandler(1, function(data: string): void {
        osc.push([1, data]);
      });
      parser2.parse(INPUT);
      chai.expect(osc).eql([[1, 'foo=bar']]);
      parser2.clearOscHandler(1);
      parser2.clearOscHandler(1); // should not throw
      clearAccu();
      parser2.parse(INPUT);
      chai.expect(osc).eql([]);
    });
    it('DCS handler', function(): void {
      parser2.setDcsHandler('+p', {
        hook: function(collect: string, params: number[], flag: number): void {
          dcs.push(['hook', collect, params, flag]);
        },
        put: function(data: string, start: number, end: number): void {
          dcs.push(['put', data.substring(start, end)]);
        },
        unhook: function(): void {
          dcs.push(['unhook']);
        }
      });
      parser2.parse('\x1bP1;2;3+pabc');
      parser2.parse(';de\x9c');
      chai.expect(dcs).eql([
        ['hook', '+', [1, 2, 3], 'p'.charCodeAt(0)],
        ['put', 'abc'], ['put', ';de'],
        ['unhook']
      ]);
      parser2.clearDcsHandler('+p');
      parser2.clearDcsHandler('+p'); // should not throw
      clearAccu();
      parser2.parse('\x1bP1;2;3+pabc');
      parser2.parse(';de\x9c');
      chai.expect(dcs).eql([]);
    });
    it('ERROR handler', function(): void {
      let errorState: IParsingState = null;
      parser2.setErrorHandler(function(state: IParsingState): IParsingState {
        errorState = state;
        return state;
      });
      parser2.parse('\x1b[1;2;€;3m'); // faulty escape sequence
      chai.expect(errorState).eql({
        position: 6,
        code: '€'.charCodeAt(0),
        currentState: ParserState.CSI_PARAM,
        print: -1,
        dcs: -1,
        osc: '',
        collect: '',
        params: [1, 2, 0], // extra zero here
        abort: false
      });
      parser2.clearErrorHandler();
      parser2.clearErrorHandler(); // should not throw
      errorState = null;
      parser2.parse('\x1b[1;2;a;3m');
      chai.expect(errorState).eql(null);
    });
  });
  // TODO: error conditions
});
