/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';
import type { Terminal } from '@xterm/xterm';

export class VtWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'vt';
  public readonly label = 'VT';

  private _container: HTMLElement;
  private _term: Terminal | undefined;

  public build(container: HTMLElement): void {
    this._container = container;

    const vtContainer = document.createElement('div');
    vtContainer.id = 'vt-container';
    container.appendChild(vtContainer);

    const vtFragment = document.createDocumentFragment();
    const buttonSpecs: { [key: string]: { label: string; description: string; paramCount?: number } } = {
      'A': { label: 'CUU ↑', description: 'Cursor Up Ps Times' },
      'B': { label: 'CUD ↓', description: 'Cursor Down Ps Times' },
      'C': { label: 'CUF →', description: 'Cursor Forward Ps Times' },
      'D': { label: 'CUB ←', description: 'Cursor Backward Ps Times' },
      'E': { label: 'CNL', description: 'Cursor Next Line Ps Times' },
      'F': { label: 'CPL', description: 'Cursor Preceding Line Ps Times' },
      'G': { label: 'CHA', description: 'Cursor Character Absolute' },
      'H': { label: 'CUP', description: 'Cursor Position [row;column]', paramCount: 2 },
      'I': { label: 'CHT', description: 'Cursor Forward Tabulation Ps tab stops' },
      'J': { label: 'ED', description: 'Erase in Display' },
      '?|J': { label: 'DECSED', description: 'Erase in Display' },
      'K': { label: 'EL', description: 'Erase in Line' },
      '?|K': { label: 'DECSEL', description: 'Erase in Line' },
      'L': { label: 'IL', description: 'Insert Ps Line(s)' },
      'M': { label: 'DL', description: 'Delete Ps Line(s)' },
      'P': { label: 'DCH', description: 'Delete Ps Character(s)' },
      ' q': { label: 'DECSCUSR', description: 'Set Cursor Style' },
      '?2026h': { label: 'BSU', description: 'Begin synchronized update', paramCount: 0 },
      '?2026l': { label: 'ESU', description: 'End synchronized update', paramCount: 0 }
    };
    for (const s of Object.keys(buttonSpecs)) {
      const spec = buttonSpecs[s];
      vtFragment.appendChild(this._createButton(spec.label, spec.description, s, spec.paramCount));
    }

    vtContainer.appendChild(vtFragment);
  }

  private _createButton(name: string, description: string, writeCsi: string, paramCount: number = 1): HTMLElement {
    const inputs: HTMLInputElement[] = [];
    for (let i = 0; i < paramCount; i++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.title = `Input #${i + 1}`;
      inputs.push(input);
    }

    const element = document.createElement('button');
    element.textContent = name;
    const writeCsiSplit = writeCsi.split('|');
    const prefix = writeCsiSplit.length === 2 ? writeCsiSplit[0] : '';
    const suffix = writeCsiSplit[writeCsiSplit.length - 1];
    element.addEventListener('click', () => this._term?.write(this._csi(`${prefix}${inputs.map(e => e.value).join(';')}${suffix}`)));

    const desc = document.createElement('span');
    desc.textContent = description;

    const container = document.createElement('div');
    container.classList.add('vt-button');
    container.append(element, ...inputs, desc);
    return container;
  }

  private _csi(e: string): string {
    return `\x1b[${e}`;
  }
}
