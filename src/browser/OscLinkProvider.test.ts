/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { OscLinkProvider } from 'browser/OscLinkProvider';
import { ILink } from 'browser/Types';
import { createCellData, MockBufferService, MockOptionsService } from 'common/TestUtils.test';
import { IBufferService, IOscLinkService } from 'common/services/Services';
import { IBufferLine, IOscLinkData } from 'common/Types';

class TestOscLinkService implements IOscLinkService {
  public serviceBrand: any;
  public registerLink(_linkData: IOscLinkData): number { return 0; }
  public addLineToLink(_linkId: number, _y: number): void { }
  public getLinkData(linkId: number): IOscLinkData | undefined {
    return { uri: `https://example.com/${linkId}` };
  }
}

function setText(line: IBufferLine | undefined, x: number, text: string): void {
  if (!line) {
    throw new Error('Missing buffer line');
  }
  for (let i = 0; i < text.length; i++) {
    line.setCell(x + i, createCellData(0, text[i], 1));
  }
}

function setUrl(line: IBufferLine | undefined, x: number, text: string, linkId: number): void {
  if (!line) {
    throw new Error('Missing buffer line');
  }
  for (let i = 0; i < text.length; i++) {
    const cell = createCellData(0, text[i], 1);
    cell.extended.urlId = linkId;
    cell.updateExtended();
    line.setCell(x + i, cell);
  }
}

function getLinks(provider: OscLinkProvider, y: number): Promise<ILink[]> {
  return new Promise(resolve => provider.provideLinks(y, links => resolve(links ?? [])));
}

describe('OscLinkProvider', () => {
  let bufferService: IBufferService;
  let provider: OscLinkProvider;

  beforeEach(() => {
    const optionsService = new MockOptionsService();
    bufferService = new MockBufferService(5, 5, optionsService);
    provider = new OscLinkProvider(bufferService, optionsService, new TestOscLinkService());
  });

  it('expands a wrapped link range backward to the previous line', async () => {
    const line1 = bufferService.buffer.lines.get(0);
    const line2 = bufferService.buffer.lines.get(1);
    setText(line1, 0, 'aa');
    setUrl(line1, 2, 'bbb', 1);
    setUrl(line2, 0, 'cccc', 1);
    setText(line2, 4, 'x');
    line2!.isWrapped = true;

    const links = await getLinks(provider, 2);
    assert.lengthOf(links, 1);
    assert.deepEqual(links[0].range, {
      start: { x: 3, y: 1 },
      end: { x: 4, y: 2 }
    });
  });

  it('expands a wrapped link range forward when a link ends at line boundary', async () => {
    const line1 = bufferService.buffer.lines.get(0);
    const line2 = bufferService.buffer.lines.get(1);
    setUrl(line1, 0, 'aaaaa', 1);
    setUrl(line2, 0, 'bb', 1);
    setText(line2, 2, 'ccc');
    line2!.isWrapped = true;

    const links = await getLinks(provider, 1);
    assert.lengthOf(links, 1);
    assert.deepEqual(links[0].range, {
      start: { x: 1, y: 1 },
      end: { x: 2, y: 2 }
    });
  });

  it('does not merge wrapped links with different url ids', async () => {
    const line1 = bufferService.buffer.lines.get(0);
    const line2 = bufferService.buffer.lines.get(1);
    setUrl(line1, 0, 'aaaaa', 1);
    setUrl(line2, 0, 'bbb', 2);
    setText(line2, 3, 'cc');
    line2!.isWrapped = true;

    const links = await getLinks(provider, 1);
    assert.lengthOf(links, 1);
    assert.deepEqual(links[0].range, {
      start: { x: 1, y: 1 },
      end: { x: 5, y: 1 }
    });
  });
});
