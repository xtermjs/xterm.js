import { perfContext, before, beforeEach, ThroughputRuntimeCase } from 'xterm-benchmark';

import { EscapeSequenceParser } from 'core/parser/EscapeSequenceParser';
import { C0, C1 } from 'common/data/EscapeSequences';
import { IDcsHandler } from './Types';


function toUtf32(s: string) {
  const result = new Uint32Array(s.length);
  for (let i = 0; i < s.length; ++i) {
    result[i] = s.charCodeAt(i);
  }
  return result;
}


perfContext('Parser performance - 50MB data', () => {
  let content;
  let taContent: Uint32Array;
  let parser: EscapeSequenceParser;
  let dcsHandler: IDcsHandler = {
    hook: (collect, params, flag) => {},
    put: (data, start, end) => {},
    unhook: () => {}
  };
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
    parser.setOscHandler(0, (data) => {});
    parser.setOscHandler(2, (data) => {});
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
    parser.setDcsHandler('q', dcsHandler);
  });

  perfContext('print - a', () => {
    before(() => {
      let data = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', async () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('execute - \\n', () => {
    before(() => {
      let data = '\n\n\n\n\n\n\n';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('escape - ESC E', () => {
    before(() => {
      let data = '\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE\x1bE';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('escape with collect - ESC % G', () => {
    before(() => {
      let data = '\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G\x1b%G';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('simple csi - CSI A', () => {
    before(() => {
      let data = '\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A\x1b[A';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('csi with collect - CSI ? p', () => {
    before(() => {
      let data = '\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p\x1b[?p';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('csi with params - CSI 1;2 m', () => {
    before(() => {
      let data = '\x1b{1;2m\x1b{1;2m\x1b{1;2m\x1b{1;2m\x1b{1;2m\x1b{1;2m\x1b{1;2m\x1b{1;2m\x1b{1;2m\x1b{1;2m';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('osc (small payload) - OSC 0;hi ST', () => {
    before(() => {
      let data = '\x1b]0;hi\x1b\\\x1b]0;hi\x1b\\\x1b]0;hi\x1b\\\x1b]0;hi\x1b\\x1b]0;hi\x1b\\';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('osc (big payload) - OSC 0;<text> ST', () => {
    before(() => {
      let data = '\x1b]0;Lorem ipsum dolor sit amet, consetetur sadipscing elitr.\x1b\\';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('DCS (small payload)', () => {
    before(() => {
      let data = '\x1bPq~~\x1b\\';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', async () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });

  perfContext('DCS (big payload)', () => {
    before(() => {
      let data = '\x1bPq#0;2;0;0;0#1;2;100;100;0#2;2;0;100;0#1~~@@vv@@~~@@~~$#2??}}GG}}??}}??-#1!14@\x1b\\';
      content = '';
      while (content.length < 50000000)
        content += data;
      taContent = toUtf32(content);
    });
    new ThroughputRuntimeCase('throughput', async () => {
      parser.parse(taContent, taContent.length);
      return {payloadSize: taContent.length};
    }, {fork: true}).showAverageThroughput();
  });
});
