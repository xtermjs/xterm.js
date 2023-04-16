/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { Serialize2Addon } from './Serialize2Addon';
import { Terminal } from 'browser/public/Terminal';
import { SelectionModel } from 'browser/selection/SelectionModel';
import { IBufferService } from 'common/services/Services';
import { OptionsService } from 'common/services/OptionsService';
import { ThemeService } from 'browser/services/ThemeService';

function sgr(...seq: string[]): string {
  return `\x1b[${seq.join(';')}m`;
}

function writeP(terminal: Terminal, data: string | Uint8Array): Promise<void> {
  return new Promise(r => terminal.write(data, r));
}

class TestSelectionService {
  private _model: SelectionModel;
  private _hasSelection: boolean = false;

  constructor(
    bufferService: IBufferService
  ) {
    this._model = new SelectionModel(bufferService);
  }

  public get model(): SelectionModel { return this._model; }

  public get hasSelection(): boolean { return this._hasSelection; }

  public get selectionStart(): [number, number] | undefined { return this._model.finalSelectionStart; }
  public get selectionEnd(): [number, number] | undefined { return this._model.finalSelectionEnd; }

  public setSelection(col: number, row: number, length: number): void {
    this._model.selectionStart = [col, row];
    this._model.selectionStartLength = length;
    this._hasSelection = true;
  }
}

describe('xterm-addon-serialize', () => {
  let dom: jsdom.JSDOM;
  let window: jsdom.DOMWindow;

  let serializeAddon: Serialize2Addon;
  let terminal: Terminal;

  before(() => {
    serializeAddon = new Serialize2Addon();
  });

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    window = dom.window;

    (window as any).HTMLCanvasElement.prototype.getContext = () => ({
      createLinearGradient(): any {
        return null;
      },

      fillRect(): void { },

      getImageData(): any {
        return { data: [0, 0, 0, 0xFF] };
      }
    });

    terminal = new Terminal({ cols: 10, rows: 2, allowProposedApi: true });
    terminal.loadAddon(serializeAddon);

    (terminal as any)._core._themeService = new ThemeService(new OptionsService({}));
    (terminal as any)._core._selectionService = new TestSelectionService((terminal as any)._core._bufferService);
  });

  describe('text', () => {
    // TODO: wirte alot more test cases here...
    it('restoring cursor styles', async () => {
      await writeP(terminal, sgr('32') + '> ' + sgr('0'));
      assert.equal(serializeAddon.serialize(), '\u001b[32m> \u001b[0m');
    });
  });
});
