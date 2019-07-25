/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { perfContext, before, beforeEach, ThroughputRuntimeCase } from 'xterm-benchmark';

import { EscapeSequenceParser } from 'common/parser/EscapeSequenceParser';
import { C0, C1 } from 'common/data/EscapeSequences';
import { IDcsHandler, IParams } from 'common/parser/Types';
import { OscHandlerFactory } from 'common/parser/OscParser';


function toUtf32(s: string): Uint32Array {
  const result = new Uint32Array(s.length);
  for (let i = 0; i < s.length; ++i) {
    result[i] = s.charCodeAt(i);
  }
  return result;
}

class DcsHandler implements IDcsHandler {
  hook(collect: string, params: IParams, flag: number) : void {}
  put(data: Uint32Array, start: number, end: number) : void {}
  unhook() :void {}
}


perfContext('Parser throughput - 50MB data', () => {
  let parsed: Uint32Array;
  let parser: EscapeSequenceParser;
  
  beforeEach(() => {
    parser = new EscapeSequenceParser();
    parser.setPrintHandler((data, start, end) => {});
    parser.setCsiHandler('@', (params, collect) => {});
    parser.setCsiHandler('A', (params, collect) => {});
    parser.setCsiHandler('B', (params, collect) => {});
    parser.setCsiHandler('C', (params, collect) => {});
    parser.setCsiHandler('D', (params, collect) => {});
    parser.setCsiHandler('E', (params, collect) => {});
    parser.setCsiHandler('F', (params, collect) => {});
    parser.setCsiHandler('G', (params, collect) => {});
    parser.setCsiHandler('H', (params, collect) => {});
    parser.setCsiHandler('I', (params, collect) => {});
    parser.setCsiHandler('J', (params, collect) => {});
    parser.setCsiHandler('K', (params, collect) => {});
    parser.setCsiHandler('L', (params, collect) => {});
    parser.setCsiHandler('M', (params, collect) => {});
    parser.setCsiHandler('P', (params, collect) => {});
    parser.setCsiHandler('S', (params, collect) => {});
    parser.setCsiHandler('T', (params, collect) => {});
    parser.setCsiHandler('X', (params, collect) => {});
    parser.setCsiHandler('Z', (params, collect) => {});
    parser.setCsiHandler('`', (params, collect) => {});
    parser.setCsiHandler('a', (params, collect) => {});
    parser.setCsiHandler('b', (params, collect) => {});
    parser.setCsiHandler('c', (params, collect) => {});
    parser.setCsiHandler('d', (params, collect) => {});
    parser.setCsiHandler('e', (params, collect) => {});
    parser.setCsiHandler('f', (params, collect) => {});
    parser.setCsiHandler('g', (params, collect) => {});
    parser.setCsiHandler('h', (params, collect) => {});
    parser.setCsiHandler('l', (params, collect) => {});
    parser.setCsiHandler('m', (params, collect) => {});
    parser.setCsiHandler('n', (params, collect) => {});
    parser.setCsiHandler('p', (params, collect) => {});
    parser.setCsiHandler('q', (params, collect) => {});
    parser.setCsiHandler('r', (params, collect) => {});
    parser.setCsiHandler('s', (params, collect) => {});
    parser.setCsiHandler('u', (params, collect) => {});
    parser.setExecuteHandler(C0.BEL, () => {});
    parser.setExecuteHandler(C0.LF, () => {});
    parser.setExecuteHandler(C0.VT, () => {});
    parser.setExecuteHandler(C0.FF, () => {});
    parser.setExecuteHandler(C0.CR, () => {});
    parser.setExecuteHandler(C0.BS, () => {});
    parser.setExecuteHandler(C0.HT, () => {});
    parser.setExecuteHandler(C0.SO, () => {});
    parser.setExecuteHandler(C0.SI, () => {});
    parser.setExecuteHandler(C1.IND, () => {});
    parser.setExecuteHandler(C1.NEL, () => {});
    parser.setExecuteHandler(C1.HTS, () => {});
    parser.setOscHandler(0, new OscHandlerFactory((data) => {}));
    parser.setOscHandler(2, new OscHandlerFactory((data) => {}));
    parser.setEscHandler('7', () => {});
    parser.setEscHandler('8', () => {});
    parser.setEscHandler('D', () => {});
    parser.setEscHandler('E', () => {});
    parser.setEscHandler('H', () => {});
    parser.setEscHandler('M', () => {});
    parser.setEscHandler('=', () => {});
    parser.setEscHandler('>', () => {});
    parser.setEscHandler('c', () => {});
    parser.setEscHandler('n', () => {});
    parser.setEscHandler('o', () => {});
    parser.setEscHandler('|', () => {});
    parser.setEscHandler('}', () => {});
    parser.setEscHandler('~', () => {});
    parser.setEscHandler('%@', () => {});
    parser.setEscHandler('%G', () => {});
    parser.setDcsHandler('q', new DcsHandler());
  });

  perfContext('PRINT - a', () => {
    before(() => {
      const data = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', async () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('EXECUTE - \\n', () => {
    before(() => {
      const data = '\n\n\n\n\n\n\n';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('ESCAPE - ESC E', () => {
    before(() => {
      const data = '\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('ESCAPE with collect - ESC % G', () => {
    before(() => {
      const data = '\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('CSI - CSI A', () => {
    before(() => {
      const data = '\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('CSI with collect - CSI ? p', () => {
    before(() => {
      const data = '\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('CSI with params (short) - CSI 1;2 m', () => {
    before(() => {
      const data = '\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('CSI with params (long) - CSI 1;2;3;4;5;6;7;8;9;0 m', () => {
    before(() => {
      const data = '\x1b[1;2;3;4;5;6;7;8;9;0m\x1b[1;2;3;4;5;6;7;8;9;0m\x1b[1;2;3;4;5;6;7;8;9;0m';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('OSC (short) - OSC 0;hi ST', () => {
    before(() => {
      const data = '\x1b]0;hi\x1b\\\x1b]0;hi\x1b\\\x1b]0;hi\x1b\\\x1b]0;hi\x1b\\x1b]0;hi\x1b\\';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('OSC (long) - OSC 0;<text> ST', () => {
    before(() => {
      const data = '\x1b]0;Lorem ipsum dolor sit amet, consetetur sadipscing elitr.\x1b\\';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('DCS (short)', () => {
    before(() => {
      const data = '\x1bPq~~\x1b\\';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', async () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('DCS (long)', () => {
    before(() => {
      const data = '\x1bPq#0;2;0;0;0#1;2;100;100;0#2;2;0;100;0#1~~@@vv@@~~@@~~$#2??}}GG}}??}}??-#1!14@\x1b\\';
      let content = '';
      while (content.length < 50000000) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', async () => {
      parser.parse(parsed, parsed.length);
      return {payloadSize: parsed.length};
    }, {fork: true}).showAverageThroughput();
  });
});
