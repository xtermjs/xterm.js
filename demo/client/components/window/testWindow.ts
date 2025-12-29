/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/// <reference path="../../../../typings/xterm.d.ts"/>

import { writeUnicodeTable } from '../../unicodeTable';
import type { IControlWindow } from '../controlBar';
import { BaseWindow } from './baseWindow';
import type { IDisposable, Terminal } from '@xterm/xterm';
import type { AddonCollection } from 'types';
import type { IProgressState } from '@xterm/addon-progress';
import type { IImageAddonOptions } from '@xterm/addon-image';

export class TestWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'test';
  public readonly label = 'Test';

  constructor(
    terminal: Terminal,
    addons: AddonCollection,
    private readonly _handlers: {
      disposeRecreateButtonHandler: () => void,
      createNewWindowButtonHandler: () => void,
    },
  ) {
    super(terminal, addons);
  }

  public build(container: HTMLElement): void {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-block';
    wrapper.style.marginRight = '16px';

    const dl = document.createElement('dl');

    // Lifecycle section
    this._addDt(dl, 'Lifecycle');
    this._addDdWithCheckbox(dl, 'use-real-terminal', 'Use real terminal', 'This is used to real vs fake terminals', true);
    this._addDdWithButton(dl, 'dispose', 'Dispose terminal', 'This is used to testing memory leaks', () => this._handlers.disposeRecreateButtonHandler());
    this._addDdWithButton(dl, 'create-new-window', 'Create terminal in new window', 'This is used to test rendering in other windows', () => this._handlers.createNewWindowButtonHandler());

    // Performance section
    this._addDt(dl, 'Performance');
    this._addDdWithButton(dl, 'load-test', 'Load test', 'Write several MB of data to simulate a lot of data coming from the process', () => loadTest(this._terminal, this._addons));
    this._addDdWithButton(dl, 'load-test-long-lines', 'Load test (long lines)', 'Write several MB of data with long lines to simulate a lot of data coming from the process', () => loadTestLongLines(this._terminal, this._addons));
    this._addDdWithButton(dl, 'print-cjk', 'CJK Unified Ideographs', 'Prints the 20977 characters from the CJK Unified Ideographs unicode block', () => addCjk(this._terminal));
    this._addDdWithButton(dl, 'print-cjk-sgr', 'CJK Unified Ideographs (random SGR)', 'Prints the 20977 characters from the CJK Unified Ideographs unicode block with randomized SGR attributes', () => addCjkRandomSgr(this._terminal));

    // Styles section
    this._addDt(dl, 'Styles');
    this._addDdWithButton(dl, 'custom-glyph-alignment', 'Custom glyph alignment test', 'Write custom glyph alignment tests to the terminal', () => customGlyphAlignmentHandler(this._terminal));
    this._addDdWithButton(dl, 'custom-glyph-ranges', 'Custom glyph ranges', 'Write custom glyph unicode range to the terminal', () => customGlyphRangesHandler(this._terminal));
    this._addDdWithButton(dl, 'powerline-symbol-test', 'Powerline symbol test', 'Write powerline symbol characters to the terminal (\\ue0a0+)', () => powerlineSymbolTest(this._terminal));
    this._addDdWithButton(dl, 'nerd-font-icons', 'Nerd Font icons', 'Write all Nerd Font icon ranges to the terminal', () => nerdFontIconsTest(this._terminal));
    this._addDdWithButton(dl, 'underline-test', 'Underline test', 'Write text with Kitty\'s extended underline sequences', () => underlineTest(this._terminal));
    this._addDdWithButton(dl, 'sgr-test', 'SGR test', 'Write text with SGR attribute', () => sgrTest(this._terminal));
    this._addDdWithButton(dl, 'ansi-colors', 'Ansi colors test', 'Write a wide range of ansi colors', () => ansiColorsTest(this._terminal));
    this._addDdWithButton(dl, 'osc-hyperlinks', 'Ansi hyperlinks test', 'Write some OSC 8 hyperlinks', () => addAnsiHyperlink(this._terminal));
    this._addDdWithButton(dl, 'bce', 'Colored Erase (BCE)', 'Test colored erase', () => coloredErase(this._terminal));
    this._addDdWithButton(dl, 'add-grapheme-clusters', 'Grapheme clusters', 'Write grapheme cluster test strings', () => addGraphemeClusters(this._terminal));

    // Decorations section
    this._addDt(dl, 'Decorations');
    this._addDdWithButton(dl, 'add-decoration', 'Decoration (1x1)', 'Add a 1x1 decoration to the terminal', () => addDecoration(this._terminal));
    this._addDdWithButton(dl, 'add-decoration', 'Decoration (3x3)', 'Add a 3x3 decoration to the terminal', () => addDecoration(this._terminal, 3));
    this._addDdWithButton(dl, 'add-overview-ruler', 'Add Overview Ruler', 'Add an overview ruler to the terminal', () => addOverviewRuler(this._terminal));
    this._addDdWithButton(dl, 'decoration-stress-test', 'Stress Test', 'Toggle between adding and removing a decoration to each line', () => decorationStressTest(this._terminal));

    // Ligatures Addon section
    this._addDt(dl, 'Ligatures Addon');
    this._addDdWithButton(dl, 'ligatures-test', 'Common ligatures', 'Write common ligatures sequences', () => ligaturesTest(this._terminal));

    // Weblinks Addon section
    this._addDt(dl, 'Weblinks Addon');
    this._addDdWithButton(dl, 'weblinks-test', 'Test URLs', 'Various url conditions from demo data, hover&click to test', () => testWeblinks(this._terminal));

    // Image Test section
    this._addDt(dl, 'Image Test');
    this._addDdWithButton(dl, 'image-demo1', 'snake (sixel)', '');
    this._addDdWithButton(dl, 'image-demo2', 'oranges (sixel)', '');
    this._addDdWithButton(dl, 'image-demo3', 'palette (iip)', '');

    // Events Test section
    this._addDt(dl, 'Events Test');
    this._addDdWithButton(dl, 'event-focus', 'focus', '', () => this._terminal.focus());
    this._addDdWithButton(dl, 'event-blur', 'blur', '', () => this._terminal.blur());

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

    initProgress(this._terminal, this._addons);
    this._addProgressStyles(container);
    initImageAddonExposed(this._terminal, this._addons);
  }

  private _addDt(dl: HTMLElement, text: string): void {
    const dt = document.createElement('dt');
    dt.textContent = text;
    dl.appendChild(dt);
  }

  private _addDdWithButton(dl: HTMLElement, id: string, label: string, title: string, handler?: () => void): void {
    const dd = document.createElement('dd');
    const button = document.createElement('button');
    button.id = id;
    button.textContent = label;
    if (title) {
      button.title = title;
    }
    dd.appendChild(button);
    dl.appendChild(dd);
    button.addEventListener('click', handler);
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

/**
 * Prints the 20977 characters from the CJK Unified Ideographs unicode block.
 */
export function addCjk(term: Terminal): void {
  term.write('\n\n\r');
  for (let i = 0x4E00; i < 0x9FCC; i++) {
    term.write(String.fromCharCode(i));
  }
}

/**
 * Prints the 20977 characters from the CJK Unified Ideographs unicode block with randomized styles.
 */
function addCjkRandomSgr(term: Terminal): void {
  term.write('\n\n\r');
  for (let i = 0x4E00; i < 0x9FCC; i++) {
    term.write(`\x1b[${getRandomSgr()}m${String.fromCharCode(i)}\x1b[0m`);
  }
}
const randomSgrAttributes = [
  '1', '2', '3', '4', '5', '6', '7', '9',
  '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '30', '31', '32', '33', '34', '35', '36', '37', '38', '39',
  '40', '41', '42', '43', '44', '45', '46', '47', '48', '49'
];
function getRandomSgr(): string {
  return randomSgrAttributes[Math.floor(Math.random() * randomSgrAttributes.length)];
}

function powerlineSymbolTest(term: Terminal): void {
  function s(char: string): string {
    return `${char} \x1b[7m${char}\x1b[0m  `;
  }
  term.write('\n\n\r');
  term.writeln('Standard powerline symbols:');
  term.writeln('      0    1    2    3    4    5    6    7    8    9    A    B    C    D    E    F');
  term.writeln(`0xA_  ${s('\ue0a0')}${s('\ue0a1')}${s('\ue0a2')}`);
  term.writeln(`0xB_  ${s('\ue0b0')}${s('\ue0b1')}${s('\ue0b2')}${s('\ue0b3')}`);
  term.writeln('');
  term.writeln(
    `\x1b[7m` +
    ` inverse \ue0b1 \x1b[0;40m\ue0b0` +
    ` 0 \ue0b1 \x1b[30;41m\ue0b0\x1b[39m` +
    ` 1 \ue0b1 \x1b[31;42m\ue0b0\x1b[39m` +
    ` 2 \ue0b1 \x1b[32;43m\ue0b0\x1b[39m` +
    ` 3 \ue0b1 \x1b[33;44m\ue0b0\x1b[39m` +
    ` 4 \ue0b1 \x1b[34;45m\ue0b0\x1b[39m` +
    ` 5 \ue0b1 \x1b[35;46m\ue0b0\x1b[39m` +
    ` 6 \ue0b1 \x1b[36;47m\ue0b0\x1b[30m` +
    ` 7 \ue0b1 \x1b[37;49m\ue0b0\x1b[0m`
  );
  term.writeln('');
  term.writeln(
    `\x1b[7m` +
    ` inverse \ue0b3 \x1b[0;7;40m\ue0b2\x1b[27m` +
    ` 0 \ue0b3 \x1b[7;30;41m\ue0b2\x1b[27;39m` +
    ` 1 \ue0b3 \x1b[7;31;42m\ue0b2\x1b[27;39m` +
    ` 2 \ue0b3 \x1b[7;32;43m\ue0b2\x1b[27;39m` +
    ` 3 \ue0b3 \x1b[7;33;44m\ue0b2\x1b[27;39m` +
    ` 4 \ue0b3 \x1b[7;34;45m\ue0b2\x1b[27;39m` +
    ` 5 \ue0b3 \x1b[7;35;46m\ue0b2\x1b[27;39m` +
    ` 6 \ue0b3 \x1b[7;36;47m\ue0b2\x1b[27;30m` +
    ` 7 \ue0b3 \x1b[7;37;49m\ue0b2\x1b[0m`
  );
  term.writeln('');
  term.writeln(
    `\x1b[7m` +
    ` inverse \ue0b5 \x1b[0;40m\ue0b4` +
    ` 0 \ue0b5 \x1b[30;41m\ue0b4\x1b[39m` +
    ` 1 \ue0b5 \x1b[31;42m\ue0b4\x1b[39m` +
    ` 2 \ue0b5 \x1b[32;43m\ue0b4\x1b[39m` +
    ` 3 \ue0b5 \x1b[33;44m\ue0b4\x1b[39m` +
    ` 4 \ue0b5 \x1b[34;45m\ue0b4\x1b[39m` +
    ` 5 \ue0b5 \x1b[35;46m\ue0b4\x1b[39m` +
    ` 6 \ue0b5 \x1b[36;47m\ue0b4\x1b[30m` +
    ` 7 \ue0b5 \x1b[37;49m\ue0b4\x1b[0m`
  );
  term.writeln('');
  term.writeln(
    `\x1b[7m` +
    ` inverse \ue0b7 \x1b[0;7;40m\ue0b6\x1b[27m` +
    ` 0 \ue0b7 \x1b[7;30;41m\ue0b6\x1b[27;39m` +
    ` 1 \ue0b7 \x1b[7;31;42m\ue0b6\x1b[27;39m` +
    ` 2 \ue0b7 \x1b[7;32;43m\ue0b6\x1b[27;39m` +
    ` 3 \ue0b7 \x1b[7;33;44m\ue0b6\x1b[27;39m` +
    ` 4 \ue0b7 \x1b[7;34;45m\ue0b6\x1b[27;39m` +
    ` 5 \ue0b7 \x1b[7;35;46m\ue0b6\x1b[27;39m` +
    ` 6 \ue0b7 \x1b[7;36;47m\ue0b6\x1b[27;30m` +
    ` 7 \ue0b7 \x1b[7;37;49m\ue0b6\x1b[0m`
  );
  term.writeln('');
  term.writeln('Powerline extra symbols:');
  term.writeln('      0    1    2    3    4    5    6    7    8    9    A    B    C    D    E    F');
  term.writeln(`0xA_                 ${s('\ue0a3')}`);
  term.writeln(`0xB_                      ${s('\ue0b4')}${s('\ue0b5')}${s('\ue0b6')}${s('\ue0b7')}${s('\ue0b8')}${s('\ue0b9')}${s('\ue0ba')}${s('\ue0bb')}${s('\ue0bc')}${s('\ue0bd')}${s('\ue0be')}${s('\ue0bf')}`);
  term.writeln(`0xC_  ${s('\ue0c0')}${s('\ue0c1')}${s('\ue0c2')}${s('\ue0c3')}${s('\ue0c4')}${s('\ue0c5')}${s('\ue0c6')}${s('\ue0c7')}${s('\ue0c8')}${s('\ue0c9')}${s('\ue0ca')}${s('\ue0cb')}${s('\ue0cc')}${s('\ue0cd')}${s('\ue0be')}${s('\ue0bf')}`);
  term.writeln(`0xD_  ${s('\ue0d0')}${s('\ue0d1')}${s('\ue0d2')}     ${s('\ue0d4')}`);
  term.writeln('');
  term.writeln('Sample of nerd fonts icons:');
  term.writeln('    nf-linux-apple (\\uF302) \uf302');
  term.writeln('nf-mdi-github_face (\\uFbd9) \ufbd9');
}

function nerdFontIconsTest(term: Terminal): void {
  term.write('\n\n\r');
  term.writeln('\x1b[1mNerd Font Icon Ranges\x1b[0m');
  term.writeln('https://github.com/ryanoasis/nerd-fonts/wiki/Glyph-Sets-and-Code-Points\n\r');
  writeUnicodeTable(term, 'Seti-UI + Custom', 0xE5FA, 0xE6B7, [
    ['Seti-UI + Custom', 0xE5FA, 0xE6B7],
  ]);
  writeUnicodeTable(term, 'Devicons', 0xE700, 0xE8EF, [
    ['Devicons', 0xE700, 0xE8EF],
  ]);
  writeUnicodeTable(term, 'Font Awesome', 0xED00, 0xF2FF, [
    ['Font Awesome', 0xED00, 0xF2FF],
  ]);
  writeUnicodeTable(term, 'Font Awesome Extension', 0xE200, 0xE2A9, [
    ['Font Awesome Extension', 0xE200, 0xE2A9],
  ]);
  writeUnicodeTable(term, 'Material Design Icons', 0xF0001, 0xF1AF0, [
    ['Material Design Icons', 0xF0001, 0xF1AF0],
  ]);
  writeUnicodeTable(term, 'Weather', 0xE300, 0xE3E3, [
    ['Weather', 0xE300, 0xE3E3],
  ]);
  writeUnicodeTable(term, 'Octicons', 0xF400, 0xF533, [
    ['Octicons', 0xF400, 0xF533],
  ]);
  writeUnicodeTable(term, 'Powerline Symbols', 0xE0A0, 0xE0A3, [
    ['Powerline Symbols', 0xE0A0, 0xE0A3],
  ]);
  writeUnicodeTable(term, 'Powerline Extra Symbols', 0xE0B0, 0xE0D4, [
    ['Powerline Extra Symbols', 0xE0B0, 0xE0D4],
  ]);
  writeUnicodeTable(term, 'IEC Power Symbols', 0x23FB, 0x23FE, [
    ['IEC Power Symbols', 0x23FB, 0x23FE],
  ]);
  writeUnicodeTable(term, 'Font Logos', 0xF300, 0xF375, [
    ['Font Logos', 0xF300, 0xF375],
  ]);
  writeUnicodeTable(term, 'Pomicons', 0xE000, 0xE00A, [
    ['Pomicons', 0xE000, 0xE00A],
  ]);
  writeUnicodeTable(term, 'Codicons', 0xEA60, 0xEC1E, [
    ['Codicons', 0xEA60, 0xEC1E],
  ]);
  term.writeln('');
}

function underlineTest(term: Terminal): void {
  function u(style: number): string {
    return `\x1b[4:${style}m`;
  }
  function c(color: string): string {
    return `\x1b[58:${color}m`;
  }
  term.write('\n\n\r');
  term.writeln('Underline styles:');
  term.writeln('');
  function showSequence(id: number, name: string): string {
    let alphabet = '';
    for (let i = 97; i < 123; i++) {
      alphabet += String.fromCharCode(i);
    }
    let numbers = '';
    for (let i = 0; i < 10; i++) {
      numbers += i.toString();
    }
    return `${u(id)}4:${id}m - ${name}\x1b[4:0m`.padEnd(33, ' ') + `${u(id)}${alphabet} ${numbers} 汉语 한국어 👽\x1b[4:0m`;
  }
  term.writeln(showSequence(0, 'No underline'));
  term.writeln(showSequence(1, 'Straight'));
  term.writeln(showSequence(2, 'Double'));
  term.writeln(showSequence(3, 'Curly'));
  term.writeln(showSequence(4, 'Dotted'));
  term.writeln(showSequence(5, 'Dashed'));
  term.writeln('');
  term.writeln(`Underline colors (256 color mode):`);
  term.writeln('');
  for (let i = 0; i < 256; i++) {
    term.write((i !== 0 ? '\x1b[0m, ' : '') + u(1 + i % 5) + c('5:' + i) + i);
  }
  term.writeln(`\x1b[0m\n\n\rUnderline colors (true color mode):`);
  term.writeln('');
  for (let i = 0; i < 80; i++) {
    const v = Math.round(i / 79 * 255);
    term.write(u(1) + c(`2:0:${v}:${v}:${v}`) + (i < 4 ? 'grey'[i] : ' '));
  }
  term.write('\n\r');
  for (let i = 0; i < 80; i++) {
    const v = Math.round(i / 79 * 255);
    term.write(u(1) + c(`2:0:${v}:${0}:${0}`) + (i < 3 ? 'red'[i] : ' '));
  }
  term.write('\n\r');
  for (let i = 0; i < 80; i++) {
    const v = Math.round(i / 79 * 255);
    term.write(u(1) + c(`2:0:${0}:${v}:${0}`) + (i < 5 ? 'green'[i] : ' '));
  }
  term.write('\n\r');
  for (let i = 0; i < 80; i++) {
    const v = Math.round(i / 79 * 255);
    term.write(u(1) + c(`2:0:${0}:${0}:${v}`) + (i < 4 ? 'blue'[i] : ' '));
  }
  term.write('\x1b[0m\n\r');
}

function customGlyphAlignmentHandler(term: Terminal): void {
  term.write('\n\r');
  term.write('\n\r');
  term.write('Box styles:       ┎┰┒┍┯┑╓╥╖╒╤╕ ┏┳┓┌┲┓┌┬┐┏┱┐\n\r');
  term.write('┌─┬─┐ ┏━┳━┓ ╔═╦═╗ ┠╂┨┝┿┥╟╫╢╞╪╡ ┡╇┩├╊┫┢╈┪┣╉┤\n\r');
  term.write('│ │ │ ┃ ┃ ┃ ║ ║ ║ ┖┸┚┕┷┙╙╨╜╘╧╛ └┴┘└┺┛┗┻┛┗┹┘\n\r');
  term.write('├─┼─┤ ┣━╋━┫ ╠═╬═╣ ┏┱┐┌┲┓┌┬┐┌┬┐ ┏┳┓┌┮┓┌┬┐┏┭┐\n\r');
  term.write('│ │ │ ┃ ┃ ┃ ║ ║ ║ ┡╃┤├╄┩├╆┪┢╅┤ ┞╀┦├┾┫┟╁┧┣┽┤\n\r');
  term.write('└─┴─┘ ┗━┻━┛ ╚═╩═╝ └┴┘└┴┘└┺┛┗┹┘ └┴┘└┶┛┗┻┛┗┵┘\n\r');
  term.write('\n\r');

  term.write('Other:\n\r');
  term.write('╭─╮ ╲ ╱ ╷╻╎╏┆┇┊┋ ╺╾╴ ╌╌╌ ┄┄┄ ┈┈┈\n\r');
  term.write('│ │  ╳  ╽╿╎╏┆┇┊┋ ╶╼╸ ╍╍╍ ┅┅┅ ┉┉┉\n\r');
  term.write('╰─╯ ╱ ╲ ╹╵╎╏┆┇┊┋\n\r');
  term.write('\n\r');

  term.write('Box drawing alignment tests:\x1b[31m                                          █\n\r');
  term.write('                                                                      ▉\n\r');
  term.write('  ╔══╦══╗  ┌──┬──┐  ╭──┬──╮  ╭──┬──╮  ┏━━┳━━┓  ┎┒┏┑   ╷  ╻ ┏┯┓ ┌┰┐    ▊ ╱╲╱╲╳╳╳\n\r');
  term.write('  ║┌─╨─┐║  │╔═╧═╗│  │╒═╪═╕│  │╓─╁─╖│  ┃┌─╂─┐┃  ┗╃╄┙  ╶┼╴╺╋╸┠┼┨ ┝╋┥    ▋ ╲╱╲╱╳╳╳\n\r');
  term.write('  ║│╲ ╱│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╿ │┃  ┍╅╆┓   ╵  ╹ ┗┷┛ └┸┘    ▌ ╱╲╱╲╳╳╳\n\r');
  term.write('  ╠╡ ╳ ╞╣  ├╢   ╟┤  ├┼─┼─┼┤  ├╫─╂─╫┤  ┣┿╾┼╼┿┫  ┕┛┖┚     ┌┄┄┐ ╎ ┏┅┅┓ ┋ ▍ ╲╱╲╱╳╳╳\n\r');
  term.write('  ║│╱ ╲│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╽ │┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▎\n\r');
  term.write('  ║└─╥─┘║  │╚═╤═╝│  │╘═╪═╛│  │╙─╀─╜│  ┃└─╂─┘┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▏\n\r');
  term.write('  ╚══╩══╝  └──┴──┘  ╰──┴──╯  ╰──┴──╯  ┗━━┻━━┛           └╌╌┘ ╎ ┗╍╍┛ ┋  ▁▂▃▄▅▆▇█\n\r');
  term.write('\x1b[0mBox drawing alignment tests:\x1b[32m                                          █\n\r');
  term.write('                                                                      ▉\n\r');
  term.write('  ╔══╦══╗  ┌──┬──┐  ╭──┬──╮  ╭──┬──╮  ┏━━┳━━┓  ┎┒┏┑   ╷  ╻ ┏┯┓ ┌┰┐    ▊ ╱╲╱╲╳╳╳\n\r');
  term.write('  ║┌─╨─┐║  │╔═╧═╗│  │╒═╪═╕│  │╓─╁─╖│  ┃┌─╂─┐┃  ┗╃╄┙  ╶┼╴╺╋╸┠┼┨ ┝╋┥    ▋ ╲╱╲╱╳╳╳\n\r');
  term.write('  ║│╲ ╱│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╿ │┃  ┍╅╆┓   ╵  ╹ ┗┷┛ └┸┘    ▌ ╱╲╱╲╳╳╳\n\r');
  term.write('  ╠╡ ╳ ╞╣  ├╢   ╟┤  ├┼─┼─┼┤  ├╫─╂─╫┤  ┣┿╾┼╼┿┫  ┕┛┖┚     ┌┄┄┐ ╎ ┏┅┅┓ ┋ ▍ ╲╱╲╱╳╳╳\n\r');
  term.write('  ║│╱ ╲│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╽ │┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▎\n\r');
  term.write('  ║└─╥─┘║  │╚═╤═╝│  │╘═╪═╛│  │╙─╀─╜│  ┃└─╂─┘┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▏\n\r');
  term.write('  ╚══╩══╝  └──┴──┘  ╰──┴──╯  ╰──┴──╯  ┗━━┻━━┛           └╌╌┘ ╎ ┗╍╍┛ ┋  ▁▂▃▄▅▆▇█\n\r');

  term.write('\x1b[0mSmooth mosaic terminal graphic characters alignment tests:\x1b[33m\n\r');
  term.write('  🭇🬼 🭈🬽 🭉🬾 🭊🬿 🭋🭀 🭁🭌 🭂🭍 🭃🭎 🭄🭏 🭅🭐 🭆🭑 🭨🭪 🭩 🭯 🭮🭬\n\r');
  term.write('  🭢🭗 🭣🭘 🭤🭙 🭥🭚 🭦🭛 🭒🭝 🭓🭞 🭔🭟 🭕🭠 🭖🭡 🭧🭜    🭫 🭭\n\r');
  term.write('   🭇🬼              🭉🬾 🭋🭀\n\r');
  term.write('  🭊🭁🭌🬿 🭈🭆🭂🭍🭑🬽 🭇🭄🭏🬼 🭃🭎 🭅🭐 🭨🭪\n\r');
  term.write('  🭥🭒🭝🭚 🭣🭧🭓🭞🭜🭘 🭢🭕🭠🭗 🭔🭟 🭖🭡 🭪🭨\n\r');
  term.write('   🭢🭗              🭤🭙 🭦🭛\n\r');

  term.write('\x1b[0mCharacter cell diagonals (1FBA0-1FBAE) alignment tests:\x1b[34m\n\r');
  term.write('   \u{1FBA3}\u{1FBA7}\u{1FBA2}  \u{1FBA3}\u{1FBA8}\u{1FBA0} \u{1FBAD}\u{1FBA2} \u{1FBA3}\u{1FBAC} \u{1FBAE}\n\r');
  term.write('  \u{1FBA3}\u{1FBA0} \u{1FBA1}\u{1FBA2} \u{1FBA1}\u{1FBA9}\u{1FBA2} \u{1FBA1}\u{1FBAA} \u{1FBAB}\u{1FBA0}\n\r');
  term.write('  \u{1FBA4}   \u{1FBA5}\n\r');
  term.write('  \u{1FBA1}\u{1FBA2} \u{1FBA3}\u{1FBA0}\n\r');
  term.write('   \u{1FBA1}\u{1FBA6}\u{1FBA0}\n\r');

  term.write('\x1b[0mCharacter cell diagonals (1FBD0-1FBDF) alignment tests:\x1b[34m\n\r');
  term.write('  \u{1FBD6}\u{1FBD4} \u{1FBD0}\u{1FBD1}\u{1FBD2}\u{1FBD3} \u{1FBDA} \u{1FBD9}\u{1FBDB} \u{1FBDE} \u{1FBDD}\u{1FBDF}\n\r');
  term.write('  \u{1FBD7}\u{1FBD5} \u{1FBD2}\u{1FBD3}\u{1FBD0}\u{1FBD1} \u{1FBD8}    \u{1FBDC}\n\r');
  term.write('  \u{1FBD4}\u{1FBD6}\n\r');
  term.write('  \u{1FBD5}\u{1FBD7}\n\r');
  term.write('');

  term.write('\x1b[0mComposite terminal graphics characters:\x1b[35m\n\r');
  term.write('\u{1FBB2}\u{1FBB3} \u{1FBB9}\u{1FBBA} \u{1FBC1}\u{1FBC2}\u{1FBC3}\n\r');

  term.write('\x1b[0mFill tests:\x1b[36m\n\r');
  const fillChars = ['\u{2591}', '\u{2592}', '\u{2593}', '\u{1FB8C}', '\u{1FB8D}', '\u{1FB8E}', '\u{1FB8F}', '\u{1FB90}', '\u{1FB91}', '\u{1FB92}', '\u{1FB94}', '\u{1FB95}', '\u{1FB96}', '\u{1FB97}', '\u{1FB98}', '\u{1FB99}'];
  while (fillChars.length > 0) {
    const batch = fillChars.splice(0, 10);
    for (const fillChar of batch) {
      term.write(`${fillChar.codePointAt(0).toString(16).toUpperCase().padEnd(5, ' ')} `);
    }
    term.write('\n\r');
    for (let i = 0; i < 3; i++) {
      for (const fillChar of batch) {
        term.write(fillChar.repeat(5));
        term.write(' ');
      }
      term.write('\n\r');
    }
  }

  term.write('\x1b[0mPowerline alignment tests:\n\r');
  const powerlineLeftChars = ['\u{E0B2}', '\u{E0B3}', '\u{E0B6}', '\u{E0B7}', '\u{E0BA}', '\u{E0BB}', '\u{E0BE}', '\u{E0BF}', '\u{E0C2}', '\u{E0C3}', '\u{E0C5}', '\u{E0C7}', '\u{E0CA}', '\u{E0D4}'];
  const powerlineRightChars = ['\u{E0B0}', '\u{E0B1}', '\u{E0B4}', '\u{E0B5}', '\u{E0B8}', '\u{E0B9}', '\u{E0BC}', '\u{E0BD}', '\u{E0C0}', '\u{E0C1}', '\u{E0C4}', '\u{E0C6}', '\u{E0C8}', '\u{E0D2}', '\u{E0CC}', '\u{E0CD}', '\u{E0CE}', '\u{E0CF}', '\u{E0D0}', '\u{E0D1}'];
  for (const char of powerlineLeftChars) {
    term.write(`\x1b[31m${char}\x1b[0;41m \x1b[0m `);
  }
  term.write('\n\r');
  for (const char of powerlineRightChars) {
    term.write(`\x1b[41m \x1b[0;31m${char}\x1b[0m `);
  }
  term.write('\n\r');

  term.write('\x1b[0mGit Branch Symbols alignment tests:\x1b[32m\n\r');
  term.write(' \u{F5F7}\u{F5F7} \u{F5EE}\u{F5EF}  \u{F5F6}\u{F5F7} \u{F5D6}\u{F5D0}\u{F5D7} \u{F5FC}\u{F5FC}\u{F5FE} \u{F5FD}\u{F609}\u{F5FF}\n\r');
  term.write(' \u{F5DA}\u{F5DD} \u{F5F0}\u{F5F4}\u{F5F2} \u{F5FA}\u{F5FB} \u{F5D1} \u{F5D1} \u{F604}\u{F60C}\u{F606} \u{F605}\u{F60D}\u{F607}\n\r');
  term.write(' \u{F5DB}\u{F5DE} \u{F5F1}\u{F5F5}\u{F5F3} \u{F5F8}\u{F5F9} \u{F5D8}\u{F5D0}\u{F5D9} \u{F600}\u{F60A}\u{F602} \u{F601}\u{F60B}\u{F603}\n\r');
  term.write(' \u{F5DC}\u{F5DF}       \u{F5F7}\u{F5F7}\u{F5F7}\u{F5F7}\u{F5F7}\u{F5F7}\u{F5F7}\n\r');
  term.write('\u{F5F1}\u{F5E6}\u{F5E7}\u{F5F3} \u{F5D3}\u{F5D0}\u{F5E0}\u{F5E1}\u{F5E2}\u{F5E3}\u{F5E4}\u{F5E5}\u{F5E8}\u{F5E9}\u{F5EC}\u{F5ED}\u{F5D2}\n\r');
  term.write('\u{F5F1}\u{F5EA}\u{F5EB}\u{F5F3}   \u{F5F9}\u{F5F9}\u{F5F9}   \u{F5F9}\u{F5F9}\u{F5F9}\u{F5F9}\n\r');
  term.write(' \u{F5F9}\u{F5F9} \n\r');
  term.write('\x1b[0m');
  term.write('\n\r');
  
  term.write('\x1b[0mProgress bar alignment tests:\x1b[33m\n\r');
  term.write('\u{EE00}\u{EE01}\u{EE02} \u{EE03}\u{EE04}\u{EE05}');

  term.write('\n\r');
  window.scrollTo(0, 0);
}

function customGlyphRangesHandler(term: Terminal): void {
  // Box Drawing
  // 2500-257F
  // https://www.unicode.org/charts/PDF/U2500.pdf
  writeUnicodeTable(term, 'Box Drawing', 0x2500, 0x257F, [
    ['Light and heavy solid lines', 0x2500, 0x2503],
    ['Light and heavy dashed lines', 0x2504, 0x250B],
    ['Light and heavy line box components', 0x250C, 0x254B],
    ['Light and heavy dashed lines', 0x254C, 0x254F],
    ['Double lines', 0x2550, 0x2551],
    ['Light and double line box components', 0x2552, 0x256C],
    ['Character cell arcs', 0x256D, 0x2570],
    ['Character cell diagonals', 0x2571, 0x2573],
    ['Light and heavy half lines', 0x2574, 0x257B],
    ['Mixed light and heavy lines', 0x257C, 0x257F],
  ]);
  // Box Elements
  // 2580-259F
  // https://www.unicode.org/charts/PDF/U2580.pdf
  writeUnicodeTable(term, 'Box Elements', 0x2580, 0x259F, [
    ['Block elements', 0x2580, 0x2590],
    ['Shade characters', 0x2591, 0x2593],
    ['Block elements', 0x2594, 0x2595],
    ['Terminal graphic characters', 0x2596, 0x259F],
  ]);
  // Braille Patterns
  // 2800-28FF
  // https://www.unicode.org/charts/PDF/U2800.pdf
  writeUnicodeTable(term, 'Braille patterns', 0x2800, 0x28FF, [
    ['Braille patterns', 0x2800, 0x28FF],
  ]);
  // Powerline Symbols
  // Range: E0A0–E0D4
  // https://github.com/ryanoasis/nerd-fonts
  writeUnicodeTable(term, 'Powerline Symbols', 0xE0A0, 0xE0D4, [
    ['Powerline symbols', 0xE0A0, 0xE0B3, [0xE0A4, 0xE0A5, 0xE0A6, 0xE0A7, 0xE0A8, 0xE0A9, 0xE0AA, 0xE0AB, 0xE0AC, 0xE0AD, 0xE0AE, 0xE0AF]],
    ['Powerline extra symbols', 0xE0B4, 0xE0D4, [0xE0C9, 0xE0CB, 0xE0D3]],
  ]);
  // Progress Indicators
  // Range: EE00-EE0B
  // https://github.com/tonsky/FiraCode
  writeUnicodeTable(term, 'Progress Indicators', 0xEE00, 0xEE0B, [
    ['Progress bars', 0xEE00, 0xEE05],
    ['Progress spinners', 0xEE06, 0xEE0B],
  ]);
  // https://github.com/ryanoasis/nerd-fonts/pull/1733
  // Git Branch Symbols
  // F5D0-F60D
  // https://github.com/xtermjs/xterm.js/issues/5477
  writeUnicodeTable(term, 'Git Branch Symbols', 0xF5D0, 0xF5FB, [
    ['Straight lines', 0xF5D0, 0xF5D5],
    ['Curved lines', 0xF5D6, 0xF5D9],
    ['Branching lines', 0xF5DA, 0xF5ED],
    ['Nodes', 0xF5EE, 0xF5FB],
    ['Extended nodes', 0xF5FC, 0xF60D],
  ]);
  // Symbols for Legacy Computing
  // Range: 1FB00–1FBFF
  // https://www.unicode.org/charts/PDF/U1FB00.pdf
  writeUnicodeTable(term, 'Symbols for Legacy Computing', 0x1FB00, 0x1FBFF, [
    ['Block mosaic terminal graphic characters (Sextants)', 0x1FB00, 0x1FB3B],
    ['Smooth mosaic terminal graphic characters', 0x1FB3C, 0x1FB6F],
    ['Block elements', 0x1FB70, 0x1FB80],
    ['Window title bar', 0x1FB81, 0x1FB81],
    ['Block elements', 0x1FB82, 0x1FB8B],
    ['Rectangular shade characters', 0x1FB8C, 0x1FB94, [0x1FB93]],
    ['Fill characters', 0x1FB95, 0x1FB97],
    ['Diagonal fill characters', 0x1FB98, 0x1FB99],
    ['Smooth mosaic terminal graphic characters', 0x1FB9A, 0x1FB9B],
    ['Triangular shade characters', 0x1FB9C, 0x1FB9F],
    ['Character cell diagonals', 0x1FBA0, 0x1FBAE],
    ['Light solid line with stroke', 0x1FBAF, 0x1FBAF],
    ['Terminal graphic characters', 0x1FBB0, 0x1FBB3],
    ['Arrows', 0x1FBB4, 0x1FBB8],
    ['Terminal graphic characters', 0x1FBB9, 0x1FBBC],
    ['Negative terminal graphic characters', 0x1FBBD, 0x1FBBF],
    ['Terminal graphic characters', 0x1FBC0, 0x1FBCA],
    ['Terminal graphic characters', 0x1FBCB, 0x1FBCD],
    ['Block elements', 0x1FBCE, 0x1FBCF],
    ['Character cell diagonals', 0x1FBD0, 0x1FBDF],
    ['Geometrics shapes', 0x1FBE0, 0x1FBEF],
    ['Segmented digits', 0x1FBF0, 0x1FBF9],
    ['Terminal graphic character', 0x1FBFA, 0x1FBFA],
  ]);
}

function ansiColorsTest(term: Terminal): void {
  term.writeln(`\x1b[0m\n\n\rStandard colors:                        Bright colors:`);
  for (let i = 0; i < 16; i++) {
    term.write(`\x1b[48;5;${i}m ${i.toString().padEnd(2, ' ').padStart(3, ' ')} \x1b[0m`);
  }

  term.writeln(`\x1b[0m\n\n\rColors 17-231 from 256 palette:`);
  for (let i = 0; i < 6; i++) {
    const startId = 16 + i * 36;
    const endId = 16 + (i + 1) * 36 - 1;
    term.write(`${startId.toString().padStart(3, ' ')}-${endId.toString().padStart(3, ' ')} `);
    for (let j = 0; j < 36; j++) {
      const id = 16 + i * 36 + j;
      term.write(`\x1b[48;5;${id}m${(id % 10).toString().padStart(2, ' ')}\x1b[0m`);
    }
    term.write(`\r\n`);
  }

  term.writeln(`\x1b[0m\n\rGreyscale from 256 palette:`);
  term.write('232-255 ');
  for (let i = 232; i < 256; i++) {
    term.write(`\x1b[48;5;${i}m ${(i % 10)} \x1b[0m`);
  }
}

function writeTestString(): string {
  let alphabet = '';
  for (let i = 97; i < 123; i++) {
    alphabet += String.fromCharCode(i);
  }
  let numbers = '';
  for (let i = 0; i < 10; i++) {
    numbers += i.toString();
  }
  return `${alphabet} ${numbers} 汉语 한국어 👽`;
}
const testString = writeTestString();

function sgrTest(term: Terminal): void {
  term.write('\n\n\r');
  term.writeln(`Character Attributes (SGR, Select Graphic Rendition)`);
  const entries: { ps: number, name: string }[] = [
    { ps: 0, name: 'Normal' },
    { ps: 1, name: 'Bold' },
    { ps: 2, name: 'Faint/dim' },
    { ps: 3, name: 'Italicized' },
    { ps: 4, name: 'Underlined' },
    { ps: 5, name: 'Blink' },
    { ps: 7, name: 'Inverse' },
    { ps: 8, name: 'Invisible' },
    { ps: 9, name: 'Crossed-out characters' },
    { ps: 21, name: 'Doubly-underlined' },
    { ps: 22, name: 'Normal' },
    { ps: 23, name: 'Not italicized' },
    { ps: 24, name: 'Not underlined' },
    { ps: 25, name: 'Steady (not blink)' },
    { ps: 27, name: 'Positive (not inverse)' },
    { ps: 28, name: 'Visible (not hidden)' },
    { ps: 29, name: 'Not crossed-out' },
    { ps: 30, name: 'Foreground Black' },
    { ps: 31, name: 'Foreground Red' },
    { ps: 32, name: 'Foreground Green' },
    { ps: 33, name: 'Foreground Yellow' },
    { ps: 34, name: 'Foreground Blue' },
    { ps: 35, name: 'Foreground Magenta' },
    { ps: 36, name: 'Foreground Cyan' },
    { ps: 37, name: 'Foreground White' },
    { ps: 39, name: 'Foreground default' },
    { ps: 40, name: 'Background Black' },
    { ps: 41, name: 'Background Red' },
    { ps: 42, name: 'Background Green' },
    { ps: 43, name: 'Background Yellow' },
    { ps: 44, name: 'Background Blue' },
    { ps: 45, name: 'Background Magenta' },
    { ps: 46, name: 'Background Cyan' },
    { ps: 47, name: 'Background White' },
    { ps: 49, name: 'Background default' },
    { ps: 53, name: 'Overlined' },
    { ps: 55, name: 'Not overlined' }
  ];
  const maxNameLength = entries.reduce<number>((p, c) => Math.max(c.name.length, p), 0);
  for (const e of entries) {
    term.writeln(`\x1b[0m\x1b[${e.ps}m ${e.ps.toString().padEnd(2, ' ')} ${e.name.padEnd(maxNameLength, ' ')} - ${testString}\x1b[0m`);
  }
  const entriesByPs: Map<number, string> = new Map();
  for (const e of entries) {
    entriesByPs.set(e.ps, e.name);
  }
  const comboEntries: { ps: number[] }[] = [
    { ps: [1, 2, 3, 4, 5, 6, 7, 9] },
    { ps: [2, 41] },
    { ps: [4, 53] }
  ];
  term.write('\n\n\r');
  term.writeln(`Combinations`);
  for (const e of comboEntries) {
    const name = e.ps.map(e => entriesByPs.get(e)).join(', ');
    term.writeln(`\x1b[0m\x1b[${e.ps.join(';')}m ${name}\n\r${testString}\x1b[0m`);
  }
}

function addAnsiHyperlink(term: Terminal): void {
  term.write('\n\n\r');
  term.writeln(`Regular link with no id:`);
  term.writeln('\x1b]8;;https://github.com\x07GitHub\x1b]8;;\x07');
  term.writeln('\x1b]8;;https://xtermjs.org\x07https://xtermjs.org\x1b]8;;\x07\x1b[C<- null cell');
  term.writeln(`\nAdjacent links:`);
  term.writeln('\x1b]8;;https://github.com\x07GitHub\x1b]8;;https://xtermjs.org\x07\x1b[32mxterm.js\x1b[0m\x1b]8;;\x07');
  term.writeln(`\nShared ID link (underline should be shared):`);
  term.writeln('╔════╗');
  term.writeln('║\x1b]8;id=testid;https://github.com\x07GitH\x1b]8;;\x07║');
  term.writeln('║\x1b]8;id=testid;https://github.com\x07ub\x1b]8;;\x07  ║');
  term.writeln('╚════╝');
  term.writeln(`\nWrapped link with no ID (not necessarily meant to share underline):`);
  term.writeln('╔════╗');
  term.writeln('║    ║');
  term.writeln('║    ║');
  term.writeln('╚════╝');
  term.write('\x1b[3A\x1b[1C\x1b]8;;https://xtermjs.org\x07xter\x1b[B\x1b[4Dm.js\x1b]8;;\x07\x1b[2B\x1b[5D');
}

function addGraphemeClusters(term: Terminal): void {
  term.write('\n\n\r');
  term.writeln('🤣🤣🤣🤣🤣🤣🤣🤣🤣🤣 [Simple emoji v6: 10 cells, v15: 20 cells]');
  term.writeln('\u{1F476}\u{1F3FF}\u{1F476} [baby with emoji modifier fitzpatrick type-6; baby]');
  term.writeln('\u{1F469}\u200d\u{1f469}\u200d\u{1f466} [woman+zwj+woman+zwj+boy]');
  term.writeln('\u{1F64B}\u{1F64B}\u{200D}\u{2642}\u{FE0F} [person/man raising hand]');
  term.writeln('\u{1F3CB}\u{FE0F}=\u{1F3CB}\u{1F3FE}\u{200D}\u{2640}\u{FE0F} [person lifting weights emoji; woman lighting weights, medium dark]');
  term.writeln('\u{1F469}\u{1F469}\u{200D}\u{1F393}\u{1F468}\u{1F3FF}\u{200D}\u{1F393} [woman; woman student; man student dark]');
  term.writeln('\u{1f1f3}\u{1f1f4}_ [REGIONAL INDICATOR SYMBOL LETTER N and RI O]');
  term.writeln('\u{1f1f3}_\u{1f1f4} {RI N; underscore; RI O]');
  term.writeln('\u0061\u0301 [letter a with acute accent]');
  term.writeln('\u1100\u1161\u11A8=\u1100\u1161= [Korean Jamo]');
  term.writeln('\uAC00=\uD685= [Hangul syllables (pre-composed)]');
  term.writeln('(\u26b0\ufe0e) [coffin with text_presentation]');
  term.writeln('(\u26b0\ufe0f) [coffin with Emoji_presentation]');
  term.writeln('<E\u0301\ufe0fg\ufe0fa\ufe0fl\ufe0fi\ufe0f\ufe0ft\ufe0fe\u0301\ufe0f> [Égalité (using separate acute) emoij_presentation]');
}

function coloredErase(term: Terminal): void {
  const sp5 = '     ';
  const data = `
Test BG-colored Erase (BCE):
  The color block in the following lines should look identical.
  For newly created rows at the bottom the last color should be applied
  for all cells to the right.

 def   41   42   43   44   45   46   47\x1b[47m
\x1b[m${sp5}\x1b[41m${sp5}\x1b[42m${sp5}\x1b[43m${sp5}\x1b[44m${sp5}\x1b[45m${sp5}\x1b[46m${sp5}\x1b[47m${sp5}
\x1b[m\x1b[5X\x1b[41m\x1b[5C\x1b[5X\x1b[42m\x1b[5C\x1b[5X\x1b[43m\x1b[5C\x1b[5X\x1b[44m\x1b[5C\x1b[5X\x1b[45m\x1b[5C\x1b[5X\x1b[46m\x1b[5C\x1b[5X\x1b[47m\x1b[5C\x1b[5X\x1b[m
`;
  term.write(data.split('\n').join('\r\n'));
}

function ligaturesTest(term: Terminal): void {
  term.write([
    '',
    '-<< -< -<- <-- <--- <<- <- -> ->> --> ---> ->- >- >>-',
    '=<< =< =<= <== <=== <<= <= => =>> ==> ===> =>= >= >>=',
    '<-> <--> <---> <----> <=> <==> <===> <====> :: ::: __',
    '<~~ </ </> /> ~~> == != /= ~= <> === !== !=== =/= =!=',
    '<: := *= *+ <* <*> *> <| <|> |> <. <.> .> +* =* =: :>',
    '(* *) /* */ [| |] {| |} ++ +++ \/ /\ |- -| <!-- <!---',
    '==== ===== ====== ======= ======== =========',
    '---- ----- ------ ------- -------- ---------'
  ].join('\r\n'));
}

function testWeblinks(term: Terminal): void {
  const linkExamples = `
aaa http://example.com aaa http://example.com aaa
￥￥￥ http://example.com aaa http://example.com aaa
aaa http://example.com ￥￥￥ http://example.com aaa
￥￥￥ http://example.com ￥￥￥ http://example.com aaa
aaa https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문 aaa
￥￥￥ https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문 ￥￥￥
aaa http://test:password@example.com/some_path aaa
brackets enclosed:
aaa [http://example.de] aaa
aaa (http://example.de) aaa
aaa <http://example.de> aaa
aaa {http://example.de} aaa
ipv6 https://[::1]/with/some?vars=and&a#hash aaa
stop at final '.': This is a sentence with an url to http://example.com.
stop at final '?': Is this the right url http://example.com/?
stop at final '?': Maybe this one http://example.com/with?arguments=false?
`;
  term.write(linkExamples.split('\n').join('\r\n'));
}

function loadTest(term: Terminal, addons: AddonCollection): void {
  const rendererName = addons.webgl.instance ? 'webgl' : 'dom';
  const testData = [];
  let byteCount = 0;
  for (let i = 0; i < 50; i++) {
    const count = 1 + Math.floor(Math.random() * 79);
    byteCount += count + 2;
    const data = new Uint8Array(count + 2);
    data[0] = 0x0A; // \n
    for (let i = 1; i < count + 1; i++) {
      data[i] = 0x61 + Math.floor(Math.random() * (0x7A - 0x61));
    }
    // End each line with \r so the cursor remains constant, this is what ls/tree do and improves
    // performance significantly due to the cursor DOM element not needing to change
    data[data.length - 1] = 0x0D; // \r
    testData.push(data);
  }
  const start = performance.now();
  for (let i = 0; i < 1024; i++) {
    for (const d of testData) {
      term.write(d);
    }
  }
  // Wait for all data to be parsed before evaluating time
  term.write('', () => {
    const time = Math.round(performance.now() - start);
    const mbs = ((byteCount / 1024) * (1 / (time / 1000))).toFixed(2);
    term.write(`\n\r\nWrote ${byteCount}kB in ${time}ms (${mbs}MB/s) using the (${rendererName} renderer)`);
    // Send ^C to get a new prompt
    (term as any)._core._onData.fire('\x03');
  });
}

function loadTestLongLines(term: Terminal, addons: AddonCollection): void {
  const rendererName = addons.webgl.instance ? 'webgl' : 'dom';
  const testData = [];
  let byteCount = 0;
  for (let i = 0; i < 50; i++) {
    const count = 1 + Math.floor(Math.random() * 500);
    byteCount += count + 2;
    const data = new Uint8Array(count + 2);
    data[0] = 0x0A; // \n
    for (let i = 1; i < count + 1; i++) {
      data[i] = 0x61 + Math.floor(Math.random() * (0x7A - 0x61));
    }
    // End each line with \r so the cursor remains constant, this is what ls/tree do and improves
    // performance significantly due to the cursor DOM element not needing to change
    data[data.length - 1] = 0x0D; // \r
    testData.push(data);
  }
  const start = performance.now();
  for (let i = 0; i < 1024 * 50; i++) {
    for (const d of testData) {
      term.write(d);
    }
  }
  // Wait for all data to be parsed before evaluating time
  term.write('', () => {
    const time = Math.round(performance.now() - start);
    const mbs = ((byteCount / 1024) * (1 / (time / 1000))).toFixed(2);
    term.write(`\n\r\nWrote ${byteCount}kB in ${time}ms (${mbs}MB/s) using the (${rendererName} renderer)`);
    // Send ^C to get a new prompt
    (term as any)._core._onData.fire('\x03');
  });
}

function addDecoration(term: Terminal, dim: number = 1): void {
  term.options['overviewRuler'] = { width: 14 };
  const marker = term.registerMarker(1);
  const decoration = term.registerDecoration({
    marker,
    height: dim,
    width: dim,
    backgroundColor: '#00FF00',
    foregroundColor: '#00FE00',
    overviewRulerOptions: { color: '#ef292980', position: 'left' }
  });
  decoration.onRender((e: HTMLElement) => {
    e.style.right = '100%';
    e.style.backgroundColor = '#ef292980';
  });
}

function addOverviewRuler(term: Terminal): void {
  term.options['overviewRuler'] = { width: 14 };
  term.registerDecoration({ marker: term.registerMarker(1), overviewRulerOptions: { color: '#ef2929' } });
  term.registerDecoration({ marker: term.registerMarker(3), overviewRulerOptions: { color: '#8ae234' } });
  term.registerDecoration({ marker: term.registerMarker(5), overviewRulerOptions: { color: '#729fcf' } });
  term.registerDecoration({ marker: term.registerMarker(7), overviewRulerOptions: { color: '#ef2929', position: 'left' } });
  term.registerDecoration({ marker: term.registerMarker(7), overviewRulerOptions: { color: '#8ae234', position: 'center' } });
  term.registerDecoration({ marker: term.registerMarker(7), overviewRulerOptions: { color: '#729fcf', position: 'right' } });
  term.registerDecoration({ marker: term.registerMarker(10), overviewRulerOptions: { color: '#8ae234', position: 'center' } });
  term.registerDecoration({ marker: term.registerMarker(10), overviewRulerOptions: { color: '#ffffff80', position: 'full' } });
}

let decorationStressTestDecorations: IDisposable[] | undefined;
function decorationStressTest(term: Terminal): void {
  if (decorationStressTestDecorations) {
    for (const d of decorationStressTestDecorations) {
      d.dispose();
    }
    decorationStressTestDecorations = undefined;
  } else {
    const buffer = term.buffer.active;
    const cursorY = buffer.baseY + buffer.cursorY;
    decorationStressTestDecorations = [];
    for (const x of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]) {
      for (let y = 0; y < term.buffer.active.length; y++) {
        const cursorOffsetY = y - cursorY;
        decorationStressTestDecorations.push(term.registerDecoration({
          marker: term.registerMarker(cursorOffsetY),
          x,
          width: 4,
          backgroundColor: '#FF0000',
          overviewRulerOptions: { color: '#FF0000' }
        }));
      }
    }
  }
}

function initProgress(term: Terminal, addons: AddonCollection): void {
  const STATES = { 0: 'remove', 1: 'set', 2: 'error', 3: 'indeterminate', 4: 'pause' };
  const COLORS = { 0: '', 1: 'green', 2: 'red', 3: '', 4: 'yellow' };

  function progressHandler({ state, value }: IProgressState): void {
    // Simulate windows taskbar hack by windows terminal:
    // Since the taskbar has no means to indicate error/pause state other than by coloring
    // the current progress, we move 0 to 10% and distribute higher values in the remaining 90 %
    // NOTE: This is most likely not what you want to do for other progress indicators,
    //       that have a proper visual state for error/paused.
    value = Math.min(10 + value * 0.9, 100);
    document.getElementById('progress-percent').style.width = `${value}%`;
    document.getElementById('progress-percent').style.backgroundColor = COLORS[state];
    document.getElementById('progress-state').innerText = `State: ${STATES[state]}`;

    document.getElementById('progress-percent').style.display = state === 3 ? 'none' : 'block';
    document.getElementById('progress-indeterminate').style.display = state === 3 ? 'block' : 'none';
  }

  const progressAddon = addons.progress.instance;
  progressAddon.onChange(progressHandler);

  // apply initial state once to make it visible on page load
  const initialProgress = progressAddon.progress;
  progressHandler(initialProgress);

  document.getElementById('progress-run').addEventListener('click', async () => {
    term.write('\x1b]9;4;0\x1b\\');
    for (let i = 0; i <= 100; i += 5) {
      term.write(`\x1b]9;4;1;${i}\x1b\\`);
      await new Promise(res => setTimeout(res, 200));
    }
  });
  document.getElementById('progress-0').addEventListener('click', () => term.write('\x1b]9;4;0\x1b\\'));
  document.getElementById('progress-1').addEventListener('click', () => term.write('\x1b]9;4;1;20\x1b\\'));
  document.getElementById('progress-2').addEventListener('click', () => term.write('\x1b]9;4;2\x1b\\'));
  document.getElementById('progress-3').addEventListener('click', () => term.write('\x1b]9;4;3\x1b\\'));
  document.getElementById('progress-4').addEventListener('click', () => term.write('\x1b]9;4;4\x1b\\'));
}

function initImageAddonExposed(term: Terminal, addons: AddonCollection): void {
  const DEFAULT_OPTIONS: IImageAddonOptions = (addons.image.instance as any)._defaultOpts;
  const limitStorageElement = document.querySelector<HTMLInputElement>('#image-storagelimit');
  limitStorageElement.valueAsNumber = addons.image.instance.storageLimit;
  addDomListener(term, limitStorageElement, 'change', () => {
    try {
      addons.image.instance.storageLimit = limitStorageElement.valueAsNumber;
      limitStorageElement.valueAsNumber = addons.image.instance.storageLimit;
      console.log('changed storageLimit to', addons.image.instance.storageLimit);
    } catch (e) {
      limitStorageElement.valueAsNumber = addons.image.instance.storageLimit;
      console.log('storageLimit at', addons.image.instance.storageLimit);
      throw e;
    }
  });
  const showPlaceholderElement = document.querySelector<HTMLInputElement>('#image-showplaceholder');
  showPlaceholderElement.checked = addons.image.instance.showPlaceholder;
  addDomListener(term, showPlaceholderElement, 'change', () => {
    addons.image.instance.showPlaceholder = showPlaceholderElement.checked;
  });
  const ctorOptionsElement = document.querySelector<HTMLTextAreaElement>('#image-options');
  ctorOptionsElement.value = JSON.stringify(DEFAULT_OPTIONS, null, 2);

  const sixelDemo = (url: string) => () => fetch(url)
    .then(resp => resp.arrayBuffer())
    .then(buffer => {
      term.write('\r\n');
      term.write(new Uint8Array(buffer));
    });

  const iipDemo = (url: string) => () => fetch(url)
    .then(resp => resp.arrayBuffer())
    .then(buffer => {
      const data = new Uint8Array(buffer);
      let sdata = '';
      for (let i = 0; i < data.length; ++i) sdata += String.fromCharCode(data[i]);
      term.write('\r\n');
      term.write(`\x1b]1337;File=inline=1;size=${data.length}:${btoa(sdata)}\x1b\\`);
    });

  document.getElementById('image-demo1').addEventListener('click',
    sixelDemo('https://raw.githubusercontent.com/saitoha/libsixel/master/images/snake.six'));
  document.getElementById('image-demo2').addEventListener('click',
    sixelDemo('https://raw.githubusercontent.com/jerch/node-sixel/master/testfiles/test2.sixel'));
  document.getElementById('image-demo3').addEventListener('click',
    iipDemo('https://raw.githubusercontent.com/jerch/node-sixel/master/palette.png'));

  // demo for image retrieval API
  term.element.addEventListener('click', (ev: MouseEvent) => {
    if (!ev.ctrlKey || !addons.image.instance) return;

    // TODO...
    // if (ev.altKey) {
    //   const sel = term.getSelectionPosition();
    //   if (sel) {
    //     addons.image.instance
    //       .extractCanvasAtBufferRange(term.getSelectionPosition())
    //       ?.toBlob(data => window.open(URL.createObjectURL(data), '_blank'));
    //     return;
    //   }
    // }

    const pos = (term as any)._core._mouseService!.getCoords(ev, (term as any)._core.screenElement!, term.cols, term.rows);
    const x = pos[0] - 1;
    const y = pos[1] - 1;
    const canvas = ev.shiftKey
      // ctrl+shift+click: get single tile
      ? addons.image.instance.extractTileAtBufferCell(x, term.buffer.active.viewportY + y)
      // ctrl+click: get original image
      : addons.image.instance.getImageAtBufferCell(x, term.buffer.active.viewportY + y);
    canvas?.toBlob(data => window.open(URL.createObjectURL(data), '_blank'));
  });
}

function addDomListener(term: Terminal, element: HTMLElement, type: string, handler: (...args: any[]) => any): void {
  element.addEventListener(type, handler);
  (term as any)._core._register({ dispose: () => element.removeEventListener(type, handler) });
}
