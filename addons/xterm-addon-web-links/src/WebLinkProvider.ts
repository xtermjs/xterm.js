import { ILinkProvider, IBufferCellPosition, ILink, Terminal, IBuffer } from 'xterm';

export default class WebLinkProvider implements ILinkProvider {

  constructor(
    private readonly _terminal: Terminal,
    private readonly _regex: RegExp,
    private readonly _handler: (event: MouseEvent, uri: string) => void
  ) {

  }

  provideLink(position: IBufferCellPosition, callback: (link: ILink | undefined) => void): void {
    callback(LinkComputer.computeLink(position, this._regex, this._terminal.buffer, this._handler));
  }
}

export class LinkComputer {
  public static computeLink(position: IBufferCellPosition, regex: RegExp, buffer: IBuffer, handle: (event: MouseEvent, uri: string) => void): ILink | undefined {
    const rex = new RegExp(regex.source, (regex.flags || '') + 'g');
    const bufferLine = buffer.getLine(position.y - 1);

    if (!bufferLine) {
      return;
    }

    const line = bufferLine.translateToString();

    let match;
    let stringIndex = -1;

    while ((match = rex.exec(line)) !== null) {
      const url = match[1];
      if (!url) {
        // something matched but does not comply with the given matchIndex
        // since this is most likely a bug the regex itself we simply do nothing here
        console.log('match found without corresponding matchIndex');
        break;
      }

      // Get index, match.index is for the outer match which includes negated chars
      // therefore we cannot use match.index directly, instead we search the position
      // of the match group in text again
      // also correct regex and string search offsets for the next loop run
      stringIndex = line.indexOf(url, stringIndex + 1);
      rex.lastIndex = stringIndex + url.length;
      if (stringIndex < 0) {
        // invalid stringIndex (should not have happened)
        break;
      }

      const range = {
        start: {
          x: stringIndex + 1,
          y: position.y
        },
        end: {
          x: stringIndex + url.length + 1,
          y: position.y
        }
      };

      return { range, url, handle };
    }
  }
}
