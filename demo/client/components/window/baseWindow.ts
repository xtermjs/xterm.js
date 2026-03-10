/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { AddonCollection } from '../../types';
import type { IControlWindow } from '../controlBar';
import type { Terminal } from '@xterm/xterm';

export abstract class BaseWindow implements IControlWindow {
  protected get _terminal(): Terminal { return this._terminalPrivate; }

  constructor(
    private _terminalPrivate: Terminal,
    protected readonly _addons: AddonCollection,
  ) {

  }

  public setTerminal(terminal: Terminal): void {
    this._terminalPrivate = terminal;
  }

  public abstract id: string;
  public abstract label: string;
  public abstract build(container: HTMLElement): void;
}
