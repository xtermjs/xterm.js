/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { IBufferService } from '../common/services/Services';
import { Linkifier } from './Linkifier';
import { MockBufferService } from '../common/TestUtils.test';
import { ILink, ILinkWithState } from './Types';
import { LinkProviderService } from './services/LinkProviderService';
import { IMouseCoordsService, IRenderService } from './services/Services';
import { Emitter } from '../common/Event';
import { CellData } from '../common/buffer/CellData';
import jsdom = require('jsdom');

class TestLinkifier2 extends Linkifier {
  public set currentLink(link: any) {
    this._currentLink = link;
  }

  public linkHover(element: HTMLElement, link: ILink, event: MouseEvent): void {
    this._linkHover(element, link, event);
  }

  public linkLeave(element: HTMLElement, link: ILink, event: MouseEvent): void {
    this._linkLeave(element, link, event);
  }
}

describe('Linkifier2', () => {
  let bufferService: IBufferService;
  let linkifier: TestLinkifier2;

  const link: ILink = {
    text: 'foo',
    range: {
      start: {
        x: 5,
        y: 1
      },
      end: {
        x: 7,
        y: 1
      }
    },
    activate: () => { }
  };
  const multiLineLink: ILink = {
    text: 'foo',
    range: {
      start: {
        x: 2,
        y: 1
      },
      end: {
        x: 4,
        y: 2
      }
    },
    activate: () => { }
  };

  beforeEach(() => {
    const dom = new jsdom.JSDOM();
    bufferService = new MockBufferService(100, 10);
    linkifier = new TestLinkifier2(dom.window.document.createElement('div'), null!, null!, bufferService, new LinkProviderService());
    linkifier.currentLink = {
      link,
      state: {
        decorations: {
          underline: true,
          pointerCursor: true
        },
        isHovered: true
      }
    };
  });

  it('onShowLinkUnderline event range is correct', done => {
    linkifier.onShowLinkUnderline(e => {
      assert.equal(link.range.start.x - 1, e.x1);
      assert.equal(link.range.start.y - 1, e.y1);
      assert.equal(link.range.end.x, e.x2);
      assert.equal(link.range.end.y - 1, e.y2);

      done();
    });

    linkifier.linkHover({ classList: { add: () => { } } } as any, link, {} as any);
  });

  it('onHideLinkUnderline event range is correct', done => {
    linkifier.onHideLinkUnderline(e => {
      assert.equal(link.range.start.x - 1, e.x1);
      assert.equal(link.range.start.y - 1, e.y1);
      assert.equal(link.range.end.x, e.x2);
      assert.equal(link.range.end.y - 1, e.y2);

      done();
    });

    linkifier.linkLeave({ classList: { add: () => { } } } as any, link, {} as any);
  });

  it('onShowLinkUnderline event range is correct for wrapped links', done => {
    linkifier.onShowLinkUnderline(e => {
      assert.equal(multiLineLink.range.start.x - 1, e.x1);
      assert.equal(multiLineLink.range.start.y - 1, e.y1);
      assert.equal(multiLineLink.range.end.x, e.x2);
      assert.equal(multiLineLink.range.end.y - 1, e.y2);

      done();
    });

    linkifier.linkHover({ classList: { add: () => { } } } as any, multiLineLink, {} as any);
  });

  it('onHideLinkUnderline event range is correct for wrapped links', done => {
    linkifier.onHideLinkUnderline(e => {
      assert.equal(multiLineLink.range.start.x - 1, e.x1);
      assert.equal(multiLineLink.range.start.y - 1, e.y1);
      assert.equal(multiLineLink.range.end.x, e.x2);
      assert.equal(multiLineLink.range.end.y - 1, e.y2);

      done();
    });

    linkifier.linkLeave({ classList: { add: () => { } } } as any, multiLineLink, {} as any);
  });

  it('should keep links on different wrapped rows that share x ranges', () => {
    const createLink = (startX: number, startY: number, endX: number, endY: number): ILink => ({
      text: 'foo',
      range: { start: { x: startX, y: startY }, end: { x: endX, y: endY } },
      activate: () => { }
    });
    const wrappedLink = createLink(5, 1, 10, 2);
    const secondRowLink = createLink(20, 2, 30, 2);
    const overlappingLink = createLink(8, 2, 12, 2);
    const linkProviderService = new LinkProviderService();
    linkProviderService.registerLinkProvider({ provideLinks: (y, callback) => callback([wrappedLink]) });
    linkProviderService.registerLinkProvider({ provideLinks: (y, callback) => callback([secondRowLink, overlappingLink]) });
    const dom = new jsdom.JSDOM();
    const wrappedLinkifier = new TestLinkifier2(dom.window.document.createElement('div'), null!, null!, bufferService, linkProviderService) as any;
    wrappedLinkifier._isMouseOut = false;

    wrappedLinkifier._askForLink({ x: 1, y: 1 }, false);

    const replies = wrappedLinkifier._activeProviderReplies;
    assert.deepEqual(replies.get(0).map((e: { link: ILink }) => e.link), [wrappedLink]);
    assert.deepEqual(replies.get(1).map((e: { link: ILink }) => e.link), [secondRowLink]);
  });

  function linkRange(startX: number, startY: number, endX: number, endY: number): ILink {
    return {
      text: 'foo',
      range: { start: { x: startX, y: startY }, end: { x: endX, y: endY } },
      activate: () => { }
    };
  }

  function keptLinks(y: number, providerLinks: ILink[][]): ILink[][] {
    const linkProviderService = new LinkProviderService();
    for (const links of providerLinks) {
      linkProviderService.registerLinkProvider({
        provideLinks: (_line, callback) => callback(links)
      });
    }
    const dom = new jsdom.JSDOM();
    const wrappedLinkifier = new TestLinkifier2(dom.window.document.createElement('div'), null!, null!, bufferService, linkProviderService) as any;
    wrappedLinkifier._isMouseOut = false;
    wrappedLinkifier._askForLink({ x: 1, y }, false);
    const replies = wrappedLinkifier._activeProviderReplies;
    return providerLinks.map((_, i) => (replies.get(i) ?? []).map((e: { link: ILink }) => e.link));
  }

  it('should keep adjacent links and drop links that share a cell', () => {
    const first = linkRange(1, 1, 5, 1);
    const adjacent = linkRange(6, 1, 10, 1);
    const overlap = linkRange(10, 1, 12, 1);
    assert.deepEqual(keptLinks(1, [[first], [adjacent, overlap]]), [[first], [adjacent]]);
  });

  it('should keep a link adjacent across a wrap and drop one that shares the end cell', () => {
    const wrapped = linkRange(5, 1, 10, 2);
    const adjacent = linkRange(11, 2, 20, 2);
    const sharingEnd = linkRange(10, 2, 15, 2);
    assert.deepEqual(keptLinks(1, [[wrapped], [adjacent, sharingEnd]]), [[wrapped], [adjacent]]);
  });

  it('should keep a link that only overlaps a link which was dropped', () => {
    const kept = linkRange(10, 1, 20, 1);
    const dropped = linkRange(5, 1, 15, 1);
    const onlyOverlapsDropped = linkRange(5, 1, 8, 1);
    assert.deepEqual(keptLinks(1, [[kept], [dropped, onlyOverlapsDropped]]), [[kept], [onlyOverlapsDropped]]);
  });

  it('should keep a non-overlapping link beside a link spanning many wrapped rows', () => {
    const longLink = linkRange(1, 1, 5, 1000);
    const beside = linkRange(6, 1000, 10, 1000);
    const overlap = linkRange(3, 1000, 8, 1000);
    assert.deepEqual(keptLinks(1, [[longLink], [beside, overlap]]), [[longLink], [beside]]);
  });

  describe('hovered link during unrelated row updates', () => {
    let dom: jsdom.JSDOM;
    let element: HTMLElement;
    let onRenderedViewportChange: Emitter<{ start: number, end: number }>;
    let hoverLinkifier: TestLinkifier2;
    let hovers: number;
    let leaves: number;
    // Buffer rows are 0-based, link ranges and mouse positions 1-based
    const linkRow = 2;

    function writeRow(row: number, text: string): void {
      const line = bufferService.buffer.lines.get(row)!;
      line.fill(new CellData());
      for (let x = 0; x < text.length; x++) {
        line.setCell(x, CellData.fromCharData([0, text[x], 1, text.charCodeAt(x)]));
      }
    }

    function currentLink(): ILinkWithState | undefined {
      return (hoverLinkifier as any)._currentLink;
    }

    function render(start: number, end: number): void {
      onRenderedViewportChange.fire({ start, end });
    }

    beforeEach(() => {
      dom = new jsdom.JSDOM();
      element = dom.window.document.createElement('div');
      onRenderedViewportChange = new Emitter();
      const renderService = { onRenderedViewportChange: onRenderedViewportChange.event } as unknown as IRenderService;
      // The pointer rests on the link, which spans columns 1-19 of row 2
      const mouseCoordsService = { getCoords: () => [5, linkRow] } as unknown as IMouseCoordsService;
      const linkProviderService = new LinkProviderService();
      hovers = 0;
      leaves = 0;
      linkProviderService.registerLinkProvider({
        provideLinks: (y, callback) => {
          const text = bufferService.buffer.lines.get(y - 1)!.translateToString(true);
          const match = /https?:\/\/\S+/.exec(text);
          if (!match) {
            callback(undefined);
            return;
          }
          callback([{
            text: match[0],
            range: { start: { x: match.index + 1, y }, end: { x: match.index + match[0].length, y } },
            activate: () => { },
            hover: () => hovers++,
            leave: () => leaves++
          }]);
        }
      });
      writeRow(linkRow - 1, 'https://example.com');
      hoverLinkifier = new TestLinkifier2(element, mouseCoordsService, renderService, bufferService, linkProviderService);
      element.dispatchEvent(new dom.window.MouseEvent('mousemove'));
      assert.isDefined(currentLink());
      assert.equal(hovers, 1);
    });

    it('should keep the link when a render range covers it but only other rows changed', () => {
      for (let i = 0; i < 5; i++) {
        // Rows 1 and 9 change; their render is coalesced into one range over the link's row
        writeRow(0, `frame ${i}`);
        writeRow(8, `frame ${i}`);
        render(0, 8);
      }
      assert.equal(leaves, 0);
      assert.equal(hovers, 1);
      assert.isDefined(currentLink());
    });

    it('should re-evaluate the link when its own row changes', () => {
      writeRow(linkRow - 1, 'https://example.org');
      render(0, 8);
      assert.equal(leaves, 1);
      assert.equal(hovers, 2);
      assert.equal(currentLink()!.link.text, 'https://example.org');
    });

    it('should clear the link when its row no longer holds a link', () => {
      writeRow(linkRow - 1, 'no link here anymore');
      render(linkRow - 1, linkRow - 1);
      assert.equal(leaves, 1);
      assert.equal(hovers, 1);
      assert.isUndefined(currentLink());
    });
  });
});
