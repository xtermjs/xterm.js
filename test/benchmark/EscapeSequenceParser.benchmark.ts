/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { perfContext, before, beforeEach, ThroughputRuntimeCase } from 'xterm-benchmark';

import { EscapeSequenceParser } from 'common/parser/EscapeSequenceParser';
import { C0, C1 } from 'common/data/EscapeSequences';
import { IDcsHandler, IOscHandler, IParams } from 'common/parser/Types';
import { OscHandler } from 'common/parser/OscParser';
import { DcsHandler } from '../../out/common/parser/DcsParser';

const SIZE = 5000000;

function toUtf32(s: string): Uint32Array {
  const result = new Uint32Array(s.length);
  for (let i = 0; i < s.length; ++i) {
    result[i] = s.charCodeAt(i);
  }
  return result;
}

class FastDcsHandler implements IDcsHandler {
  public hook(params: IParams): void {}
  public put(data: Uint32Array, start: number, end: number): void {}
  public unhook(success: boolean): boolean { return true; }
}

class FastOscHandler implements IOscHandler {
  public start(): void {}
  public put(data: Uint32Array, start: number, end: number): void {}
  public end(success: boolean): boolean { return true; }
}


perfContext('Parser throughput - 50MB data', () => {
  let parsed: Uint32Array;
  let parser: EscapeSequenceParser;

  beforeEach(() => {
    parser = new EscapeSequenceParser();
    parser.setPrintHandler((data, start, end) => {});
    parser.registerCsiHandler({ final: '@' }, params => true);
    parser.registerCsiHandler({ final: 'A' }, params => true);
    parser.registerCsiHandler({ final: 'B' }, params => true);
    parser.registerCsiHandler({ final: 'C' }, params => true);
    parser.registerCsiHandler({ final: 'D' }, params => true);
    parser.registerCsiHandler({ final: 'E' }, params => true);
    parser.registerCsiHandler({ final: 'F' }, params => true);
    parser.registerCsiHandler({ final: 'G' }, params => true);
    parser.registerCsiHandler({ final: 'H' }, params => true);
    parser.registerCsiHandler({ final: 'I' }, params => true);
    parser.registerCsiHandler({ final: 'J' }, params => true);
    parser.registerCsiHandler({ final: 'K' }, params => true);
    parser.registerCsiHandler({ final: 'L' }, params => true);
    parser.registerCsiHandler({ final: 'M' }, params => true);
    parser.registerCsiHandler({ final: 'P' }, params => true);
    parser.registerCsiHandler({ final: 'S' }, params => true);
    parser.registerCsiHandler({ final: 'T' }, params => true);
    parser.registerCsiHandler({ final: 'X' }, params => true);
    parser.registerCsiHandler({ final: 'Z' }, params => true);
    parser.registerCsiHandler({ final: '`' }, params => true);
    parser.registerCsiHandler({ final: 'a' }, params => true);
    parser.registerCsiHandler({ final: 'b' }, params => true);
    parser.registerCsiHandler({ final: 'c' }, params => true);
    parser.registerCsiHandler({ final: 'd' }, params => true);
    parser.registerCsiHandler({ final: 'e' }, params => true);
    parser.registerCsiHandler({ final: 'f' }, params => true);
    parser.registerCsiHandler({ final: 'g' }, params => true);
    parser.registerCsiHandler({ final: 'h' }, params => true);
    parser.registerCsiHandler({ final: 'l' }, params => true);
    parser.registerCsiHandler({ final: 'm' }, params => true);
    parser.registerCsiHandler({ final: 'n' }, params => true);
    parser.registerCsiHandler({ final: 'p' }, params => true);
    parser.registerCsiHandler({ final: 'q' }, params => true);
    parser.registerCsiHandler({ final: 'r' }, params => true);
    parser.registerCsiHandler({ final: 's' }, params => true);
    parser.registerCsiHandler({ final: 'u' }, params => true);
    parser.setExecuteHandler(C0.BEL, () => true);
    parser.setExecuteHandler(C0.LF, () => true);
    parser.setExecuteHandler(C0.VT, () => true);
    parser.setExecuteHandler(C0.FF, () => true);
    parser.setExecuteHandler(C0.CR, () => true);
    parser.setExecuteHandler(C0.BS, () => true);
    parser.setExecuteHandler(C0.HT, () => true);
    parser.setExecuteHandler(C0.SO, () => true);
    parser.setExecuteHandler(C0.SI, () => true);
    parser.setExecuteHandler(C1.IND, () => true);
    parser.setExecuteHandler(C1.NEL, () => true);
    parser.setExecuteHandler(C1.HTS, () => true);
    parser.registerOscHandler(0, new OscHandler(data => true));
    parser.registerOscHandler(1, new FastOscHandler());
    parser.registerEscHandler({ final: '7' }, () => true);
    parser.registerEscHandler({ final: '8' }, () => true);
    parser.registerEscHandler({ final: 'D' }, () => true);
    parser.registerEscHandler({ final: 'E' }, () => true);
    parser.registerEscHandler({ final: 'H' }, () => true);
    parser.registerEscHandler({ final: 'M' }, () => true);
    parser.registerEscHandler({ final: '=' }, () => true);
    parser.registerEscHandler({ final: '>' }, () => true);
    parser.registerEscHandler({ final: 'c' }, () => true);
    parser.registerEscHandler({ final: 'n' }, () => true);
    parser.registerEscHandler({ final: 'o' }, () => true);
    parser.registerEscHandler({ final: '|' }, () => true);
    parser.registerEscHandler({ final: '}' }, () => true);
    parser.registerEscHandler({ final: '~' }, () => true);
    parser.registerEscHandler({ intermediates: '%', final: '@' }, () => true);
    parser.registerEscHandler({ intermediates: '%', final: 'G' }, () => true);
    parser.registerDcsHandler({ final: 'p' }, new DcsHandler(data => true));
    parser.registerDcsHandler({ final: 'q' }, new FastDcsHandler());
  });

  perfContext('PRINT - a', () => {
    before(() => {
      const data = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', async () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('EXECUTE - \\n', () => {
    before(() => {
      const data = '\n\n\n\n\n\n\n';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('ESCAPE - ESC E', () => {
    before(() => {
      const data = '\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('ESCAPE with collect - ESC % G', () => {
    before(() => {
      const data = '\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('CSI - CSI A', () => {
    before(() => {
      const data = '\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('CSI with collect - CSI ? p', () => {
    before(() => {
      const data = '\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('CSI with params (short) - CSI 1;2 m', () => {
    before(() => {
      const data = '\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m\x1b[1;2m';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('CSI with params (long) - CSI 1;2;3;4;5;6;7;8;9;0 m', () => {
    before(() => {
      const data = '\x1b[1;2;3;4;5;6;7;8;9;0m\x1b[1;2;3;4;5;6;7;8;9;0m\x1b[1;2;3;4;5;6;7;8;9;0m';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('OSC string interface (short seq) - OSC 0;hi ST', () => {
    before(() => {
      const data = '\x1b]0;hi\x1b\\\x1b]0;hi\x1b\\\x1b]0;hi\x1b\\\x1b]0;hi\x1b\\x1b]0;hi\x1b\\';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('OSC string interface (long seq) - OSC 0;<text> ST', () => {
    before(() => {
      const data = '\x1b]0;Lorem ipsum dolor sit amet, consetetur sadipscing elitr.\x1b\\';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('OSC class interface (short seq) - OSC 0;hi ST', () => {
    before(() => {
      const data = '\x1b]1;hi\x1b\\\x1b]1;hi\x1b\\\x1b]1;hi\x1b\\\x1b]1;hi\x1b\\x1b]1;hi\x1b\\';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('OSC class interface (long seq) - OSC 0;<text> ST', () => {
    before(() => {
      const data = '\x1b]1;Lorem ipsum dolor sit amet, consetetur sadipscing elitr.\x1b\\';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('DCS string interface (short seq)', () => {
    before(() => {
      const data = '\x1bPphi\x1b\\\x1bPphi\x1b\\\x1bPphi\x1b\\\x1bPphi\x1b\\\x1bPphi\x1b\\';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', async () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('DCS string interface (long seq)', () => {
    before(() => {
      const data = '\x1bPpLorem ipsum dolor sit amet, consetetur sadipscing elitr.\x1b\\';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', async () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('DCS class interface (short seq)', () => {
    before(() => {
      const data = '\x1bPqhi\x1b\\\x1bPqhi\x1b\\\x1bPqhi\x1b\\\x1bPqhi\x1b\\\x1bPqhi\x1b\\';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', async () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });

  perfContext('DCS class interface (long seq)', () => {
    before(() => {
      const data = '\x1bPqLorem ipsum dolor sit amet, consetetur sadipscing elitr.\x1b\\';
      let content = '';
      while (content.length < SIZE) {
        content += data;
      }
      parsed = toUtf32(content);
    });
    new ThroughputRuntimeCase('', async () => {
      parser.parse(parsed, parsed.length);
      return { payloadSize: parsed.length };
    }, { fork: true }).showAverageThroughput();
  });
});
