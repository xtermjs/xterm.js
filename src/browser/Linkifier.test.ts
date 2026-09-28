/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { IBufferService } from '../common/services/Services';
import { Linkifier } from './Linkifier';
import { MockBufferService } from '../common/TestUtils.test';
import { ILink } from './Types';
import { LinkProviderService } from './services/LinkProviderService';
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
  let dom: jsdom.JSDOM;
  let element: HTMLElement;
  let bufferService: IBufferService;
  let linkifier: TestLinkifier2;
  let activations: number[];

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
    activate: e => activations.push(e.button)
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
    dom = new jsdom.JSDOM();
    element = dom.window.document.createElement('div');
    activations = [];
    bufferService = new MockBufferService(100, 10);
    const mouseCoordsService = { getCoords: () => [link.range.start.x, link.range.start.y] } as any;
    linkifier = new TestLinkifier2(element, mouseCoordsService, null!, bufferService, new LinkProviderService());
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

  it('only the primary button activates links', () => {
    for (const button of [0, 1, 2]) {
      element.dispatchEvent(new dom.window.MouseEvent('mousedown', { button }));
      element.dispatchEvent(new dom.window.MouseEvent('mouseup', { button }));
    }
    assert.deepEqual(activations, [0]);
  });
});
