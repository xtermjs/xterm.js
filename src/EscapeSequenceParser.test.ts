/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ParserState, IDcsHandler, IParsingState } from './Types';
import { EscapeSequenceParser, TransitionTable, VT500_TRANSITION_TABLE } from './EscapeSequenceParser';
import * as chai from 'chai';

function r(a: number, b: number): string[] {
  let c = b - a;
  const arr = new Array(c);
  while (c--) {
    arr[c] = String.fromCharCode(--b);
  }
  return arr;
}

// derived parser with access to internal states
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

// test object to collect parser actions and compare them with expected values
const testTerminal: any = {
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

// dcs handler to map dcs actions into the test object `testTerminal`
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
const parserUint = new TestEscapeSequenceParser(VT500_TRANSITION_TABLE);
parserUint.setPrintHandler(testTerminal.print.bind(testTerminal));
parserUint.setCsiHandlerFallback((collect: string, params: number[], flag: number) => {
  testTerminal.actionCSI(collect, params, String.fromCharCode(flag));
});
parserUint.setEscHandlerFallback((collect: string, flag: number) => {
  testTerminal.actionESC(collect, String.fromCharCode(flag));
});
parserUint.setExecuteHandlerFallback((code: number) => {
  testTerminal.actionExecute(String.fromCharCode(code));
});
parserUint.setOscHandlerFallback((identifier: number, data: string) => {
  if (identifier === -1) testTerminal.actionOSC(data);  // handle error condition silently
  else testTerminal.actionOSC('' + identifier + ';' + data);
});
parserUint.setDcsHandlerFallback(new DcsTest());

// array based transition table
const VT500_TRANSITION_TABLE_ARRAY = new TransitionTable(VT500_TRANSITION_TABLE.table.length);
VT500_TRANSITION_TABLE_ARRAY.table = new Array(VT500_TRANSITION_TABLE.table.length);
for (let i = 0; i < VT500_TRANSITION_TABLE.table.length; ++i) {
  VT500_TRANSITION_TABLE_ARRAY.table[i] = VT500_TRANSITION_TABLE.table[i];
}

// parser with array based transition table
const parserArray = new TestEscapeSequenceParser(VT500_TRANSITION_TABLE_ARRAY);
parserArray.setPrintHandler(testTerminal.print.bind(testTerminal));
parserArray.setCsiHandlerFallback((collect: string, params: number[], flag: number) => {
  testTerminal.actionCSI(collect, params, String.fromCharCode(flag));
});
parserArray.setEscHandlerFallback((collect: string, flag: number) => {
  testTerminal.actionESC(collect, String.fromCharCode(flag));
});
parserArray.setExecuteHandlerFallback((code: number) => {
  testTerminal.actionExecute(String.fromCharCode(code));
});
parserArray.setOscHandlerFallback((identifier: number, data: string) => {
  if (identifier === -1) testTerminal.actionOSC(data);  // handle error condition silently
  else testTerminal.actionOSC('' + identifier + ';' + data);
});
parserArray.setDcsHandlerFallback(new DcsTest());

interface IRun {
  tableType: string;
  parser: TestEscapeSequenceParser;
}


describe('EscapeSequenceParser', function (): void {
  let parser: TestEscapeSequenceParser | null = null;
  const runs: IRun[] = [
    { tableType: 'Uint8Array', parser: parserUint },
    { tableType: 'Array', parser: parserArray }
  ];
  runs.forEach(function (run: IRun): void {
    describe('Parser init and methods / ' + run.tableType, function (): void {
      before(function(): void {
        parser = run.parser;
      });
      it('constructor', function (): void {
        let p: EscapeSequenceParser = new EscapeSequenceParser();
        chai.expect(p.TRANSITIONS).equal(VT500_TRANSITION_TABLE);
        p = new EscapeSequenceParser(VT500_TRANSITION_TABLE);
        chai.expect(p.TRANSITIONS).equal(VT500_TRANSITION_TABLE);
        const tansitions: TransitionTable = new TransitionTable(10);
        p = new EscapeSequenceParser(tansitions);
        chai.expect(p.TRANSITIONS).equal(tansitions);
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
  });
  runs.forEach(function (run: IRun): void {
    describe('state transitions and actions / ' + run.tableType, function (): void {
      before(function(): void {
        parser = run.parser;
      });
      it('state GROUND execute action', function (): void {
        parser.reset();
        testTerminal.clear();
        const exes = r(0x00, 0x18);
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
        const printables = r(0x20, 0x7f); // NOTE: DEL excluded
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
        const exes = [
          '\x18', '\x1a',
          '\x80', '\x81', '\x82', '\x83', '\x84', '\x85', '\x86', '\x87', '\x88',
          '\x89', '\x8a', '\x8b', '\x8c', '\x8d', '\x8e', '\x8f',
          '\x91', '\x92', '\x93', '\x94', '\x95', '\x96', '\x97', '\x99', '\x9a'
        ];
        const exceptions: { [key: number]: { [key: string]: any[] } } = {
          8: { '\x18': [], '\x1a': [] } // simply abort osc state
        };
        parser.reset();
        testTerminal.clear();
        for (state in states) {
          for (let i = 0; i < exes.length; ++i) {
            parser.currentState = state;
            parser.parse(exes[i]);
            chai.expect(parser.currentState).equal(ParserState.GROUND);
            testTerminal.compare((state in exceptions ? exceptions[state][exes[i]] : 0) || [['exe', exes[i]]]);
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
        const exes = r(0x00, 0x18);
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
        const dispatches = r(0x30, 0x50);
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
        const collect = r(0x20, 0x30);
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
        const exes = r(0x00, 0x18);
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
        const collect = r(0x20, 0x30);
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
        const collect = r(0x30, 0x7f);
        for (let i = 0; i < collect.length; ++i) {
          parser.currentState = ParserState.ESCAPE_INTERMEDIATE;
          parser.parse(collect[i]);
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
        const exes = r(0x00, 0x18);
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
        const dispatches = r(0x40, 0x7f);
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
        const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
        const collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
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
        const exes = r(0x00, 0x18);
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
        const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
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
        const dispatches = r(0x40, 0x7f);
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
        const collect = r(0x20, 0x30);
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
        const collect = r(0x20, 0x30);
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
        const exes = r(0x00, 0x18);
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
        const collect = r(0x20, 0x30);
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
        const dispatches = r(0x40, 0x7f);
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
        const chars = ['\x3a', '\x3c', '\x3d', '\x3e', '\x3f'];
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
        const chars = r(0x30, 0x40);
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
        const exes = r(0x00, 0x18);
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
        const ignored = r(0x20, 0x40);
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
        const dispatches = r(0x40, 0x7f);
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
        const ignored = r(0x00, 0x18);
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
        const ignored = [
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
        const puts = r(0x20, 0x80);
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
        const ignored = [
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
        const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
        const collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
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
        const ignored = [
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
        const params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
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
        const chars = ['\x3a', '\x3c', '\x3d', '\x3e', '\x3f'];
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
        const chars = r(0x30, 0x40);
        for (let i = 0; i < chars.length; ++i) {
          parser.currentState = ParserState.DCS_INTERMEDIATE;
          parser.parse(chars[i]);
          chai.expect(parser.currentState).equal(ParserState.DCS_IGNORE);
          parser.reset();
        }
      });
      it('state DCS_IGNORE ignore rules', function (): void {
        parser.reset();
        const ignored = [
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
        const collect = r(0x20, 0x30);
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
        const collect = r(0x20, 0x30);
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
        const ignored = [
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
        const collect = r(0x20, 0x30);
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
        const chars = r(0x30, 0x40);
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
        const collect = r(0x40, 0x7f);
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
        const collect = r(0x40, 0x7f);
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
        const collect = r(0x40, 0x7f);
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
        const puts = r(0x00, 0x18);
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
  });

  runs.forEach(function (run: IRun): void {
    let test: Function | null = null;
    describe('escape sequence examples / ' + run.tableType, function (): void {
      before(function(): void {
        parser = run.parser;
        test = function(s: string, value: any, noReset: any): void {
          if (!noReset) {
            parser.reset();
            testTerminal.clear();
          }
          parser.parse(s);
          testTerminal.compare(value);
        };
      });
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
      it('7bit ST should be swallowed', function(): void {
        test('abc\x9d123tzf\x1b\\defg', [
          ['print', 'abc'],
          ['osc', '123tzf'],
          ['print', 'defg']
        ], null);
      });
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
      parser.parse('\x9c');
      chai.expect(parser.currentState).equal(ParserState.GROUND);
      testTerminal.compare([]);
      parser.reset();
      testTerminal.clear();
    });
  });

  describe('set/clear handler', function (): void {
    const INPUT = '\x1b[1;31mhello \x1b%Gwor\x1bEld!\x1b[0m\r\n$>\x1b]1;foo=bar\x1b\\';
    let parser2: TestEscapeSequenceParser = null;
    let print = '';
    const esc: string[] = [];
    const csi: [string, number[], string][] = [];
    const exe: string[] = [];
    const osc: [number, string][] = [];
    const dcs: ([string] | [string, string] | [string, string, number[], number])[] = [];
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
      parser2.setPrintHandler(function (data: string, start: number, end: number): void {
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
    it('ESC handler', function (): void {
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
    it('CSI handler', function (): void {
      parser2.setCsiHandler('m', function (params: number[], collect: string): void {
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
    it('EXECUTE handler', function (): void {
      parser2.setExecuteHandler('\n', function (): void {
        exe.push('\n');
      });
      parser2.setExecuteHandler('\r', function (): void {
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
    it('OSC handler', function (): void {
      parser2.setOscHandler(1, function (data: string): void {
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
    it('DCS handler', function (): void {
      parser2.setDcsHandler('+p', {
        hook: function (collect: string, params: number[], flag: number): void {
          dcs.push(['hook', collect, params, flag]);
        },
        put: function (data: string, start: number, end: number): void {
          dcs.push(['put', data.substring(start, end)]);
        },
        unhook: function (): void {
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
    it('ERROR handler', function (): void {
      let errorState: IParsingState = null;
      parser2.setErrorHandler(function (state: IParsingState): IParsingState {
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
  // TODO: error conditions and error recovery (not implemented yet in parser)
});
