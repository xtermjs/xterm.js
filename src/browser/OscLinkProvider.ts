/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILink, ILinkProvider } from 'browser/Types';
import { CellData } from 'common/buffer/CellData';
import { IBufferService, IOscLinkService } from 'common/services/Services';

export class OscLinkProvider implements ILinkProvider {
  constructor(
    @IBufferService private readonly _bufferService: IBufferService,
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
          // OSC links always use underline and pointer decorations
          result.push({
            text,
            // These ranges are 1-based
            range: {
              start: {
                x: currentStart + 1,
                y
              },
              end: {
                // Offset end x if it's a link that ends on the last cell in the line
                x: x + (!finishLink && x === lineLength - 1 ? 1 : 0),
                y
              }
            },
            activate(e, text) {
              console.log('activate!', text);
            }
            // TODO: Embedder API to handle hover
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
