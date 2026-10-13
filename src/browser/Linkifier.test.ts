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
import { IMouseCoordsService, IRenderService } from './services/Services';
import { Emitter } from '../common/Event';
import jsdom = require('jsdom');

class TestLinkifier2 extends Linkifier {
  public set currentLink(link: any) {
    this._currentLink = link;
  }

  // Declaring only the setter would shadow the base class accessor pair, so
  // reads of currentLink would be undefined however the link was set.
  public get currentLink(): any {
    return this._currentLink;
  }

  public linkHover(element: HTMLElement, link: ILink, event: MouseEvent): void {
    this._linkHover(element, link, event);
  }

  public linkLeave(element: HTMLElement, link: ILink, event: MouseEvent): void {
    this._linkLeave(element, link, event);
  }
}

/**
 * Minimal render service stub exposing only what Linkifier listens to in its
 * constructor (onRenderedViewportChange).
 */
class TestRenderService implements Partial<IRenderService> {
  private readonly _onRenderedViewportChange = new Emitter<{ start: number, end: number }>();
  public readonly onRenderedViewportChange = this._onRenderedViewportChange.event;
  public fireRenderedViewportChange(start: number, end: number): void {
    this._onRenderedViewportChange.fire({ start, end });
  }
}

describe('Linkifier2', () => {
  let dom: jsdom.JSDOM;
  let element: HTMLElement;
  let renderService: TestRenderService;
  let linkProviderService: LinkProviderService;
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
    dom = new jsdom.JSDOM();
    element = dom.window.document.createElement('div');
    bufferService = new MockBufferService(100, 10);
    renderService = new TestRenderService();
    linkProviderService = new LinkProviderService();
    const mouseCoordsService = { getCoords: () => [6, 1] } as unknown as IMouseCoordsService;
    linkifier = new TestLinkifier2(element, mouseCoordsService, renderService as unknown as IRenderService, bufferService, linkProviderService);
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

  it('should re-evaluate links when a line changes under a stationary pointer', async () => {
    linkifier.currentLink = undefined;
    let provideCalls = 0;
    const pointerLink: ILink = {
      text: 'http://example.com/',
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
    linkProviderService.registerLinkProvider({
      provideLinks: (y: number, callback: (links: ILink[] | undefined) => void) => {
        provideCalls++;
        // First query: the line under the pointer has no link yet. After the line's
        // content changed (e.g. output scrolled it under the pointer): a link exists.
        callback(provideCalls === 1 ? undefined : [pointerLink]);
      }
    });

    // The pointer hovers the still-empty line, caching the "no link" answer for it
    element.dispatchEvent(new dom.window.MouseEvent('mousemove'));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(provideCalls, 1);
    assert.isUndefined(linkifier.currentLink);

    // Mouse movement within the same cell must not trigger a new query
    element.dispatchEvent(new dom.window.MouseEvent('mousemove'));
    await new Promise(r => setTimeout(r, 0));
    assert.equal(provideCalls, 1);

    // The viewport renders a change on the line under the stationary pointer
    renderService.fireRenderedViewportChange(0, 5);
    // Comfortably past the 50ms debounce so a loaded machine cannot fail this
    await new Promise(r => setTimeout(r, 250));

    assert.equal(provideCalls, 2, 'providers should be asked again after the line changed under the pointer');
    assert.isDefined(linkifier.currentLink, 'the link under the stationary pointer should be detected');
  });

});
