/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharsetService } from 'common/services/Services';
import { ICharset } from 'common/Types';

export class CharsetService implements ICharsetService {
  serviceBrand: any;

  public charset: ICharset | undefined;
  public charsets: ICharset[] = [];
  public glevel: number = 0;

  public reset(): void {
    this.charset = undefined;
    this.charsets = [];
    this.glevel = 0;
  }

  public setgLevel(g: number): void {
    this.glevel = g;
    this.charset = this.charsets[g];
  }

  public setgCharset(g: number, charset: ICharset): void {
    this.charsets[g] = charset;
    if (this.glevel === g) {
      this.charset = charset;
    }
  }
}
