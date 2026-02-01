/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';

export class AddonWebLinksWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'addon-web-links';
  public readonly label = 'web-links';

  public build(container: HTMLElement): void {
    const dl = document.createElement('dl');
    const dt = document.createElement('dt');
    dt.textContent = 'Weblinks Addon';
    dl.appendChild(dt);

    const dd = document.createElement('dd');
    const button = document.createElement('button');
    button.id = 'weblinks-test';
    button.textContent = 'Test URLs';
    button.title = 'Various url conditions from demo data, hover&click to test';
    button.addEventListener('click', () => this._testWeblinks());
    dd.appendChild(button);
    dl.appendChild(dd);

    container.appendChild(dl);
  }

  private _testWeblinks(): void {
    const linkExamples = `
  aaa http://example.com aaa http://example.com aaa
  \uFFE5\uFFE5\uFFE5 http://example.com aaa http://example.com aaa
  aaa http://example.com \uFFE5\uFFE5\uFFE5 http://example.com aaa
  \uFFE5\uFFE5\uFFE5 http://example.com \uFFE5\uFFE5\uFFE5 http://example.com aaa
  aaa https://ko.wikipedia.org/wiki/\uC704\uD0A4\uBC31\uACFC:\uB300\uBB38 aaa https://ko.wikipedia.org/wiki/\uC704\uD0A4\uBC31\uACFC:\uB300\uBB38 aaa
  \uFFE5\uFFE5\uFFE5 https://ko.wikipedia.org/wiki/\uC704\uD0A4\uBC31\uACFC:\uB300\uBB38 aaa https://ko.wikipedia.org/wiki/\uC704\uD0A4\uBC31\uACFC:\uB300\uBB38 \uFFE5\uFFE5\uFFE5
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
    this._terminal.write(linkExamples.split('\n').join('\r\n'));
  }
}
