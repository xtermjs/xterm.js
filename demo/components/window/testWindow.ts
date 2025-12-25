/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IControlWindow } from '../controlBar';

export class TestWindow implements IControlWindow {
  public readonly id = 'test';
  public readonly label = 'Test';

  public build(container: HTMLElement): void {
    const heading = document.createElement('h3');
    heading.textContent = 'Test';
    container.appendChild(heading);

    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.marginRight = '16px';

    const dl = document.createElement('dl');

    // Lifecycle section
    this._addDt(dl, 'Lifecycle');
    this._addDdWithCheckbox(dl, 'use-real-terminal', 'Use real terminal', 'This is used to real vs fake terminals', true);
    this._addDdWithButton(dl, 'dispose', 'Dispose terminal', 'This is used to testing memory leaks');
    this._addDdWithButton(dl, 'create-new-window', 'Create terminal in new window', 'This is used to test rendering in other windows');

    // Performance section
    this._addDt(dl, 'Performance');
    this._addDdWithButton(dl, 'load-test', 'Load test', 'Write several MB of data to simulate a lot of data coming from the process');
    this._addDdWithButton(dl, 'load-test-long-lines', 'Load test (long lines)', 'Write several MB of data with long lines to simulate a lot of data coming from the process');
    this._addDdWithButton(dl, 'print-cjk', 'CJK Unified Ideographs', 'Prints the 20977 characters from the CJK Unified Ideographs unicode block');
    this._addDdWithButton(dl, 'print-cjk-sgr', 'CJK Unified Ideographs (random SGR)', 'Prints the 20977 characters from the CJK Unified Ideographs unicode block with randomized SGR attributes');

    // Styles section
    this._addDt(dl, 'Styles');
    this._addDdWithButton(dl, 'custom-glyph-alignment', 'Custom glyph alignment test', 'Write custom glyph alignment tests to the terminal');
    this._addDdWithButton(dl, 'custom-glyph-ranges', 'Custom glyph ranges', 'Write custom glyph unicode range to the terminal');
    this._addDdWithButton(dl, 'powerline-symbol-test', 'Powerline symbol test', 'Write powerline symbol characters to the terminal (\\ue0a0+)');
    this._addDdWithButton(dl, 'underline-test', 'Underline test', 'Write text with Kitty\'s extended underline sequences');
    this._addDdWithButton(dl, 'sgr-test', 'SGR test', 'Write text with SGR attribute');
    this._addDdWithButton(dl, 'ansi-colors', 'Ansi colors test', 'Write a wide range of ansi colors');
    this._addDdWithButton(dl, 'osc-hyperlinks', 'Ansi hyperlinks test', 'Write some OSC 8 hyperlinks');
    this._addDdWithButton(dl, 'bce', 'Colored Erase (BCE)', 'Test colored erase');
    this._addDdWithButton(dl, 'add-grapheme-clusters', 'Grapheme clusters', 'Write grapheme cluster test strings');

    // Decorations section
    this._addDt(dl, 'Decorations');
    this._addDdWithButton(dl, 'add-decoration', 'Decoration', 'Add a decoration to the terminal');
    this._addDdWithButton(dl, 'add-overview-ruler', 'Add Overview Ruler', 'Add an overview ruler to the terminal');
    this._addDdWithButton(dl, 'decoration-stress-test', 'Stress Test', 'Toggle between adding and removing a decoration to each line');

    // Ligatures Addon section
    this._addDt(dl, 'Ligatures Addon');
    this._addDdWithButton(dl, 'ligatures-test', 'Common ligatures', 'Write common ligatures sequences');

    // Weblinks Addon section
    this._addDt(dl, 'Weblinks Addon');
    this._addDdWithButton(dl, 'weblinks-test', 'Test URLs', 'Various url conditions from demo data, hover&click to test');

    // Image Test section
    this._addDt(dl, 'Image Test');
    this._addDdWithButton(dl, 'image-demo1', 'snake (sixel)', '');
    this._addDdWithButton(dl, 'image-demo2', 'oranges (sixel)', '');
    this._addDdWithButton(dl, 'image-demo3', 'palette (iip)', '');

    // Events Test section
    this._addDt(dl, 'Events Test');
    this._addDdWithButton(dl, 'event-focus', 'focus', '');
    this._addDdWithButton(dl, 'event-blur', 'blur', '');

    // Progress Addon section
    this._addDt(dl, 'Progress Addon');
    this._addDdWithButton(dl, 'progress-run', 'full set run', '');
    this._addDdWithButton(dl, 'progress-0', 'state 0: remove', '');
    this._addDdWithButton(dl, 'progress-1', 'state 1: set 20%', '');
    this._addDdWithButton(dl, 'progress-2', 'state 2: error', '');
    this._addDdWithButton(dl, 'progress-3', 'state 3: indeterminate', '');
    this._addDdWithButton(dl, 'progress-4', 'state 4: pause', '');

    // Progress bar
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

    // Progress state
    const stateDd = document.createElement('dd');
    const stateDiv = document.createElement('div');
    stateDiv.id = 'progress-state';
    stateDiv.textContent = 'State:';
    stateDd.appendChild(stateDiv);
    dl.appendChild(stateDd);

    wrapper.appendChild(dl);
    container.appendChild(wrapper);

    // Add progress bar styles
    this._addProgressStyles(container);
  }

  private _addDt(dl: HTMLElement, text: string): void {
    const dt = document.createElement('dt');
    dt.textContent = text;
    dl.appendChild(dt);
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

  private _addDdWithCheckbox(dl: HTMLElement, id: string, label: string, title: string, checked: boolean): void {
    const dd = document.createElement('dd');
    const labelElement = document.createElement('label');
    labelElement.htmlFor = id;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    if (title) {
      checkbox.title = title;
    }
    labelElement.appendChild(checkbox);
    labelElement.appendChild(document.createTextNode(label));
    dd.appendChild(labelElement);
    dl.appendChild(dd);
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
