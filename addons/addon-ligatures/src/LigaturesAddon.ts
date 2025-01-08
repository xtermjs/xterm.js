/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal } from '@xterm/xterm';
import type { LigaturesAddon as ILigaturesApi } from '@xterm/addon-ligatures';
import { enableLigatures } from '.';
import { ILigatureOptions } from './Types';

export interface ITerminalAddon {
  activate(terminal: Terminal): void;
  dispose(): void;
}

export class LigaturesAddon implements ITerminalAddon , ILigaturesApi {
  private readonly _fallbackLigatures: string[];
  private readonly _fontFeatureSettings?: string;

  private _terminal: Terminal | undefined;
  private _characterJoinerId: number | undefined;

  constructor(options?: Partial<ILigatureOptions>) {
    // Source: calt set from https://github.com/be5invis/Iosevka?tab=readme-ov-file#ligations
    this._fallbackLigatures = (options?.fallbackLigatures || [
      '<--', '<---', '<<-', '<-', '->', '->>', '-->', '--->',
      '<==', '<===', '<<=', '<=', '=>', '=>>', '==>', '===>', '>=', '>>=',
      '<->', '<-->', '<--->', '<---->', '<=>', '<==>', '<===>', '<====>', '::', ':::',
      '<~~', '</', '</>', '/>', '~~>', '==', '!=', '/=', '~=', '<>', '===', '!==', '!===',
      '<:', ':=', '*=', '*+', '<*', '<*>', '*>', '<|', '<|>', '|>', '+*', '=*', '=:', ':>',
      '/*', '*/', '+++', '<!--', '<!---'
    ]).sort((a, b) => b.length - a.length);
    this._fontFeatureSettings = options?.fontFeatureSettings;
  }

  public activate(terminal: Terminal): void {
    if (!terminal.element) {
      throw new Error('Cannot activate LigaturesAddon before open is called');
    }
    this._terminal = terminal;
    this._characterJoinerId = enableLigatures(terminal, this._fallbackLigatures);
    terminal.element.style.fontFeatureSettings = this._fontFeatureSettings ?? '"calt" on';
  }

  public dispose(): void {
    if (this._characterJoinerId !== undefined) {
      this._terminal?.deregisterCharacterJoiner(this._characterJoinerId);
      this._characterJoinerId = undefined;
    }
    if (this._terminal?.element) {
      this._terminal.element.style.fontFeatureSettings = '';
    }
  }
}
