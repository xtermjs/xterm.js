/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILinkProvider, ILink, Terminal, IViewportRange } from '@xterm/xterm';

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

function isUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const parsedBase = url.password && url.username
      ? `${url.protocol}//${url.username}:${url.password}@${url.host}`
      : url.username
        ? `${url.protocol}//${url.username}@${url.host}`
        : `${url.protocol}//${url.host}`;
    return urlString.toLocaleLowerCase().startsWith(parsedBase.toLocaleLowerCase());
  } catch {
    return false;
  }
}

export class LinkComputer {
  public static computeLink(y: number, regex: RegExp, terminal: Terminal, activate: (event: MouseEvent, uri: string) => void): ILink[] {
    const rex = new RegExp(regex.source, (regex.flags || '') + 'g');

    const [lines, startLineIndex] = LinkComputer._getWindowedLineStrings(y - 1, terminal);
    const line = lines.join('');

    let match;
    const result: ILink[] = [];

    while (match = rex.exec(line)) {
      const text = match[0];

      // check via URL if the matched text would form a proper url
      if (!isUrl(text)) {
        continue;
      }

      // map string positions back to buffer positions
      // values are 0-based right side excluding
      const [startY, startX] = LinkComputer._mapStrIdx(terminal, startLineIndex, 0, match.index);
      const [endY, endX] = LinkComputer._mapStrIdx(terminal, startY, startX, text.length);

      if (startY === -1 || startX === -1 || endY === -1 || endX === -1) {
        continue;
      }

      // range expects values 1-based right side including, thus +1 except for endX
      const range = {
        start: {
          x: startX + 1,
          y: startY + 1
        },
        end: {
          x: endX,
          y: endY + 1
        }
      };

      result.push({ range, text, activate });
    }

    return result;
  }

  /**
   * Get wrapped content lines for the current line index.
   * The top/bottom line expansion stops at whitespaces or length > 2048.
   * Returns an array with line strings and the top line index.
   *
   * NOTE: We pull line strings with trimRight=true on purpose to make sure
   * to correctly match urls with early wrapped wide chars. This corrupts the string index
   * for 1:1 backmapping to buffer positions, thus needs an additional correction in _mapStrIdx.
   *
   * In addition to `isWrapped`, include a conservative fallback for lines that look like
   * URL continuations. This handles resize/reflow edge cases where wrap markers are stale.
   */
  private static _getWindowedLineStrings(lineIndex: number, terminal: Terminal): [string[], number] {
    const line = terminal.buffer.active.getLine(lineIndex);
    if (!line) {
      return [[], lineIndex];
    }

    let topIdx = lineIndex;
    let bottomIdx = lineIndex;
    const lines = [line.translateToString(true)];
    let hasProtocolContext = LinkComputer._containsProtocol(lines[0]);

    // expand top, stop on whitespaces or length > 2048
    let topLength = 0;
    let currentTopLine = line;
    while (topLength < 2048) {
      const previousLine = terminal.buffer.active.getLine(topIdx - 1);
      if (!previousLine) {
        break;
      }
      const previousContent = previousLine.translateToString(true);
      const currentTopContent = lines[0];
      const shouldExpandByWrap = currentTopLine.isWrapped && currentTopContent[0] !== ' ' && previousContent.indexOf(' ') === -1;
      const shouldExpandByContinuation = LinkComputer._isLikelyReflowUrlContinuation(previousContent, currentTopContent, hasProtocolContext);
      if (!shouldExpandByWrap && !shouldExpandByContinuation) {
        break;
      }
      topIdx--;
      topLength += previousContent.length;
      lines.unshift(previousContent);
      hasProtocolContext = hasProtocolContext || LinkComputer._containsProtocol(previousContent);
      currentTopLine = previousLine;
    }

    // expand bottom, stop on whitespaces or length > 2048
    let bottomLength = 0;
    let currentBottomContent = lines[lines.length - 1];
    while (bottomLength < 2048) {
      const nextLine = terminal.buffer.active.getLine(bottomIdx + 1);
      if (!nextLine) {
        break;
      }
      const nextContent = nextLine.translateToString(true);
      const shouldExpandByWrap = nextLine.isWrapped && nextContent.indexOf(' ') === -1;
      const shouldExpandByContinuation = LinkComputer._isLikelyReflowUrlContinuation(currentBottomContent, nextContent, hasProtocolContext);
      if (!shouldExpandByWrap && !shouldExpandByContinuation) {
        break;
      }
      bottomIdx++;
      bottomLength += nextContent.length;
      lines.push(nextContent);
      hasProtocolContext = hasProtocolContext || LinkComputer._containsProtocol(nextContent);
      currentBottomContent = nextContent;
    }

    return [lines, topIdx];
  }

  private static _containsProtocol(content: string): boolean {
    return /https?:\/\//i.test(content);
  }

  private static _isLikelyReflowUrlContinuation(left: string, right: string, hasProtocolContext: boolean): boolean {
    if (!left || !right) {
      return false;
    }
    if (left.indexOf(' ') !== -1 || right.indexOf(' ') !== -1) {
      return false;
    }
    if (!(hasProtocolContext || LinkComputer._containsProtocol(left) || LinkComputer._containsProtocol(right))) {
      return false;
    }
    return LinkComputer._isUrlBoundaryChar(left[left.length - 1]) && LinkComputer._isUrlBoundaryChar(right[0]);
  }

  private static _isUrlBoundaryChar(char: string | undefined): boolean {
    if (!char) {
      return false;
    }
    return /[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]/.test(char);
  }

  /**
   * Map a string index back to buffer positions.
   * Returns buffer position as [lineIndex, columnIndex] 0-based,
   * or [-1, -1] in case the lookup ran into a non-existing line.
   */
  private static _mapStrIdx(terminal: Terminal, lineIndex: number, rowIndex: number, stringIndex: number): [number, number] {
    const buf = terminal.buffer.active;
    const cell = buf.getNullCell();
    let start = rowIndex;
    while (stringIndex) {
      const line = buf.getLine(lineIndex);
      if (!line) {
        return [-1, -1];
      }
      for (let i = start; i < line.length; ++i) {
        line.getCell(i, cell);
        const chars = cell.getChars();
        const width = cell.getWidth();
        if (width) {
          stringIndex -= chars.length || 1;

          // correct stringIndex for early wrapped wide chars:
          // - currently only happens at last cell
          // - cells to the right are reset with chars='' and width=1 in InputHandler.print
          // - follow-up line must be wrapped and contain wide char at first cell
          // --> if all these conditions are met, correct stringIndex by +1
          if (i === line.length - 1 && chars === '') {
            const line = buf.getLine(lineIndex + 1);
            if (line && line.isWrapped) {
              line.getCell(0, cell);
              if (cell.getWidth() === 2) {
                stringIndex += 1;
              }
            }
          }
        }
        if (stringIndex < 0) {
          return [lineIndex, i];
        }
      }
      lineIndex++;
      start = 0;
    }
    return [lineIndex, start];
  }
}
