/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { perfContext, before, RuntimeCase } from 'xterm-benchmark';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Terminal } from 'browser/public/Terminal';
import { SearchAddon } from 'SearchAddon';
import type { ISearchOptions } from '@xterm/addon-search';

const enum Constants {
  COLS = 120,
  ROWS = 40,
  SCROLLBACK = 8000,
  NAVIGATION_ITERATIONS = 250,
  COLD_CACHE_ITERATIONS = 75,
  INCREMENTAL_ITERATIONS = 75,
  DECORATION_REFRESH_ITERATIONS = 25
}

const DECORATION_OPTIONS: ISearchOptions = {
  decorations: {
    activeMatchBackground: '#0000ff',
    activeMatchColorOverviewRuler: '#ff0000',
    matchBackground: '#ffff00',
    matchBorder: '#000000',
    matchOverviewRuler: '#00ffff'
  }
};

class TestTerminal extends Terminal {
  public writeSync(data: string): void {
    (this as any)._core.writeSync(data);
  }

  public override select(_column: number, _row: number, _length: number): void {
    // SearchAddon always selects matches; skip selection internals in headless benchmark runs.
  }

  public override clearSelection(): void {
    // SearchAddon clears the previous selection before selecting another match.
  }

  public override scrollLines(_amount: number): void {
    // No viewport scrolling is needed for API runtime measurement.
  }
}

function buildRealWorldBuffer(): string {
  const fixture = readFileSync(resolve(__dirname, '../../fixtures/issue-2444'), 'utf8')
    .replace(/\r?\n/g, '\r\n');
  const lines: string[] = [fixture];
  for (let i = 0; i < 2500; i++) {
    const minute = (i % 60).toString().padStart(2, '0');
    const second = ((i * 7) % 60).toString().padStart(2, '0');
    lines.push(`2026-05-25T16:${minute}:${second}Z INFO  [api-${i % 8}] requestId=req-${i.toString(16).padStart(6, '0')} path=/v1/projects/${i % 120}/search?q=opencv status=200 durationMs=${10 + (i % 90)}`);
    if (i % 5 === 0) {
      lines.push(`2026-05-25T16:${minute}:${second}Z WARN  [worker-${i % 4}] slow query detected query="SELECT * FROM runs WHERE status='pending'" elapsedMs=${500 + (i % 1200)}`);
    }
    if (i % 11 === 0) {
      lines.push(`2026-05-25T16:${minute}:${second}Z ERROR [worker-${i % 4}] command failed: package.json parse error at column ${10 + (i % 70)}; retrying in ${2 + (i % 7)}s`);
    }
    if (i % 17 === 0) {
      lines.push(`https://example.internal/run/${i}/details?source=terminal-search&state=error`);
    }
  }
  return lines.join('\r\n') + '\r\n';
}

perfContext('SearchAddon API on real-world terminal content', () => {
  const bufferContent = buildRealWorldBuffer();

  perfContext('findNext/plain navigation', () => {
    let terminal: TestTerminal;
    let search: SearchAddon;
    before(() => {
      terminal = new TestTerminal({ cols: Constants.COLS, rows: Constants.ROWS, scrollback: Constants.SCROLLBACK });
      search = new SearchAddon();
      search.activate(terminal);
      terminal.writeSync(bufferContent);
    });
    new RuntimeCase('', () => {
      let foundCount = 0;
      for (let i = 0; i < Constants.NAVIGATION_ITERATIONS; i++) {
        if (search.findNext('opencv')) {
          foundCount++;
        }
      }
      if (foundCount !== Constants.NAVIGATION_ITERATIONS) {
        throw new Error(`Expected ${Constants.NAVIGATION_ITERATIONS} matches, got ${foundCount}`);
      }
      return { payloadSize: Constants.NAVIGATION_ITERATIONS, foundCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('findNext/no match full scan', () => {
    let terminal: TestTerminal;
    let search: SearchAddon;
    before(() => {
      terminal = new TestTerminal({ cols: Constants.COLS, rows: Constants.ROWS, scrollback: Constants.SCROLLBACK });
      search = new SearchAddon();
      search.activate(terminal);
      terminal.writeSync(bufferContent);
    });
    new RuntimeCase('', () => {
      let foundCount = 0;
      for (let i = 0; i < Constants.NAVIGATION_ITERATIONS; i++) {
        if (search.findNext('zzzznotfoundzzzz')) {
          foundCount++;
        }
      }
      if (foundCount !== 0) {
        throw new Error(`Expected 0 matches, got ${foundCount}`);
      }
      return { payloadSize: Constants.NAVIGATION_ITERATIONS, foundCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('findNext/case insensitive navigation', () => {
    let terminal: TestTerminal;
    let search: SearchAddon;
    before(() => {
      terminal = new TestTerminal({ cols: Constants.COLS, rows: Constants.ROWS, scrollback: Constants.SCROLLBACK });
      search = new SearchAddon();
      search.activate(terminal);
      terminal.writeSync(bufferContent);
    });
    new RuntimeCase('', () => {
      let foundCount = 0;
      for (let i = 0; i < Constants.NAVIGATION_ITERATIONS; i++) {
        if (search.findNext('OPENCV', { caseSensitive: false })) {
          foundCount++;
        }
      }
      if (foundCount !== Constants.NAVIGATION_ITERATIONS) {
        throw new Error(`Expected ${Constants.NAVIGATION_ITERATIONS} matches, got ${foundCount}`);
      }
      return { payloadSize: Constants.NAVIGATION_ITERATIONS, foundCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('findNext/regex navigation', () => {
    let terminal: TestTerminal;
    let search: SearchAddon;
    before(() => {
      terminal = new TestTerminal({ cols: Constants.COLS, rows: Constants.ROWS, scrollback: Constants.SCROLLBACK });
      search = new SearchAddon();
      search.activate(terminal);
      terminal.writeSync(bufferContent);
    });
    new RuntimeCase('', () => {
      let foundCount = 0;
      for (let i = 0; i < Constants.NAVIGATION_ITERATIONS; i++) {
        if (search.findNext('https://example\\.internal/run/\\d+/details\\?source=terminal-search', { regex: true })) {
          foundCount++;
        }
      }
      if (foundCount !== Constants.NAVIGATION_ITERATIONS) {
        throw new Error(`Expected ${Constants.NAVIGATION_ITERATIONS} matches, got ${foundCount}`);
      }
      return { payloadSize: Constants.NAVIGATION_ITERATIONS, foundCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('findPrevious/incremental typing flow', () => {
    let terminal: TestTerminal;
    let search: SearchAddon;
    const terms = ['e', 'er', 'err', 'erro', 'error'];
    before(() => {
      terminal = new TestTerminal({ cols: Constants.COLS, rows: Constants.ROWS, scrollback: Constants.SCROLLBACK });
      search = new SearchAddon();
      search.activate(terminal);
      terminal.writeSync(bufferContent);
    });
    new RuntimeCase('', () => {
      let foundCount = 0;
      for (let i = 0; i < Constants.INCREMENTAL_ITERATIONS; i++) {
        for (const term of terms) {
          if (search.findPrevious(term, { incremental: true })) {
            foundCount++;
          }
        }
      }
      return { payloadSize: Constants.INCREMENTAL_ITERATIONS * terms.length, foundCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('findNext/cold cache', () => {
    let terminal: TestTerminal;
    let search: SearchAddon;
    before(() => {
      terminal = new TestTerminal({ cols: Constants.COLS, rows: Constants.ROWS, scrollback: Constants.SCROLLBACK });
      search = new SearchAddon();
      search.activate(terminal);
      terminal.writeSync(bufferContent);
    });
    new RuntimeCase('', () => {
      let foundCount = 0;
      for (let i = 0; i < Constants.COLD_CACHE_ITERATIONS; i++) {
        // Force a fresh logical-line reconstruction and match scan each search.
        (search as any)._clearMatchCache();
        if (search.findNext('opencv')) {
          foundCount++;
        }
      }
      if (foundCount !== Constants.COLD_CACHE_ITERATIONS) {
        throw new Error(`Expected ${Constants.COLD_CACHE_ITERATIONS} matches, got ${foundCount}`);
      }
      return { payloadSize: Constants.COLD_CACHE_ITERATIONS, foundCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('findNext/wholeWord dense-punctuation', () => {
    let terminal: TestTerminal;
    let search: SearchAddon;
    before(() => {
      terminal = new TestTerminal({ cols: Constants.COLS, rows: Constants.ROWS, scrollback: Constants.SCROLLBACK });
      search = new SearchAddon();
      search.activate(terminal);
      terminal.writeSync(bufferContent);
    });
    new RuntimeCase('', () => {
      let foundCount = 0;
      for (let i = 0; i < Constants.NAVIGATION_ITERATIONS; i++) {
        if (search.findNext('error', { wholeWord: true })) {
          foundCount++;
        }
      }
      if (foundCount !== Constants.NAVIGATION_ITERATIONS) {
        throw new Error(`Expected ${Constants.NAVIGATION_ITERATIONS} matches, got ${foundCount}`);
      }
      return { payloadSize: Constants.NAVIGATION_ITERATIONS, foundCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('findPrevious/regex wholeWord reverse', () => {
    let terminal: TestTerminal;
    let search: SearchAddon;
    before(() => {
      terminal = new TestTerminal({ cols: Constants.COLS, rows: Constants.ROWS, scrollback: Constants.SCROLLBACK });
      search = new SearchAddon();
      search.activate(terminal);
      terminal.writeSync(bufferContent);
    });
    new RuntimeCase('', () => {
      let foundCount = 0;
      for (let i = 0; i < Constants.NAVIGATION_ITERATIONS; i++) {
        if (search.findPrevious('error', { regex: true, wholeWord: true })) {
          foundCount++;
        }
      }
      if (foundCount !== Constants.NAVIGATION_ITERATIONS) {
        throw new Error(`Expected ${Constants.NAVIGATION_ITERATIONS} matches, got ${foundCount}`);
      }
      return { payloadSize: Constants.NAVIGATION_ITERATIONS, foundCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('findNext/decorations refresh', () => {
    let terminal: TestTerminal;
    let search: SearchAddon;
    before(() => {
      terminal = new TestTerminal({ cols: Constants.COLS, rows: Constants.ROWS, scrollback: Constants.SCROLLBACK });
      search = new SearchAddon({ highlightLimit: 1500 });
      search.activate(terminal);
      terminal.writeSync(bufferContent);
    });
    new RuntimeCase('', () => {
      let foundCount = 0;
      for (let i = 0; i < Constants.DECORATION_REFRESH_ITERATIONS; i++) {
        const term = i % 2 === 0 ? 'WARN' : 'ERROR';
        if (search.findNext(term, DECORATION_OPTIONS)) {
          foundCount++;
        }
      }
      if (foundCount !== Constants.DECORATION_REFRESH_ITERATIONS) {
        throw new Error(`Expected ${Constants.DECORATION_REFRESH_ITERATIONS} matches, got ${foundCount}`);
      }
      return { payloadSize: Constants.DECORATION_REFRESH_ITERATIONS, foundCount };
    }, { fork: false }).showAverageRuntime();
  });
});
