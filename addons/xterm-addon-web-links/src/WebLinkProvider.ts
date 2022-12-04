/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILinkProvider, ILink, Terminal, IViewportRange } from 'xterm';

export interface ILinkProviderOptions {
  hover?(event: MouseEvent, text: string, location: IViewportRange): void;
  leave?(event: MouseEvent, text: string): void;
  urlRegex?: RegExp;
}

export class WebLinkProvider implements ILinkProvider {

  constructor(
    private readonly _terminal: Terminal,
    private readonly _regex: RegExp,
    private readonly _handler: (event: MouseEvent, uri: string) => void,
    private readonly _options: ILinkProviderOptions = {}
  ) {

  }

  public provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void {
    const links = LinkComputer.computeLink(y, this._regex, this._terminal, this._handler);
    callback(this._addCallbacks(links));
  }

  private _addCallbacks(links: ILink[]): ILink[] {
    return links.map(link => {
      link.leave = this._options.leave;
      link.hover = (event: MouseEvent, uri: string): void => {
        if (this._options.hover) {
          const { range } = link;
          this._options.hover(event, uri, range);
        }
      };
      return link;
    });
  }
}

export class LinkComputer {
  public static computeLink(y: number, regex: RegExp, terminal: Terminal, activate: (event: MouseEvent, uri: string) => void): ILink[] {
    const rex = new RegExp(regex.source, (regex.flags || '') + 'g');

    const [lines, startLineIndex] = LinkComputer._getFullLineString(y - 1, terminal);

    // TODO: do locally limited search if string is too long
    const line = lines.join('');

    // Don't try if the wrapped line if excessively large as the regex matching will block the main
    // thread.
    if (line.length > 1024) {
      return [];
    }

    let match;
    let stringIndex = -1;
    const result: ILink[] = [];

    while ((match = rex.exec(line)) !== null) {
      const text = match[0];
      if (!text) {
        // something matched but does not comply with the given matchIndex
        // since this is most likely a bug the regex itself we simply do nothing here
        console.log('match found without corresponding matchIndex');
        break;
      }

      // Get index, match.index is for the outer match which includes negated chars
      // therefore we cannot use match.index directly, instead we search the position
      // of the match group in text again
      // also correct regex and string search offsets for the next loop run
      stringIndex = line.indexOf(text, stringIndex + 1);
      rex.lastIndex = stringIndex + text.length;
      if (stringIndex < 0) {
        // invalid stringIndex (should not have happened)
        break;
      }

      // check via URL if the matched text would form a proper url
      // NOTE: This outsources the ugly url parsing to the browser.
      // To avoid surprising auto expansion from URL we additionally
      // check afterwards if the provided string resembles the parsed
      // one close enough:
      // - decodeURI  decode path segement back to byte repr
      //              to detect unicode auto conversion correctly
      // - append /   also match domain urls w'o any path notion
      try {
        const url = new URL(text);
        const urlText = decodeURI(url.toString());
        if (text !== urlText && text + '/' !== urlText) {
          continue;
        }
      } catch (e) {
        continue;
      }


      const [startY, startX] = LinkComputer._mapStringIndexToBuffer(startLineIndex, stringIndex, terminal);
      const [endY, endX] = LinkComputer._mapStringIndexToBuffer(startLineIndex, stringIndex + text.length, terminal);

      if (startY === -1 || startX === -1 || endY === -1 || endX === -1) {
        continue;
      }

      const range = {
        start: {
          x: startX + 1,
          y: startY + 1
        },
        end: {
          x: endX + 1,
          y: endY
        }
      };

      result.push({ range, text, activate });
    }

    return result;
  }

  /**
   * Gets the entire line for the buffer line
   * @param lineIndex The index of the line being translated.
   */
  private static _getFullLineString(lineIndex: number, terminal: Terminal): [string[], number] {
    let line: any;

    // expand top
    let topIdx = lineIndex;
    while ((line = terminal.buffer.active.getLine(topIdx)) && line.isWrapped) {
      topIdx--;
    }

    // expand bottom
    let bottomIdx = lineIndex + 1;
    while ((line = terminal.buffer.active.getLine(bottomIdx)) && line.isWrapped) {
      bottomIdx++;
    }

    const lines: string[] = [];
    for (let idx = topIdx; idx < bottomIdx; ++idx) {
      lines.push(terminal.buffer.active.getLine(idx)?.translateToString(true)!);
    }

    return [lines, topIdx];
  }

  /**
   * Map a string index back to buffer positions.
   * Returns buffer position as [lineIndex, columnIndex] 0-based,
   * or [-1, -1] in case the lookup ran into a non-existing line.
   */
  private static _mapStringIndexToBuffer(lineIndex: number, stringIndex: number, terminal: Terminal): [number, number] {
    const buf = terminal.buffer.active;
    const cell = buf.getNullCell();
    while (stringIndex) {
      const line = buf.getLine(lineIndex);
      if (!line) {
        return [-1, -1];
      }
      for (let i = 0; i < line.length; ++i) {
        line.getCell(i, cell);
        const chars = cell.getChars();
        const width = cell.getWidth();
        if (width) {
          stringIndex -= chars.length || 1;
        }
        // look ahead for early wrap around of wide chars
        if (i === line.length - 1 && chars === '' && width) {
          const line = buf.getLine(lineIndex + 1);
          if (line && line.isWrapped) {
            line.getCell(0, cell);
            if (cell.getWidth() === 2) {
              stringIndex += 1;
            }
          }
        }
        if (stringIndex < 0) {
          return [lineIndex, i];
        }
      }
      lineIndex++;
    }
    return [lineIndex, 0];
  }
}
