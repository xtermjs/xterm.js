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
  public static computeLink(position: IBufferCellPosition, regex: RegExp, buffer: IBuffer, handler: (event: MouseEvent, uri: string) => void): ILink | undefined {
    const rex = new RegExp(regex.source, (regex.flags || '') + 'g');
    const bufferLine = buffer.getLine(position.y - 1);

    if (!bufferLine) {
      return;
    }

    const line = bufferLine.translateToString();

    let match;
    let stringIndex = -1;

    // while ((match = rex.exec(line)) !== null) {
    //   const uri = match[1];
    // }

  }
}
