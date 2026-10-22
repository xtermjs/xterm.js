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
});
