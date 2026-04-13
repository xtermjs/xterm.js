/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferRange, ILink } from 'browser/Types';
import { ILinkProvider } from 'browser/services/Services';
import { CellData } from 'common/buffer/CellData';
import { IBufferLine } from 'common/Types';
import { IBufferService, IOptionsService, IOscLinkService } from 'common/services/Services';

export class OscLinkProvider implements ILinkProvider {
  private readonly _workCell = new CellData();

  constructor(
    @IBufferService private readonly _bufferService: IBufferService,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @IOscLinkService private readonly _oscLinkService: IOscLinkService
  ) {
  }

  public provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void {
    const line = this._bufferService.buffer.lines.get(y - 1);
    if (!line) {
      callback(undefined);
      return;
    }

    const result: ILink[] = [];
    const linkHandler = this._optionsService.rawOptions.linkHandler;
    const cell = this._workCell;
    const lineLength = line.getTrimmedLength();
    let currentLinkId = -1;
    let currentStart = -1;
    let finishLink = false;
    for (let x = 0; x < lineLength; x++) {
      // Minor optimization, only check for content if there isn't a link in case the link ends with
      // a null cell
      if (currentStart === -1 && !line.hasContent(x)) {
        continue;
      }

      line.loadCell(x, cell);
      if (cell.hasExtendedAttrs() && cell.extended.urlId) {
        if (currentStart === -1) {
          currentStart = x;
          currentLinkId = cell.extended.urlId;
          continue;
        } else {
          finishLink = cell.extended.urlId !== currentLinkId;
        }
      } else {
        if (currentStart !== -1) {
          finishLink = true;
        }
      }

      if (finishLink || (currentStart !== -1 && x === lineLength - 1)) {
        const text = this._oscLinkService.getLinkData(currentLinkId)?.uri;
        if (text) {
          const endX = x + (!finishLink && x === lineLength - 1 ? 1 : 0);
          const range = this._getRangeWithLineWrap(y, currentStart, endX, currentLinkId);
          let ignoreLink = false;
          if (!linkHandler?.allowNonHttpProtocols) {
            try {
              const parsed = new URL(text);
              if (!['http:', 'https:'].includes(parsed.protocol)) {
                ignoreLink = true;
              }
            } catch {
              // Ignore invalid URLs to prevent unexpected behaviors
              ignoreLink = true;
            }
          }

          if (!ignoreLink) {
            // OSC links always use underline and pointer decorations
            result.push({
              text,
              range,
              activate: (e, text) => (linkHandler ? linkHandler.activate(e, text, range) : defaultActivate(e, text)),
              hover: (e, text) => linkHandler?.hover?.(e, text, range),
              leave: (e, text) => linkHandler?.leave?.(e, text, range)
            });
          }
        }
        finishLink = false;

        // Clear link or start a new link if one starts immediately
        if (cell.hasExtendedAttrs() && cell.extended.urlId) {
          currentStart = x;
          currentLinkId = cell.extended.urlId;
        } else {
          currentStart = -1;
          currentLinkId = -1;
        }
      }
    }

    // TODO: Handle fetching and returning other link ranges to underline other links with the same
    //       id
    callback(result);
  }

  /**
   * Expand a single-line OSC 8 range to a contiguous wrapped range for the same link id.
   */
  private _getRangeWithLineWrap(y: number, startX: number, endX: number, linkId: number): IBufferRange {
    let startY = y;
    let finalStartX = startX;
    let endY = y;
    let finalEndX = endX;

    // Expand upward only when this segment starts at column 0 and the current line is wrapped.
    while (finalStartX === 0) {
      const currentLine = this._bufferService.buffer.lines.get(startY - 1);
      if (!currentLine?.isWrapped) {
        break;
      }
      const previousLine = this._bufferService.buffer.lines.get(startY - 2);
      if (!previousLine) {
        break;
      }
      const previousLineLength = previousLine.getTrimmedLength();
      if (previousLineLength === 0 || !this._hasUrlId(previousLine, previousLineLength - 1, linkId)) {
        break;
      }
      let previousStartX = previousLineLength - 1;
      while (previousStartX > 0 && this._hasUrlId(previousLine, previousStartX - 1, linkId)) {
        previousStartX--;
      }
      startY--;
      finalStartX = previousStartX;
    }

    // Expand downward only when this segment reaches trimmed EOL and the next line is wrapped.
    while (true) {
      const currentLine = this._bufferService.buffer.lines.get(endY - 1);
      if (!currentLine) {
        break;
      }
      const currentLineLength = currentLine.getTrimmedLength();
      if (finalEndX !== currentLineLength) {
        break;
      }
      const nextLine = this._bufferService.buffer.lines.get(endY);
      if (!nextLine?.isWrapped) {
        break;
      }
      const nextLineLength = nextLine.getTrimmedLength();
      if (nextLineLength === 0 || !this._hasUrlId(nextLine, 0, linkId)) {
        break;
      }
      let nextEndX = 1;
      while (nextEndX < nextLineLength && this._hasUrlId(nextLine, nextEndX, linkId)) {
        nextEndX++;
      }
      endY++;
      finalEndX = nextEndX;
    }

    // IBufferRange uses 1-based coordinates.
    return {
      start: {
        x: finalStartX + 1,
        y: startY
      },
      end: {
        x: finalEndX,
        y: endY
      }
    };
  }

  private _hasUrlId(line: IBufferLine, x: number, linkId: number): boolean {
    const cell = this._workCell;
    line.loadCell(x, cell);
    return !!cell.hasExtendedAttrs() && cell.extended.urlId === linkId;
  }
}

function defaultActivate(e: MouseEvent, uri: string): void {
  const answer = confirm(`Do you want to navigate to ${uri}?\n\nWARNING: This link could potentially be dangerous`);
  if (answer) {
    const newWindow = window.open();
    if (newWindow) {
      try {
        newWindow.opener = null;
      } catch {
        // no-op, Electron can throw
      }
      newWindow.location.href = uri;
    } else {
      console.warn('Opening link blocked as opener could not be cleared');
    }
  }
}
