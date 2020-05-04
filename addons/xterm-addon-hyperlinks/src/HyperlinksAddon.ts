/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * UnicodeVersionProvider for V11.
 */

import { Terminal, ITerminalAddon, IDisposable, IBufferRange } from 'xterm';
import { ILinkProvider, IBufferCellPosition, ILink } from 'xterm';

/**
 * TODO:
 * Need the following changes in xterm.js:
 * - allow LinkProvider callback to contain multiple ranges (currently hacked)
 * - make extended attributes contributable by outer code
 * - extend public API by extended attributes
 */

class HyperlinkProvider implements ILinkProvider {

  constructor(
    private readonly _terminal: Terminal,
    private readonly _urlMap: {[key: number]: string}
  ) {}

  public provideLink(position: IBufferCellPosition, callback: (link: ILink | undefined) => void): void {
    const pos = {x: position.x - 1, y: position.y - 1};

    // test whether we are above a cell with an urlId
    // TODO: need API extension
    const urlId = (this._terminal.buffer.active.getLine(pos.y)?.getCell(pos.x) as any).extended.urlId;
    if (!urlId) {
      callback(undefined);
      return;
    }

    // we got an url cell, thus we need to fetch whole viewport and
    // mark all cells with that particular urlId
    const yOffset = this._terminal.buffer.active.viewportY;
    const ranges: IBufferRange[] = [];
    let r: IBufferRange | null = null;
    for (let y = yOffset; y < this._terminal.rows + yOffset; ++y) {
      const line = this._terminal.buffer.active.getLine(y);
      if (!line) {
        break;
      }
      for (let x = 0; x < this._terminal.rows; ++x) {
        const cell = line.getCell(x);
        if (!cell) {
          break;
        }
        if ((cell as any).extended.urlId === urlId) {
          if (!r) {
            r = {start: {x, y}, end: {x: x + 1, y}};
          } else {
            r.end.x = x + 1;
            r.end.y = y;
          }
        } else {
          if (r) {
            r.end.x = x;
            r.end.y = y;
            ranges.push(r);
            r = null;
          }
        }
      }
    }
    if (r) {
      ranges.push(r);
    }

    // fix ranges to 1-based, right inclusive
    for (let r of ranges) {
      r.start.x++;
      r.start.y++;
      r.end.y++;
    }

    // TODO: make this customizable from outside
    callback({
      ranges,
      text: this._urlMap[urlId],
      decorations: {pointerCursor: true, underline: true},
      activate: (event: MouseEvent, text: string) => {
        console.log('would open:', text);
      },
      hover: (event: MouseEvent, text: string) => {
        console.log('tooltip to show:', text);
      }
    });
  }
}

export class HyperlinksAddon implements ITerminalAddon {
  private _oscHandler: IDisposable | undefined;
  private _linkProvider: IDisposable | undefined;
  private _internalId = 1;
  private _idMap: {[key: string]: number} = {};
  private _urlMap: {[key: number]: string} = {};

  /**
   * Parse params part of the data.
   * Converts into a key-value mapping object if:
   * - fully empty (returns empty object)
   * - all keys and values are set
   * - key-value pairs are properly separated by ':'
   * - keys and values are separated by '='
   * - a key-value pair can be empty
   * Any other case will drop to `false` as return value.
   */
  private _parseParams(paramString: string): {[key: string]: string} | void {
    const result: {[key: string]: string} = {};
    const params = paramString.split(':').filter(Boolean).map(el => el.split('='));
    for (const p of params) {
      if (p.length !== 2) {
        return;
      }
      const [key, value] = p;
      if (!key || !value) {
        return;
      }
      result[key] = value;
    }
    return result;
  }

  /**
   * Method to filter for allowed URL schemes.
   * Returns empty string if the given url does not pass the test.
   */
  private _filterUrl(urlString: string): string {
    // TODO: implement filter rules
    return urlString;
  }

  private _updateAttrs(terminal: Terminal, hoverId: number = 0): void {
    // hack: remove url notion from extended attrs by private access
    // TODO: API to contribute to extended attributes
    const attr = (terminal as any)._core._inputHandler._curAttrData;
    attr.extended = attr.extended.clone();
    attr.extended.urlId = hoverId;
    attr.updateExtended();
  }

  public activate(terminal: Terminal): void {
    this._oscHandler = terminal.parser.registerOscHandler(8, data => {

      this._updateAttrs(terminal);

      if (data.indexOf(';') === -1) {
        return true;
      }
      const params = this._parseParams(data.slice(0, data.indexOf(';')));
      const url = this._filterUrl(data.slice(data.indexOf(';') + 1));
      console.log(params, url);

      if (!url) {
        return true;
      }

      let hoverId;
      if (params && params.id) {
        // check whether we already know that id and url
        const oldInternal = this._idMap[params.id];
        if (oldInternal && this._urlMap[oldInternal] === url) {
          hoverId = oldInternal;
        } else {
          hoverId = this._internalId++;
          this._idMap[params.id] = hoverId;
          this._urlMap[hoverId] = url;
        }
      } else {
        hoverId = this._internalId++;
        this._urlMap[hoverId] = url;
      }

      this._updateAttrs(terminal, hoverId);

      return true;
    });
    this._linkProvider = terminal.registerLinkProvider(new HyperlinkProvider(terminal, this._urlMap));
  }

  public dispose(): void {
    this._oscHandler?.dispose();
    this._linkProvider?.dispose();
    this._idMap = {};
    this._urlMap = {};
  }
}
