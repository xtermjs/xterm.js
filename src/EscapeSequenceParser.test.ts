import { AnsiParser, IParserTerminal } from './EscapeSequenceParser';
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
    inst_p: function (s: string, start: number, end: number): void {
        this.calls.push(['print', s.substring(start, end)]);
    },
    inst_o: function (s: string): void {
        this.calls.push(['osc', s]);
    },
    inst_x: function (flag: string): void {
        this.calls.push(['exe', flag]);
    },
    inst_c: function (collected: string, params: number[], flag: string): void {
        this.calls.push(['csi', collected, params, flag]);
    },
    inst_e: function (collected: string, flag: string): void {
        this.calls.push(['esc', collected, flag]);
    },
    inst_H: function (collected: string, params: number[], flag: string): void {
        this.calls.push(['dcs hook', collected, params, flag]);
    },
    inst_P: function (dcs: string): void {
        this.calls.push(['dcs put', dcs]);
    },
    inst_U: function (): void {
        this.calls.push(['dcs unhook']);
    }
};

let parser = new AnsiParser(testTerminal);

describe('Parser init and methods', function(): void {
    it('parser init', function (): void {
        let p = new AnsiParser({});
        chai.expect(p.term).a('object');
        chai.expect(p.term.inst_p).a('function');
        chai.expect(p.term.inst_o).a('function');
        chai.expect(p.term.inst_x).a('function');
        chai.expect(p.term.inst_c).a('function');
        chai.expect(p.term.inst_e).a('function');
        chai.expect(p.term.inst_H).a('function');
        chai.expect(p.term.inst_P).a('function');
        chai.expect(p.term.inst_U).a('function');
        p.parse('\x1b[31mHello World!');
    });
    it('terminal callbacks', function (): void {
        chai.expect(parser.term).equal(testTerminal);
        chai.expect(parser.term.inst_p).equal(testTerminal.inst_p);
        chai.expect(parser.term.inst_o).equal(testTerminal.inst_o);
        chai.expect(parser.term.inst_x).equal(testTerminal.inst_x);
        chai.expect(parser.term.inst_c).equal(testTerminal.inst_c);
        chai.expect(parser.term.inst_e).equal(testTerminal.inst_e);
        chai.expect(parser.term.inst_H).equal(testTerminal.inst_H);
        chai.expect(parser.term.inst_P).equal(testTerminal.inst_P);
        chai.expect(parser.term.inst_U).equal(testTerminal.inst_U);
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
        chai.expect(parser.currentState).equal(0);
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
            parser.currentState = 0;
            parser.parse(exes[i]);
            chai.expect(parser.currentState).equal(0);
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
            parser.currentState = 0;
            parser.parse(printables[i]);
            chai.expect(parser.currentState).equal(0);
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
        for (let state = 0; state < 14; ++state) {
            for (let i = 0; i < exes.length; ++i) {
                parser.currentState = state;
                parser.parse(exes[i]);
                chai.expect(parser.currentState).equal(0);
                testTerminal.compare(((exceptions[state]) ? exceptions[state][exes[i]] : 0) || [['exe', exes[i]]]);
                parser.reset();
                testTerminal.clear();
            }
            parser.parse('\x9c');
            chai.expect(parser.currentState).equal(0);
            testTerminal.compare([]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('trans ANYWHERE --> ESCAPE with clear', function (): void {
        parser.reset();
        for (let state = 0; state < 14; ++state) {
            parser.currentState = state;
            parser.osc = '#';
            parser.params = [23];
            parser.collected = '#';
            parser.parse('\x1b');
            chai.expect(parser.currentState).equal(1);
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
            parser.currentState = 1;
            parser.parse(exes[i]);
            chai.expect(parser.currentState).equal(1);
            testTerminal.compare([['exe', exes[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('state ESCAPE ignore', function (): void {
        parser.reset();
        testTerminal.clear();
        parser.currentState = 1;
        parser.parse('\x7f');
        chai.expect(parser.currentState).equal(1);
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
            parser.currentState = 1;
            parser.parse(dispatches[i]);
            chai.expect(parser.currentState).equal(0);
            testTerminal.compare([['esc', '', dispatches[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('trans ESCAPE --> ESCAPE_INTERMEDIATE with collect action', function (): void {
        parser.reset();
        let collect = r(0x20, 0x30);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 1;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(2);
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
            parser.currentState = 2;
            parser.parse(exes[i]);
            chai.expect(parser.currentState).equal(2);
            testTerminal.compare([['exe', exes[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('state ESCAPE_INTERMEDIATE ignore', function (): void {
        parser.reset();
        testTerminal.clear();
        parser.currentState = 2;
        parser.parse('\x7f');
        chai.expect(parser.currentState).equal(2);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
    });
    it('state ESCAPE_INTERMEDIATE collect action', function (): void {
        parser.reset();
        let collect = r(0x20, 0x30);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 2;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(2);
            chai.expect(parser.collected).equal(collect[i]);
            parser.reset();
        }
    });
    it('trans ESCAPE_INTERMEDIATE --> GROUND with esc_dispatch action', function (): void {
        parser.reset();
        testTerminal.clear();
        let collect = r(0x30, 0x7f);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 2;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(0);
            testTerminal.compare([['esc', '', collect[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('trans ANYWHERE/ESCAPE --> CSI_ENTRY with clear', function (): void {
        parser.reset();
        // C0
        parser.currentState = 1;
        parser.osc = '#';
        parser.params = [123];
        parser.collected = '#';
        parser.parse('[');
        chai.expect(parser.currentState).equal(3);
        chai.expect(parser.osc).equal('');
        chai.expect(parser.params).eql([0]);
        chai.expect(parser.collected).equal('');
        parser.reset();
        // C1
        for (let state = 0; state < 14; ++state) {
            parser.currentState = state;
            parser.osc = '#';
            parser.params = [123];
            parser.collected = '#';
            parser.parse('\x9b');
            chai.expect(parser.currentState).equal(3);
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
            parser.currentState = 3;
            parser.parse(exes[i]);
            chai.expect(parser.currentState).equal(3);
            testTerminal.compare([['exe', exes[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('state CSI_ENTRY ignore', function (): void {
        parser.reset();
        testTerminal.clear();
        parser.currentState = 3;
        parser.parse('\x7f');
        chai.expect(parser.currentState).equal(3);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
    });
    it('trans CSI_ENTRY --> GROUND with csi_dispatch action', function (): void {
        parser.reset();
        let dispatches = r(0x40, 0x7f);
        for (let i = 0; i < dispatches.length; ++i) {
            parser.currentState = 3;
            parser.parse(dispatches[i]);
            chai.expect(parser.currentState).equal(0);
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
            parser.currentState = 3;
            parser.parse(params[i]);
            chai.expect(parser.currentState).equal(4);
            chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
            parser.reset();
        }
        // ';'
        parser.currentState = 3;
        parser.parse('\x3b');
        chai.expect(parser.currentState).equal(4);
        chai.expect(parser.params).eql([0, 0]);
        parser.reset();
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 3;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(4);
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
            parser.currentState = 4;
            parser.parse(exes[i]);
            chai.expect(parser.currentState).equal(4);
            testTerminal.compare([['exe', exes[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('state CSI_PARAM param action', function (): void {
        parser.reset();
        let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
        for (let i = 0; i < params.length; ++i) {
            parser.currentState = 4;
            parser.parse(params[i]);
            chai.expect(parser.currentState).equal(4);
            chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
            parser.reset();
        }
        parser.currentState = 4;
        parser.parse('\x3b');
        chai.expect(parser.currentState).equal(4);
        chai.expect(parser.params).eql([0, 0]);
        parser.reset();
    });
    it('state CSI_PARAM ignore', function (): void {
        parser.reset();
        testTerminal.clear();
        parser.currentState = 4;
        parser.parse('\x7f');
        chai.expect(parser.currentState).equal(4);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
    });
    it('trans CSI_PARAM --> GROUND with csi_dispatch action', function (): void {
        parser.reset();
        let dispatches = r(0x40, 0x7f);
        for (let i = 0; i < dispatches.length; ++i) {
            parser.currentState = 4;
            parser.params = [0, 1];
            parser.parse(dispatches[i]);
            chai.expect(parser.currentState).equal(0);
            testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('trans CSI_ENTRY --> CSI_INTERMEDIATE with collect action', function (): void {
        parser.reset();
        let collect = r(0x20, 0x30);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 3;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(5);
            chai.expect(parser.collected).equal(collect[i]);
            parser.reset();
        }
    });
    it('trans CSI_PARAM --> CSI_INTERMEDIATE with collect action', function (): void {
        parser.reset();
        let collect = r(0x20, 0x30);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 4;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(5);
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
            parser.currentState = 5;
            parser.parse(exes[i]);
            chai.expect(parser.currentState).equal(5);
            testTerminal.compare([['exe', exes[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('state CSI_INTERMEDIATE collect', function (): void {
        parser.reset();
        let collect = r(0x20, 0x30);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 5;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(5);
            chai.expect(parser.collected).equal(collect[i]);
            parser.reset();
        }
    });
    it('state CSI_INTERMEDIATE ignore', function (): void {
        parser.reset();
        testTerminal.clear();
        parser.currentState = 5;
        parser.parse('\x7f');
        chai.expect(parser.currentState).equal(5);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
    });
    it('trans CSI_INTERMEDIATE --> GROUND with csi_dispatch action', function (): void {
        parser.reset();
        let dispatches = r(0x40, 0x7f);
        for (let i = 0; i < dispatches.length; ++i) {
            parser.currentState = 5;
            parser.params = [0, 1];
            parser.parse(dispatches[i]);
            chai.expect(parser.currentState).equal(0);
            testTerminal.compare([['csi', '', [0, 1], dispatches[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('trans CSI_ENTRY --> CSI_IGNORE', function (): void {
        parser.reset();
        parser.currentState = 3;
        parser.parse('\x3a');
        chai.expect(parser.currentState).equal(6);
        parser.reset();
    });
    it('trans CSI_PARAM --> CSI_IGNORE', function (): void {
        parser.reset();
        let chars = ['\x3a', '\x3c', '\x3d', '\x3e', '\x3f'];
        for (let i = 0; i < chars.length; ++i) {
            parser.currentState = 4;
            parser.parse('\x3b' + chars[i]);
            chai.expect(parser.currentState).equal(6);
            chai.expect(parser.params).eql([0, 0]);
            parser.reset();
        }
    });
    it('trans CSI_INTERMEDIATE --> CSI_IGNORE', function (): void {
        parser.reset();
        let chars = r(0x30, 0x40);
        for (let i = 0; i < chars.length; ++i) {
            parser.currentState = 5;
            parser.parse(chars[i]);
            chai.expect(parser.currentState).equal(6);
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
            parser.currentState = 6;
            parser.parse(exes[i]);
            chai.expect(parser.currentState).equal(6);
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
            parser.currentState = 6;
            parser.parse(ignored[i]);
            chai.expect(parser.currentState).equal(6);
            testTerminal.compare([]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('trans CSI_IGNORE --> GROUND', function (): void {
        parser.reset();
        let dispatches = r(0x40, 0x7f);
        for (let i = 0; i < dispatches.length; ++i) {
            parser.currentState = 6;
            parser.params = [0, 1];
            parser.parse(dispatches[i]);
            chai.expect(parser.currentState).equal(0);
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
            chai.expect(parser.currentState).equal(7);
            parser.reset();
        }
        // C1
        for (let state = 0; state < 14; ++state) {
            parser.currentState = state;
            initializers = ['\x98', '\x9e', '\x9f'];
            for (let i = 0; i < initializers.length; ++i) {
                parser.parse(initializers[i]);
                chai.expect(parser.currentState).equal(7);
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
            parser.currentState = 7;
            parser.parse(ignored[i]);
            chai.expect(parser.currentState).equal(7);
            parser.reset();
        }
    });
    it('trans ANYWHERE/ESCAPE --> OSC_STRING', function (): void {
        parser.reset();
        // C0
        parser.parse('\x1b]');
        chai.expect(parser.currentState).equal(8);
        parser.reset();
        // C1
        for (let state = 0; state < 14; ++state) {
            parser.currentState = state;
            parser.parse('\x9d');
            chai.expect(parser.currentState).equal(8);
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
            parser.currentState = 8;
            parser.parse(ignored[i]);
            chai.expect(parser.currentState).equal(8);
            chai.expect(parser.osc).equal('');
            parser.reset();
        }
    });
    it('state OSC_STRING put action', function (): void {
        parser.reset();
        let puts = r(0x20, 0x80);
        for (let i = 0; i < puts.length; ++i) {
            parser.currentState = 8;
            parser.parse(puts[i]);
            chai.expect(parser.currentState).equal(8);
            chai.expect(parser.osc).equal(puts[i]);
            parser.reset();
        }
    });
    it('state DCS_ENTRY', function (): void {
        parser.reset();
        // C0
        parser.parse('\x1bP');
        chai.expect(parser.currentState).equal(9);
        parser.reset();
        // C1
        for (let state = 0; state < 14; ++state) {
            parser.currentState = state;
            parser.parse('\x90');
            chai.expect(parser.currentState).equal(9);
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
            parser.currentState = 9;
            parser.parse(ignored[i]);
            chai.expect(parser.currentState).equal(9);
            parser.reset();
        }
    });
    it('state DCS_ENTRY --> DCS_PARAM with param/collect actions', function (): void {
        parser.reset();
        let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
        let collect = ['\x3c', '\x3d', '\x3e', '\x3f'];
        for (let i = 0; i < params.length; ++i) {
            parser.currentState = 9;
            parser.parse(params[i]);
            chai.expect(parser.currentState).equal(10);
            chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
            parser.reset();
        }
        parser.currentState = 9;
        parser.parse('\x3b');
        chai.expect(parser.currentState).equal(10);
        chai.expect(parser.params).eql([0, 0]);
        parser.reset();
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 9;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(10);
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
            parser.currentState = 10;
            parser.parse(ignored[i]);
            chai.expect(parser.currentState).equal(10);
            parser.reset();
        }
    });
    it('state DCS_PARAM param action', function (): void {
        parser.reset();
        let params = ['\x30', '\x31', '\x32', '\x33', '\x34', '\x35', '\x36', '\x37', '\x38', '\x39'];
        for (let i = 0; i < params.length; ++i) {
            parser.currentState = 10;
            parser.parse(params[i]);
            chai.expect(parser.currentState).equal(10);
            chai.expect(parser.params).eql([params[i].charCodeAt(0) - 48]);
            parser.reset();
        }
        parser.currentState = 10;
        parser.parse('\x3b');
        chai.expect(parser.currentState).equal(10);
        chai.expect(parser.params).eql([0, 0]);
        parser.reset();
    });
    it('trans DCS_ENTRY --> DCS_IGNORE', function (): void {
        parser.reset();
        parser.currentState = 9;
        parser.parse('\x3a');
        chai.expect(parser.currentState).equal(11);
        parser.reset();
    });
    it('trans DCS_PARAM --> DCS_IGNORE', function (): void {
        parser.reset();
        let chars = ['\x3a', '\x3c', '\x3d', '\x3e', '\x3f'];
        for (let i = 0; i < chars.length; ++i) {
            parser.currentState = 10;
            parser.parse('\x3b' + chars[i]);
            chai.expect(parser.currentState).equal(11);
            chai.expect(parser.params).eql([0, 0]);
            parser.reset();
        }
    });
    it('trans DCS_INTERMEDIATE --> DCS_IGNORE', function (): void {
        parser.reset();
        let chars = r(0x30, 0x40);
        for (let i = 0; i < chars.length; ++i) {
            parser.currentState = 12;
            parser.parse(chars[i]);
            chai.expect(parser.currentState).equal(11);
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
            parser.currentState = 11;
            parser.parse(ignored[i]);
            chai.expect(parser.currentState).equal(11);
            parser.reset();
        }
    });
    it('trans DCS_ENTRY --> DCS_INTERMEDIATE with collect action', function (): void {
        parser.reset();
        let collect = r(0x20, 0x30);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 9;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(12);
            chai.expect(parser.collected).equal(collect[i]);
            parser.reset();
        }
    });
    it('trans DCS_PARAM --> DCS_INTERMEDIATE with collect action', function (): void {
        parser.reset();
        let collect = r(0x20, 0x30);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 10;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(12);
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
            parser.currentState = 12;
            parser.parse(ignored[i]);
            chai.expect(parser.currentState).equal(12);
            parser.reset();
        }
    });
    it('state DCS_INTERMEDIATE collect action', function (): void {
        parser.reset();
        let collect = r(0x20, 0x30);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 12;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(12);
            chai.expect(parser.collected).equal(collect[i]);
            parser.reset();
        }
    });
    it('trans DCS_INTERMEDIATE --> DCS_IGNORE', function (): void {
        parser.reset();
        let chars = r(0x30, 0x40);
        for (let i = 0; i < chars.length; ++i) {
            parser.currentState = 12;
            parser.parse('\x20' + chars[i]);
            chai.expect(parser.currentState).equal(11);
            chai.expect(parser.collected).equal('\x20');
            parser.reset();
        }
    });
    it('trans DCS_ENTRY --> DCS_PASSTHROUGH with hook', function (): void {
        parser.reset();
        testTerminal.clear();
        let collect = r(0x40, 0x7f);
        for (let i = 0; i < collect.length; ++i) {
            parser.currentState = 9;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(13);
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
            parser.currentState = 10;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(13);
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
            parser.currentState = 12;
            parser.parse(collect[i]);
            chai.expect(parser.currentState).equal(13);
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
            parser.currentState = 13;
            parser.parse(puts[i]);
            chai.expect(parser.currentState).equal(13);
            testTerminal.compare([['dcs put', puts[i]]]);
            parser.reset();
            testTerminal.clear();
        }
    });
    it('state DCS_PASSTHROUGH ignore', function (): void {
        parser.reset();
        testTerminal.clear();
        parser.currentState = 13;
        parser.parse('\x7f');
        chai.expect(parser.currentState).equal(13);
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
        parser.currentState = 6;
        parser.parse('€öäü');
        chai.expect(parser.currentState).equal(6);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
    });
    it('DCS_IGNORE error', function (): void {
        parser.reset();
        testTerminal.clear();
        parser.currentState = 11;
        parser.parse('€öäü');
        chai.expect(parser.currentState).equal(11);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
    });
    it('DCS_PASSTHROUGH error', function (): void {
        parser.reset();
        testTerminal.clear();
        parser.currentState = 13;
        parser.parse('€öäü');
        chai.expect(parser.currentState).equal(13);
        testTerminal.compare([['dcs put', '€öäü']]);
        parser.reset();
        testTerminal.clear();
    });
    it('error else of if (code > 159)', function (): void {
        parser.reset();
        testTerminal.clear();
        parser.currentState = 0;
        parser.parse('\x1e');
        chai.expect(parser.currentState).equal(0);
        testTerminal.compare([]);
        parser.reset();
        testTerminal.clear();
    });
});

let errorTerminal1 = function(): void {};
errorTerminal1.prototype = testTerminal;
let errTerminal1 = new errorTerminal1();
errTerminal1.inst_E = function(e: any): void {
    this.calls.push(['error', e]);
};
let errParser1 = new AnsiParser(errTerminal1);

let errorTerminal2 = function(): void {};
errorTerminal2.prototype = testTerminal;
let errTerminal2 = new errorTerminal2();
errTerminal2.inst_E = function(e: any): any {
    this.calls.push(['error', e]);
    return true;  // --> abort parsing
};
let errParser2 = new AnsiParser(errTerminal2);

describe('error tests', function(): void {
    it('CSI_PARAM unicode error - inst_E output w/o abort', function (): void {
        errParser1.parse('\x1b[<31;5€normal print');
        errTerminal1.compare([
            ['error', {
                pos: 7,
                character: '€',
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
    it('CSI_PARAM unicode error - inst_E output with abort', function (): void {
        errParser2.parse('\x1b[<31;5€no print');
        errTerminal2.compare([
            ['error', {
                pos: 7,
                character: '€',
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
