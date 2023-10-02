/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { perfContext, before, ThroughputRuntimeCase } from 'xterm-benchmark';

import { spawn } from 'node-pty';
import { Utf8ToUtf32, stringFromCodePoint } from 'common/input/TextDecoder';
import { Terminal } from 'browser/public/Terminal';
import { SerializeAddon } from 'SerializeAddon';

class TestTerminal extends Terminal {
  public writeSync(data: string): void {
    (this as any)._core.writeSync(data);
  }
}

perfContext('Terminal: sh -c "dd if=/dev/urandom count=40 bs=1k | hexdump | lolcat -f"', () => {
  let content = '';
  let contentUtf8: Uint8Array;

  before(async () => {
    const p = spawn('sh', ['-c', 'dd if=/dev/urandom count=40 bs=1k | hexdump | lolcat -f'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 25,
      cwd: process.env.HOME,
      env: process.env,
      encoding: (null as unknown as string) // needs to be fixed in node-pty
    });
    const chunks: Buffer[] = [];
    let length = 0;
    p.onData(data => {
      chunks.push(data as unknown as Buffer);
      length += data.length;
    });
    await new Promise<void>(resolve => p.onExit(() => resolve()));
    contentUtf8 = Buffer.concat(chunks, length);
    // translate to content string
    const buffer = new Uint32Array(contentUtf8.length);
    const decoder = new Utf8ToUtf32();
    const codepoints = decoder.decode(contentUtf8, buffer);
    for (let i = 0; i < codepoints; ++i) {
      content += stringFromCodePoint(buffer[i]);
      // peek into content to force flat repr in v8
      if (!(i % 10000000)) {
        content[i];
      }
    }
  });

  perfContext('serialize', () => {
    let terminal: TestTerminal;
    const serializeAddon = new SerializeAddon();
    before(() => {
      terminal = new TestTerminal({ cols: 80, rows: 25, scrollback: 5000 });
      serializeAddon.activate(terminal);
      terminal.writeSync(content);
    });
    new ThroughputRuntimeCase('', () => {
      return { payloadSize: serializeAddon.serialize().length };
    }, { fork: false }).showAverageThroughput();
  });
});
