/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { loadFonts } from '@xterm/addon-web-fonts';
import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';

export class AddonWebFontsWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-web-fonts';
  public readonly label = 'web-fonts';

  public build(container: HTMLElement): void {
    const dl = document.createElement('dl');

    // Kongtext font button
    const dtKongtext = document.createElement('dt');
    dtKongtext.textContent = 'Kongtext';
    dl.appendChild(dtKongtext);

    const ddKongtext = document.createElement('dd');
    const btnKongtext = document.createElement('button');
    btnKongtext.textContent = 'Load Kongtext';
    btnKongtext.title = 'Load Kongtext font and apply C64 style';
    btnKongtext.addEventListener('click', async () => {
      const ff = new FontFace('Kongtext', 'url(/kongtext.regular.ttf) format(\'truetype\')');
      await loadFonts([ff]);
      this._terminal.options.fontFamily = 'Kongtext';
      this._terminal.options.lineHeight = 1.3;
      this._addons.fit.instance?.fit();
      setTimeout(() => this._terminal.write('\x1b[?12h\x1b]12;#776CF9\x07\x1b[38;2;119;108;249;48;2;21;8;150m\x1b[2J\x1b[2;5H**** COMMODORE 64 BASIC V2 ****\r\n\r\n 64K RAM SYSTEM  38911 BASIC BYTES FREE\r\n\r\nREADY.\r\nLOAD '), 1000);
      setTimeout(() => { this._terminal.write('🤣\x1b[m\x1b[99;1H'); this._terminal.input('\r'); }, 5000);
    });
    ddKongtext.appendChild(btnKongtext);
    dl.appendChild(ddKongtext);

    // BPdots font button
    const dtBpdots = document.createElement('dt');
    dtBpdots.textContent = 'BPdots';
    dl.appendChild(dtBpdots);

    const ddBpdots = document.createElement('dd');
    const btnBpdots = document.createElement('button');
    btnBpdots.textContent = 'Load BPdots';
    btnBpdots.title = 'Load BPdots font';
    btnBpdots.addEventListener('click', async () => {
      document.styleSheets[0].insertRule('@font-face { font-family: "BPdots"; src: url(/bpdots.regular.otf) format("opentype"); weight: 400 }', 0);
      await loadFonts(['BPdots']);
      this._terminal.options.fontFamily = 'BPdots';
      this._terminal.options.lineHeight = 1.3;
      this._terminal.options.fontSize = 20;
      this._addons.fit.instance?.fit();
    });
    ddBpdots.appendChild(btnBpdots);
    dl.appendChild(ddBpdots);

    container.appendChild(dl);
  }
}
