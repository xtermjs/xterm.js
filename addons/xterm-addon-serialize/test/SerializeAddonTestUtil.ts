/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBuffer } from 'xterm';
export class SerializeAddonTestUtil {
  // this is a util used only for test
  public static inspectBuffer(buffer: IBuffer): { x: number, y: number, data: any[][] } {
    const lines: any[] = [];

    for (let i = 0; i < buffer.length; i++) {
      /**
       * Do this intentionally to get content of underlining source
       */
      const bufferLine = (buffer.getLine(i)! as any)._line;

      lines.push(JSON.stringify(bufferLine));
    }

    return {
      x: buffer.cursorX,
      y: buffer.cursorY,
      data: lines
    };
  }
}
