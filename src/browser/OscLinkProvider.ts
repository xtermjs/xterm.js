/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILink, ILinkProvider } from 'browser/Types';
import { CellData } from 'common/buffer/CellData';
import { IBufferService, IOptionsService, IOscLinkService } from 'common/services/Services';

export class OscLinkProvider implements ILinkProvider {
  constructor(
    @IBufferService private readonly _bufferService: IBufferService,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @IOscLinkService private readonly _oscLinkService: IOscLinkService
  ) {
  }

  public provideLinks(y: number, callback: (links: ILink[] | undefined) => void): void {
    // OSC links only work when a link handler is set
    // if (this._optionsService.rawOptions.linkHandler === null) {
    //   return;
    // }

    const line = this._bufferService.buffer.lines.get(y - 1);
    if (!line) {
      callback(undefined);
      return;
    }

    const result: ILink[] = [];
    const cell = new CellData();
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
          const linkHandler = this._optionsService.rawOptions.linkHandler;
          // OSC links always use underline and pointer decorations
          result.push({
            text,
            // These ranges are 1-based
            range: {
              start: {
                // TODO: Adjacent links aren't working correctly
                x: currentStart + 1,
                y
              },
              end: {
                // Offset end x if it's a link that ends on the last cell in the line
                x: x + (!finishLink && x === lineLength - 1 ? 1 : 0),
                y
              }
            },
            activate: linkHandler?.activate || defaultActivate,
            hover: linkHandler?.hover,
            leave: linkHandler?.leave
          });
        }
        currentStart = -1;
        currentLinkId = -1;
        finishLink = false;
      }
    }
    // TODO: Handle fetching and returning other link ranges to underline other links with the same id
    callback(result);
  }
}

function defaultActivate(e: MouseEvent, uri: string): void {
  const answer = confirm(`Do you want to navigate to ${uri}?`);
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
