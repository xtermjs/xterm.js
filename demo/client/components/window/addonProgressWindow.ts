/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';
import type { IProgressState } from '@xterm/addon-progress';

export class AddonProgressWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-progress';
  public readonly label = 'progress';

  public build(container: HTMLElement): void {
    const dl = document.createElement('dl');
    const dt = document.createElement('dt');
    dt.textContent = 'Progress Addon';
    dl.appendChild(dt);

    this._addDdWithButton(dl, 'progress-run', 'full set run', '');
    this._addDdWithButton(dl, 'progress-0', 'state 0: remove', '');
    this._addDdWithButton(dl, 'progress-1', 'state 1: set 20%', '');
    this._addDdWithButton(dl, 'progress-2', 'state 2: error', '');
    this._addDdWithButton(dl, 'progress-3', 'state 3: indeterminate', '');
    this._addDdWithButton(dl, 'progress-4', 'state 4: pause', '');

    const progressDd = document.createElement('dd');
    const progressDiv = document.createElement('div');
    progressDiv.id = 'progress-progress';
    const progressPercent = document.createElement('div');
    progressPercent.id = 'progress-percent';
    const progressIndeterminate = document.createElement('div');
    progressIndeterminate.id = 'progress-indeterminate';
    progressDiv.appendChild(progressPercent);
    progressDiv.appendChild(progressIndeterminate);
    progressDd.appendChild(progressDiv);
    dl.appendChild(progressDd);

    const stateDd = document.createElement('dd');
    const stateDiv = document.createElement('div');
    stateDiv.id = 'progress-state';
    stateDiv.textContent = 'State:';
    stateDd.appendChild(stateDiv);
    dl.appendChild(stateDd);

    container.appendChild(dl);

    this._initProgress();
    this._addProgressStyles(container);
  }

  private _addDdWithButton(dl: HTMLElement, id: string, label: string, title: string): void {
    const dd = document.createElement('dd');
    const button = document.createElement('button');
    button.id = id;
    button.textContent = label;
    if (title) {
      button.title = title;
    }
    dd.appendChild(button);
    dl.appendChild(dd);
  }

  private _initProgress(): void {
    const states = { 0: 'remove', 1: 'set', 2: 'error', 3: 'indeterminate', 4: 'pause' };
    const colors = { 0: '', 1: 'green', 2: 'red', 3: '', 4: 'yellow' };

    function progressHandler({ state, value }: IProgressState): void {
      // Simulate windows taskbar hack by windows terminal:
      // Since the taskbar has no means to indicate error/pause state other than by coloring
      // the current progress, we move 0 to 10% and distribute higher values in the remaining 90 %
      // NOTE: This is most likely not what you want to do for other progress indicators,
      //       that have a proper visual state for error/paused.
      value = Math.min(10 + value * 0.9, 100);
      document.getElementById('progress-percent')!.style.width = `${value}%`;
      document.getElementById('progress-percent')!.style.backgroundColor = colors[state];
      document.getElementById('progress-state')!.innerText = `State: ${states[state]}`;

      document.getElementById('progress-percent')!.style.display = state === 3 ? 'none' : 'block';
      document.getElementById('progress-indeterminate')!.style.display = state === 3 ? 'block' : 'none';
    }

    const progressAddon = this._addons.progress.instance!;
    progressAddon.onChange(progressHandler);

    const initialProgress = progressAddon.progress;
    progressHandler(initialProgress);

    document.getElementById('progress-run')!.addEventListener('click', async () => {
      this._terminal.write('\x1b]9;4;0\x1b\\');
      for (let i = 0; i <= 100; i += 5) {
        this._terminal.write(`\x1b]9;4;1;${i}\x1b\\`);
        await new Promise(res => setTimeout(res, 200));
      }
    });
    document.getElementById('progress-0')!.addEventListener('click', () => this._terminal.write('\x1b]9;4;0\x1b\\'));
    document.getElementById('progress-1')!.addEventListener('click', () => this._terminal.write('\x1b]9;4;1;20\x1b\\'));
    document.getElementById('progress-2')!.addEventListener('click', () => this._terminal.write('\x1b]9;4;2\x1b\\'));
    document.getElementById('progress-3')!.addEventListener('click', () => this._terminal.write('\x1b]9;4;3\x1b\\'));
    document.getElementById('progress-4')!.addEventListener('click', () => this._terminal.write('\x1b]9;4;4\x1b\\'));
  }

  private _addProgressStyles(container: HTMLElement): void {
    const style = document.createElement('style');
    style.textContent = `
      #progress-progress {
        border: 1px solid black;
        height: 10px;
      }
      #progress-percent {
        height: 100%;
      }
      #progress-indeterminate {
        display: none;
        position: relative;
        height: 100%;
      }
      #progress-indeterminate:before {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0px;
        width: 50px;
        height: 10px;
        background: blue;
        animation: ballbns 1s ease-in-out infinite alternate;
      }
      @keyframes ballbns {
        0% {  left: 0; transform: translateX(0%); }
        100% {  left: 100%; transform: translateX(-100%); }
      }
    `;
    container.appendChild(style);
  }
}
