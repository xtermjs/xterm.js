/// <reference path="../../../typings/xterm.d.ts"/>

import { Terminal } from 'xterm';

export function apply(terminalConstructor: typeof Terminal): void {
  (<any>terminalConstructor.prototype).loadWebfontAndOpen = function (element: HTMLElement): void {
    const FontFaceObserver = (typeof window === 'object' && (<any>window).FontFaceObserver);
    if (!FontFaceObserver) {
      console.warn('FontFaceObserver not available, opening xterm normally!');
      return this.open(element);
    }
    const regular = new FontFaceObserver(this.options.fontFamily).load();
    const bold = new FontFaceObserver(this.options.fontFamily, { weight: 'bold' }).load();

    return regular.constructor.all([regular, bold]).then(() => {
      this.open(element);
      return this;
    });
  };
}
