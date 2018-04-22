import { EscapeSequenceParser, IParserTerminal, STATE } from './EscapeSequenceParser';
import * as chai from 'chai';

function r(a: number, b: number): string[] {
    let c = b - a;
    let arr = new Array(c);
    while (c--) {
        arr[c] = String.fromCharCode(--b);
    }
    return arr;
}

interface ITestTerminal extends IParserTerminal {
    calls: any[];
    clear: () => void;
    compare: (value: any) => void;
}

let testTerminal: ITestTerminal = {
    calls: [],
    clear: function (): void {
        this.calls = [];
    },
    compare: function (value: any): void {
        chai.expect(this.calls.slice()).eql(value); // weird bug w'o slicing here
    },
    actionPrint: function (data: string, start: number, end: number): void {
        this.calls.push(['print', data.substring(start, end)]);
    },
    actionOSC: function (s: string): void {
        this.calls.push(['osc', s]);
    },
    actionExecute: function (flag: string): void {
        this.calls.push(['exe', flag]);
    },
    actionCSI: function (collected: string, params: number[], flag: string): void {
        this.calls.push(['csi', collected, params, flag]);
    },
    actionESC: function (collected: string, flag: string): void {
        this.calls.push(['esc', collected, flag]);
    },
    actionDCSHook: function (collected: string, params: number[], flag: string): void {
        this.calls.push(['dcs hook', collected, params, flag]);
    },
    actionDCSPrint: function (data: string, start: number, end: number): void {
        this.calls.push(['dcs put', data.substring(start, end)]);
    },
    actionDCSUnhook: function (): void {
        this.calls.push(['dcs unhook']);
    }
};

let states: number[] = [
    STATE.GROUND,
    STATE.ESCAPE,
    STATE.ESCAPE_INTERMEDIATE,
    STATE.CSI_ENTRY,
    STATE.CSI_PARAM,
    STATE.CSI_INTERMEDIATE,
    STATE.CSI_IGNORE,
    STATE.SOS_PM_APC_STRING,
    STATE.OSC_STRING,
    STATE.DCS_ENTRY,
    STATE.DCS_PARAM,
    STATE.DCS_IGNORE,
    STATE.DCS_INTERMEDIATE,
    STATE.DCS_PASSTHROUGH
];
let state: any;

let parser = new EscapeSequenceParser(testTerminal);

describe('EscapeSequenceParser', function(): void {

    describe('Parser init and methods', function(): void {
        it('parser init', function (): void {
            let p = new EscapeSequenceParser({});
            chai.expect(p.term).a('object');
            chai.expect(p.term.actionPrint).a('function');
            chai.expect(p.term.actionOSC).a('function');
            chai.expect(p.term.actionExecute).a('function');
            chai.expect(p.term.actionCSI).a('function');
            chai.expect(p.term.actionESC).a('function');
            chai.expect(p.term.actionDCSHook).a('function');
            chai.expect(p.term.actionDCSPrint).a('function');
            chai.expect(p.term.actionDCSUnhook).a('function');
            p.parse('\x1b[31mHello World!');
        });
        it('terminal callbacks', function (): void {
            chai.expect(parser.term).equal(testTerminal);
            chai.expect(parser.term.actionPrint).equal(testTerminal.actionPrint);
            chai.expect(parser.term.actionOSC).equal(testTerminal.actionOSC);
            chai.expect(parser.term.actionExecute).equal(testTerminal.actionExecute);
            chai.expect(parser.term.actionCSI).equal(testTerminal.actionCSI);
            chai.expect(parser.term.actionESC).equal(testTerminal.actionESC);
            chai.expect(parser.term.actionDCSHook).equal(testTerminal.actionDCSHook);
            chai.expect(parser.term.actionDCSPrint).equal(testTerminal.actionDCSPrint);
            chai.expect(parser.term.actionDCSUnhook).equal(testTerminal.actionDCSUnhook);
        });
        it('inital states', function (): void {
            chai.expect(parser.initialState).equal(0);
            chai.expect(parser.currentState).equal(0);
            chai.expect(parser.osc).equal('');
            chai.expect(parser.params).eql([0]);
            chai.expect(parser.collected).equal('');
        });
        it('reset states', function (): void {
            parser.currentState = 124;
            parser.osc = '#';
            parser.params = [123];
            parser.collected = '#';

            parser.reset();
            chai.expect(parser.currentState).equal(STATE.GROUND);
            chai.expect(parser.osc).equal('');
            chai.expect(parser.params).eql([0]);
            chai.expect(parser.collected).equal('');
        });
    });

    describe('state transitions and actions', function(): void {
        it('state GROUND execute action', function (): void {
            parser.reset();
            testTerminal.clear();
            let exes = r(0x00, 0x18);
            exes.concat(['\x19']);
            exes.concat(r(0x1c, 0x20));
            for (let i = 0; i < exes.length; ++i) {
                parser.currentState = STATE.GROUND;
                parser.parse(exes[i]);
                chai.expect(parser.currentState).equal(STATE.GROUND);
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
                parser.currentState = STATE.GROUND;
                parser.parse(printables[i]);
                chai.expect(parser.currentState).equal(STATE.GROUND);
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
                8: {'\x18': [], '\x1a': []} // simply abort osc state
            };
            parser.reset();
            testTerminal.clear();
            for (state in states) {
                for (let i = 0; i < exes.length; ++i) {
                    parser.currentState = state;
                    parser.parse(exes[i]);
                    chai.expect(parser.currentState).equal(STATE.GROUND);
                    testTerminal.compare(((exceptions[state]) ? exceptions[state][exes[i]] : 0) || [['exe', exes[i]]]);
                    parser.reset();
                    testTerminal.clear();
                }
                parser.parse('\x9c');
                chai.expect(parser.currentState).equal(STATE.GROUND);
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
                parser.collected = '#';
                parser.parse('\x1b');
                chai.expect(parser.currentState).equal(STATE.ESCAPE);
                chai.expect(parser.osc).equal('');
                chai.expect(parser.params).eql([0]);
                chai.expect(parser.collected).equal('');
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
                parser.currentState = STATE.ESCAPE;
                parser.parse(exes[i]);
                chai.expect(parser.currentState).equal(STATE.ESCAPE);
                testTerminal.compare([['exe', exes[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('state ESCAPE ignore', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.ESCAPE;
            parser.parse('\x7f');
            chai.expect(parser.currentState).equal(STATE.ESCAPE);
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
                parser.currentState = STATE.ESCAPE;
                parser.parse(dispatches[i]);
                chai.expect(parser.currentState).equal(STATE.GROUND);
                testTerminal.compare([['esc', '', dispatches[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('trans ESCAPE --> ESCAPE_INTERMEDIATE with collect action', function (): void {
            parser.reset();
            let collect = r(0x20, 0x30);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.ESCAPE;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.ESCAPE_INTERMEDIATE);
                chai.expect(parser.collected).equal(collect[i]);
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
                parser.currentState = STATE.ESCAPE_INTERMEDIATE;
                parser.parse(exes[i]);
                chai.expect(parser.currentState).equal(STATE.ESCAPE_INTERMEDIATE);
                testTerminal.compare([['exe', exes[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('state ESCAPE_INTERMEDIATE ignore', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.ESCAPE_INTERMEDIATE;
            parser.parse('\x7f');
            chai.expect(parser.currentState).equal(STATE.ESCAPE_INTERMEDIATE);
            testTerminal.compare([]);
            parser.reset();
            testTerminal.clear();
        });
        it('state ESCAPE_INTERMEDIATE collect action', function (): void {
            parser.reset();
            let collect = r(0x20, 0x30);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.ESCAPE_INTERMEDIATE;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.ESCAPE_INTERMEDIATE);
                chai.expect(parser.collected).equal(collect[i]);
                parser.reset();
            }
        });
        it('trans ESCAPE_INTERMEDIATE --> GROUND with esc_dispatch action', function (): void {
            parser.reset();
            testTerminal.clear();
            let collect = r(0x30, 0x7f);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.ESCAPE_INTERMEDIATE;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.GROUND);
                testTerminal.compare([['esc', '', collect[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('trans ANYWHERE/ESCAPE --> CSI_ENTRY with clear', function (): void {
            parser.reset();
            // C0
            parser.currentState = STATE.ESCAPE;
            parser.osc = '#';
            parser.params = [123];
            parser.collected = '#';
            parser.parse('[');
            chai.expect(parser.currentState).equal(STATE.CSI_ENTRY);
            chai.expect(parser.osc).equal('');
            chai.expect(parser.params).eql([0]);
            chai.expect(parser.collected).equal('');
            parser.reset();
            // C1
            for (state in states) {
                parser.currentState = state;
                parser.osc = '#';
                parser.params = [123];
                parser.collected = '#';
                parser.parse('\x9b');
                chai.expect(parser.currentState).equal(STATE.CSI_ENTRY);
                chai.expect(parser.osc).equal('');
                chai.expect(parser.params).eql([0]);
                chai.expect(parser.collected).equal('');
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
                parser.currentState = STATE.CSI_ENTRY;
                parser.parse(exes[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_ENTRY);
                testTerminal.compare([['exe', exes[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('state CSI_ENTRY ignore', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.CSI_ENTRY;
            parser.parse('\x7f');
            chai.expect(parser.currentState).equal(STATE.CSI_ENTRY);
            testTerminal.compare([]);
            parser.reset();
            testTerminal.clear();
        });
        it('trans CSI_ENTRY --> GROUND with csi_dispatch action', function (): void {
            parser.reset();
            let dispatches = r(0x40, 0x7f);
            for (let i = 0; i < dispatches.length; ++i) {
                parser.currentState = STATE.CSI_ENTRY;
                parser.parse(dispatches[i]);
                chai.expect(parser.currentState).equal(STATE.GROUND);
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
                parser.currentState = STATE.CSI_ENTRY;
                parser.parse(params[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_PARAM);
                chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
                parser.reset();
            }
            parser.currentState = STATE.CSI_ENTRY;
            parser.parse('\x3b');
            chai.expect(parser.currentState).equal(STATE.CSI_PARAM);
            chai.expect(parser.params).eql([0, 0]);
            parser.reset();
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.CSI_ENTRY;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_PARAM);
                chai.expect(parser.collected).equal(collect[i]);
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
                parser.currentState = STATE.CSI_PARAM;
                parser.parse(exes[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_PARAM);
                testTerminal.compare([['exe', exes[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('state CSI_PARAM param action', function (): void {
            parser.reset();
            let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
            for (let i = 0; i < params.length; ++i) {
                parser.currentState = STATE.CSI_PARAM;
                parser.parse(params[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_PARAM);
                chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
                parser.reset();
            }
            parser.currentState = STATE.CSI_PARAM;
            parser.parse('\x3b');
            chai.expect(parser.currentState).equal(STATE.CSI_PARAM);
            chai.expect(parser.params).eql([0, 0]);
            parser.reset();
        });
        it('state CSI_PARAM ignore', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.CSI_PARAM;
            parser.parse('\x7f');
            chai.expect(parser.currentState).equal(STATE.CSI_PARAM);
            testTerminal.compare([]);
            parser.reset();
            testTerminal.clear();
        });
        it('trans CSI_PARAM --> GROUND with csi_dispatch action', function (): void {
            parser.reset();
            let dispatches = r(0x40, 0x7f);
            for (let i = 0; i < dispatches.length; ++i) {
                parser.currentState = STATE.CSI_PARAM;
                parser.params = [0, 1];
                parser.parse(dispatches[i]);
                chai.expect(parser.currentState).equal(STATE.GROUND);
                testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('trans CSI_ENTRY --> CSI_INTERMEDIATE with collect action', function (): void {
            parser.reset();
            let collect = r(0x20, 0x30);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.CSI_ENTRY;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_INTERMEDIATE);
                chai.expect(parser.collected).equal(collect[i]);
                parser.reset();
            }
        });
        it('trans CSI_PARAM --> CSI_INTERMEDIATE with collect action', function (): void {
            parser.reset();
            let collect = r(0x20, 0x30);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.CSI_PARAM;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_INTERMEDIATE);
                chai.expect(parser.collected).equal(collect[i]);
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
                parser.currentState = STATE.CSI_INTERMEDIATE;
                parser.parse(exes[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_INTERMEDIATE);
                testTerminal.compare([['exe', exes[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('state CSI_INTERMEDIATE collect', function (): void {
            parser.reset();
            let collect = r(0x20, 0x30);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.CSI_INTERMEDIATE;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_INTERMEDIATE);
                chai.expect(parser.collected).equal(collect[i]);
                parser.reset();
            }
        });
        it('state CSI_INTERMEDIATE ignore', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.CSI_INTERMEDIATE;
            parser.parse('\x7f');
            chai.expect(parser.currentState).equal(STATE.CSI_INTERMEDIATE);
            testTerminal.compare([]);
            parser.reset();
            testTerminal.clear();
        });
        it('trans CSI_INTERMEDIATE --> GROUND with csi_dispatch action', function (): void {
            parser.reset();
            let dispatches = r(0x40, 0x7f);
            for (let i = 0; i < dispatches.length; ++i) {
                parser.currentState = STATE.CSI_INTERMEDIATE;
                parser.params = [0, 1];
                parser.parse(dispatches[i]);
                chai.expect(parser.currentState).equal(STATE.GROUND);
                testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('trans CSI_ENTRY --> CSI_IGNORE', function (): void {
            parser.reset();
            parser.currentState = STATE.CSI_ENTRY;
            parser.parse('\x3a');
            chai.expect(parser.currentState).equal(STATE.CSI_IGNORE);
            parser.reset();
        });
        it('trans CSI_PARAM --> CSI_IGNORE', function (): void {
            parser.reset();
            let chars = ['\x3a', '\x3c', '\x3d', '\x3e', '\x3f'];
            for (let i = 0; i < chars.length; ++i) {
                parser.currentState = STATE.CSI_PARAM;
                parser.parse('\x3b' + chars[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_IGNORE);
                chai.expect(parser.params).eql([0, 0]);
                parser.reset();
            }
        });
        it('trans CSI_INTERMEDIATE --> CSI_IGNORE', function (): void {
            parser.reset();
            let chars = r(0x30, 0x40);
            for (let i = 0; i < chars.length; ++i) {
                parser.currentState = STATE.CSI_INTERMEDIATE;
                parser.parse(chars[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_IGNORE);
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
                parser.currentState = STATE.CSI_IGNORE;
                parser.parse(exes[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_IGNORE);
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
                parser.currentState = STATE.CSI_IGNORE;
                parser.parse(ignored[i]);
                chai.expect(parser.currentState).equal(STATE.CSI_IGNORE);
                testTerminal.compare([]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('trans CSI_IGNORE --> GROUND', function (): void {
            parser.reset();
            let dispatches = r(0x40, 0x7f);
            for (let i = 0; i < dispatches.length; ++i) {
                parser.currentState = STATE.CSI_IGNORE;
                parser.params = [0, 1];
                parser.parse(dispatches[i]);
                chai.expect(parser.currentState).equal(STATE.GROUND);
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
                chai.expect(parser.currentState).equal(STATE.SOS_PM_APC_STRING);
                parser.reset();
            }
            // C1
            for (state in states) {
                parser.currentState = state;
                initializers = ['\x98', '\x9e', '\x9f'];
                for (let i = 0; i < initializers.length; ++i) {
                    parser.parse(initializers[i]);
                    chai.expect(parser.currentState).equal(STATE.SOS_PM_APC_STRING);
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
                parser.currentState = STATE.SOS_PM_APC_STRING;
                parser.parse(ignored[i]);
                chai.expect(parser.currentState).equal(STATE.SOS_PM_APC_STRING);
                parser.reset();
            }
        });
        it('trans ANYWHERE/ESCAPE --> OSC_STRING', function (): void {
            parser.reset();
            // C0
            parser.parse('\x1b]');
            chai.expect(parser.currentState).equal(STATE.OSC_STRING);
            parser.reset();
            // C1
            for (state in states) {
                parser.currentState = state;
                parser.parse('\x9d');
                chai.expect(parser.currentState).equal(STATE.OSC_STRING);
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
                parser.currentState = STATE.OSC_STRING;
                parser.parse(ignored[i]);
                chai.expect(parser.currentState).equal(STATE.OSC_STRING);
                chai.expect(parser.osc).equal('');
                parser.reset();
            }
        });
        it('state OSC_STRING put action', function (): void {
            parser.reset();
            let puts = r(0x20, 0x80);
            for (let i = 0; i < puts.length; ++i) {
                parser.currentState = STATE.OSC_STRING;
                parser.parse(puts[i]);
                chai.expect(parser.currentState).equal(STATE.OSC_STRING);
                chai.expect(parser.osc).equal(puts[i]);
                parser.reset();
            }
        });
        it('state DCS_ENTRY', function (): void {
            parser.reset();
            // C0
            parser.parse('\x1bP');
            chai.expect(parser.currentState).equal(STATE.DCS_ENTRY);
            parser.reset();
            // C1
            for (state in states) {
                parser.currentState = state;
                parser.parse('\x90');
                chai.expect(parser.currentState).equal(STATE.DCS_ENTRY);
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
                parser.currentState = STATE.DCS_ENTRY;
                parser.parse(ignored[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_ENTRY);
                parser.reset();
            }
        });
        it('state DCS_ENTRY --> DCS_PARAM with param/collect actions', function (): void {
            parser.reset();
            let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
            let collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
            for (let i = 0; i < params.length; ++i) {
                parser.currentState = STATE.DCS_ENTRY;
                parser.parse(params[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_PARAM);
                chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
                parser.reset();
            }
            parser.currentState = STATE.DCS_ENTRY;
            parser.parse('\x3b');
            chai.expect(parser.currentState).equal(STATE.DCS_PARAM);
            chai.expect(parser.params).eql([0, 0]);
            parser.reset();
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.DCS_ENTRY;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_PARAM);
                chai.expect(parser.collected).equal(collect[i]);
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
                parser.currentState = STATE.DCS_PARAM;
                parser.parse(ignored[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_PARAM);
                parser.reset();
            }
        });
        it('state DCS_PARAM param action', function (): void {
            parser.reset();
            let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
            for (let i = 0; i < params.length; ++i) {
                parser.currentState = STATE.DCS_PARAM;
                parser.parse(params[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_PARAM);
                chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
                parser.reset();
            }
            parser.currentState = STATE.DCS_PARAM;
            parser.parse('\x3b');
            chai.expect(parser.currentState).equal(STATE.DCS_PARAM);
            chai.expect(parser.params).eql([0, 0]);
            parser.reset();
        });
        it('trans DCS_ENTRY --> DCS_IGNORE', function (): void {
            parser.reset();
            parser.currentState = STATE.DCS_ENTRY;
            parser.parse('\x3a');
            chai.expect(parser.currentState).equal(STATE.DCS_IGNORE);
            parser.reset();
        });
        it('trans DCS_PARAM --> DCS_IGNORE', function (): void {
            parser.reset();
            let chars = ['\x3a', '\x3c', '\x3d', '\x3e', '\x3f'];
            for (let i = 0; i < chars.length; ++i) {
                parser.currentState = STATE.DCS_PARAM;
                parser.parse('\x3b' + chars[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_IGNORE);
                chai.expect(parser.params).eql([0, 0]);
                parser.reset();
            }
        });
        it('trans DCS_INTERMEDIATE --> DCS_IGNORE', function (): void {
            parser.reset();
            let chars = r(0x30, 0x40);
            for (let i = 0; i < chars.length; ++i) {
                parser.currentState = STATE.DCS_INTERMEDIATE;
                parser.parse(chars[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_IGNORE);
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
                parser.currentState = STATE.DCS_IGNORE;
                parser.parse(ignored[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_IGNORE);
                parser.reset();
            }
        });
        it('trans DCS_ENTRY --> DCS_INTERMEDIATE with collect action', function (): void {
            parser.reset();
            let collect = r(0x20, 0x30);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.DCS_ENTRY;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_INTERMEDIATE);
                chai.expect(parser.collected).equal(collect[i]);
                parser.reset();
            }
        });
        it('trans DCS_PARAM --> DCS_INTERMEDIATE with collect action', function (): void {
            parser.reset();
            let collect = r(0x20, 0x30);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.DCS_PARAM;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_INTERMEDIATE);
                chai.expect(parser.collected).equal(collect[i]);
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
                parser.currentState = STATE.DCS_INTERMEDIATE;
                parser.parse(ignored[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_INTERMEDIATE);
                parser.reset();
            }
        });
        it('state DCS_INTERMEDIATE collect action', function (): void {
            parser.reset();
            let collect = r(0x20, 0x30);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.DCS_INTERMEDIATE;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_INTERMEDIATE);
                chai.expect(parser.collected).equal(collect[i]);
                parser.reset();
            }
        });
        it('trans DCS_INTERMEDIATE --> DCS_IGNORE', function (): void {
            parser.reset();
            let chars = r(0x30, 0x40);
            for (let i = 0; i < chars.length; ++i) {
                parser.currentState = STATE.DCS_INTERMEDIATE;
                parser.parse('\x20' + chars[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_IGNORE);
                chai.expect(parser.collected).equal('\x20');
                parser.reset();
            }
        });
        it('trans DCS_ENTRY --> DCS_PASSTHROUGH with hook', function (): void {
            parser.reset();
            testTerminal.clear();
            let collect = r(0x40, 0x7f);
            for (let i = 0; i < collect.length; ++i) {
                parser.currentState = STATE.DCS_ENTRY;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_PASSTHROUGH);
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
                parser.currentState = STATE.DCS_PARAM;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_PASSTHROUGH);
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
                parser.currentState = STATE.DCS_INTERMEDIATE;
                parser.parse(collect[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_PASSTHROUGH);
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
                parser.currentState = STATE.DCS_PASSTHROUGH;
                parser.parse(puts[i]);
                chai.expect(parser.currentState).equal(STATE.DCS_PASSTHROUGH);
                testTerminal.compare([['dcs put', puts[i]]]);
                parser.reset();
                testTerminal.clear();
            }
        });
        it('state DCS_PASSTHROUGH ignore', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.DCS_PASSTHROUGH;
            parser.parse('\x7f');
            chai.expect(parser.currentState).equal(STATE.DCS_PASSTHROUGH);
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

    describe('escape sequence examples', function(): void {
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

    describe('coverage tests', function(): void {
        it('CSI_IGNORE error', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.CSI_IGNORE;
            parser.parse('€öäü');
            chai.expect(parser.currentState).equal(STATE.CSI_IGNORE);
            testTerminal.compare([]);
            parser.reset();
            testTerminal.clear();
        });
        it('DCS_IGNORE error', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.DCS_IGNORE;
            parser.parse('€öäü');
            chai.expect(parser.currentState).equal(STATE.DCS_IGNORE);
            testTerminal.compare([]);
            parser.reset();
            testTerminal.clear();
        });
        it('DCS_PASSTHROUGH error', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.DCS_PASSTHROUGH;
            parser.parse('€öäü');
            chai.expect(parser.currentState).equal(STATE.DCS_PASSTHROUGH);
            testTerminal.compare([['dcs put', '€öäü']]);
            parser.reset();
            testTerminal.clear();
        });
        it('error else of if (code > 159)', function (): void {
            parser.reset();
            testTerminal.clear();
            parser.currentState = STATE.GROUND;
            parser.parse('\x1e');
            chai.expect(parser.currentState).equal(STATE.GROUND);
            testTerminal.compare([]);
            parser.reset();
            testTerminal.clear();
        });
    });

    let errorTerminal1 = function(): void {};
    errorTerminal1.prototype = testTerminal;
    let errTerminal1 = new errorTerminal1();
    errTerminal1.actionError = function(e: any): void {
        this.calls.push(['error', e]);
    };
    let errParser1 = new EscapeSequenceParser(errTerminal1);

    let errorTerminal2 = function(): void {};
    errorTerminal2.prototype = testTerminal;
    let errTerminal2 = new errorTerminal2();
    errTerminal2.actionError = function(e: any): any {
        this.calls.push(['error', e]);
        return true;  // --> abort parsing
    };
    let errParser2 = new EscapeSequenceParser(errTerminal2);

    describe('error tests', function(): void {
        it('CSI_PARAM unicode error - actionError output w/o abort', function (): void {
            errParser1.parse('\x1b[<31;5€normal print');
            errTerminal1.compare([
                ['error', {
                    pos: 7,
                    code: '€'.charCodeAt(0),
                    state: 4,
                    print: -1,
                    dcs: -1,
                    osc: '',
                    collect: '<',
                    params: [31, 5]}],
                ['print', 'normal print']
            ]);
            parser.reset();
            testTerminal.clear();
        });
        it('CSI_PARAM unicode error - actionError output with abort', function (): void {
            errParser2.parse('\x1b[<31;5€no print');
            errTerminal2.compare([
                ['error', {
                    pos: 7,
                    code: '€'.charCodeAt(0),
                    state: 4,
                    print: -1,
                    dcs: -1,
                    osc: '',
                    collect: '<',
                    params: [31, 5]}]
            ]);
            parser.reset();
            testTerminal.clear();
        });
    });

});
