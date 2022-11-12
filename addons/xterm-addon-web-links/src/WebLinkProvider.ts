/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILinkProvider, ILink, Terminal, IViewportRange, IBufferLine } from 'xterm';

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

export interface IMatchRange {
  start: number;
  end: number;
  text: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export class LinkComputer {
  public static computeLink(y: number, regex: RegExp, terminal: Terminal, activate: (event: MouseEvent, uri: string) => void): ILink[] {
    const rex = new RegExp(regex.source, (regex.flags || '') + 'g');

    const [lines, lineText, startLineIndex] = LinkComputer._translateBufferLineToStringWithWrap(y - 1, false, terminal);

    // Don't try if the wrapped line if excessively large as the regex matching will block the main
    // thread.
    if (lineText.length > 1024) {
      return [];
    }

    let match;
    let stringIndex = -1;

    const matchRanges: IMatchRange[] = [];
    while ((match = rex.exec(lineText)) !== null) {
      const text = match[1];
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
      let start = -1;
      start = lineText.indexOf(text, stringIndex + 1);
      let end = -1;
      if (start > -1) {
        end = start + text.length;
      }
      stringIndex = end;
      if (start > -1 && end > -1) {
        matchRanges.push({
          start: start,
          text: text,
          end: start + text.length,
          startX: -1,
          startY: -1,
          endX: -1,
          endY: -1
        });
        rex.lastIndex = stringIndex + text.length;
      }
    }

    // Convert the matched text position range to buffer offsets range in the double byte character scenario
    let stringX = 0;
    let lineY = startLineIndex + 1;
    let matchIndex = 0;
    lines.forEach(line => {
      if (line.length > 1024) {
        return [];
      }
      for (let x = 0; x < line.length; x++) {
        if (matchRanges[matchIndex]) {
          if (stringX === matchRanges[matchIndex].start) {
            matchRanges[matchIndex].startX = x + 1;
            matchRanges[matchIndex].startY = lineY;
          }
          if (stringX === matchRanges[matchIndex].end) {
            matchRanges[matchIndex].endX = x;
            matchRanges[matchIndex].endY = lineY;

            matchIndex++;
          }
          if (line.getCell(x)?.getChars()) {
            stringX++;
          }
        }
      }
      lineY++;
    });

    return matchRanges.map(r => {
      return {
        range: {
          start: {
            x: r.startX,
            y: r.startY
          },
          end: {
            x: r.endX,
            y: r.endY
          }
        },
        text: r.text,
        activate
      };
    });
  }

  /**
   * Gets the entire line for the buffer line
   * @param lineIndex The index of the line being translated.
   * @param trimRight Whether to trim whitespace to the right.
   */
  private static _translateBufferLineToStringWithWrap(lineIndex: number, trimRight: boolean, terminal: Terminal): [IBufferLine[], string, number] {
    let lineString = '';
    let lineWrapsToNext: boolean;
    let prevLinesToWrap: boolean;
    const lines: IBufferLine[] = [];
    do {
      const line = terminal.buffer.active.getLine(lineIndex);
      if (!line) {
        break;
      }

      if (line.isWrapped) {
        lineIndex--;
      }

      prevLinesToWrap = line.isWrapped;
    } while (prevLinesToWrap);

    const startLineIndex = lineIndex;

    do {
      const nextLine = terminal.buffer.active.getLine(lineIndex + 1);
      lineWrapsToNext = nextLine ? nextLine.isWrapped : false;
      const line = terminal.buffer.active.getLine(lineIndex);
      if (!line) {
        break;
      }
      lines.push(line);
      lineString += line.translateToString(!lineWrapsToNext && trimRight).substring(0, terminal.cols);
      lineIndex++;
    } while (lineWrapsToNext);

    return [lines, lineString, startLineIndex];
  }
}
