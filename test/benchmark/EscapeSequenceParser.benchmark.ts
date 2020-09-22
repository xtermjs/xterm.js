/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { perfContext, before, beforeEach, ThroughputRuntimeCase } from 'xterm-benchmark';

import { EscapeSequenceParser } from 'common/parser/EscapeSequenceParser';
import { C0, C1 } from 'common/data/EscapeSequences';
import { IDcsHandler, IParams } from 'common/parser/Types';
import { OscHandler } from 'common/parser/OscParser';


function toUtf32(s: string): Uint32Array {
  const result = new Uint32Array(s.length);
  for (let i = 0; i < s.length; ++i) {
    result[i] = s.charCodeAt(i);
  }
  return result;
}

class DcsHandler implements IDcsHandler {
  public hook(params: IParams): void {}
  public put(data: Uint32Array, start: number, end: number): void {}
  public unhook(): void {}
}


perfContext('Parser throughput - 50MB data', () => {
  let parsed: Uint32Array;
  let parser: EscapeSequenceParser;

  beforeEach(() => {
    parser = new EscapeSequenceParser();
    parser.setPrintHandler((data, start, end) => {});
    parser.setCsiHandler({final: '@'}, params => {});
    parser.setCsiHandler({final: 'A'}, params => {});
    parser.setCsiHandler({final: 'B'}, params => {});
    parser.setCsiHandler({final: 'C'}, params => {});
    parser.setCsiHandler({final: 'D'}, params => {});
    parser.setCsiHandler({final: 'E'}, params => {});
    parser.setCsiHandler({final: 'F'}, params => {});
    parser.setCsiHandler({final: 'G'}, params => {});
    parser.setCsiHandler({final: 'H'}, params => {});
    parser.setCsiHandler({final: 'I'}, params => {});
    parser.setCsiHandler({final: 'J'}, params => {});
    parser.setCsiHandler({final: 'K'}, params => {});
    parser.setCsiHandler({final: 'L'}, params => {});
    parser.setCsiHandler({final: 'M'}, params => {});
    parser.setCsiHandler({final: 'P'}, params => {});
    parser.setCsiHandler({final: 'S'}, params => {});
    parser.setCsiHandler({final: 'T'}, params => {});
    parser.setCsiHandler({final: 'X'}, params => {});
    parser.setCsiHandler({final: 'Z'}, params => {});
    parser.setCsiHandler({final: '`'}, params => {});
    parser.setCsiHandler({final: 'a'}, params => {});
    parser.setCsiHandler({final: 'b'}, params => {});
    parser.setCsiHandler({final: 'c'}, params => {});
    parser.setCsiHandler({final: 'd'}, params => {});
    parser.setCsiHandler({final: 'e'}, params => {});
    parser.setCsiHandler({final: 'f'}, params => {});
    parser.setCsiHandler({final: 'g'}, params => {});
    parser.setCsiHandler({final: 'h'}, params => {});
    parser.setCsiHandler({final: 'l'}, params => {});
    parser.setCsiHandler({final: 'm'}, params => {});
    parser.setCsiHandler({final: 'n'}, params => {});
    parser.setCsiHandler({final: 'p'}, params => {});
    parser.setCsiHandler({final: 'q'}, params => {});
    parser.setCsiHandler({final: 'r'}, params => {});
    parser.setCsiHandler({final: 's'}, params => {});
    parser.setCsiHandler({final: 'u'}, params => {});
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
    parser.setOscHandler(0, new OscHandler((data) => {}));
    parser.setOscHandler(2, new OscHandler((data) => {}));
    parser.setEscHandler({final: '7'}, () => {});
    parser.setEscHandler({final: '8'}, () => {});
    parser.setEscHandler({final: 'D'}, () => {});
    parser.setEscHandler({final: 'E'}, () => {});
    parser.setEscHandler({final: 'H'}, () => {});
    parser.setEscHandler({final: 'M'}, () => {});
    parser.setEscHandler({final: '='}, () => {});
    parser.setEscHandler({final: '>'}, () => {});
    parser.setEscHandler({final: 'c'}, () => {});
    parser.setEscHandler({final: 'n'}, () => {});
    parser.setEscHandler({final: 'o'}, () => {});
    parser.setEscHandler({final: '|'}, () => {});
    parser.setEscHandler({final: '}'}, () => {});
    parser.setEscHandler({final: '~'}, () => {});
    parser.setEscHandler({intermediates: '%', final: '@'}, () => {});
    parser.setEscHandler({intermediates: '%', final: 'G'}, () => {});
    parser.setDcsHandler({final: 'q'}, new DcsHandler());
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
