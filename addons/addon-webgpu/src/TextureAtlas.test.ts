/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { AtlasPage } from './TextureAtlas';

function createPage(): AtlasPage {
  const context = {} as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context
  } as unknown as HTMLCanvasElement;
  const document = {
    createElement: () => canvas
  } as unknown as Document;
  return new AtlasPage(document, 64);
}

describe('TextureAtlas dirty history', () => {
  it('merges touching dirty rectangles', () => {
    const page = createPage();
    const initialVersion = page.version;

    page.markDirty(1, 2, 3, 4);
    page.markDirty(4, 2, 2, 4);

    assert.deepEqual(page.getDirtyRectsSince(initialVersion), [{
      x: 1,
      y: 2,
      width: 5,
      height: 4,
      version: page.version
    }]);
  });

  it('keeps dirty history available to independent consumers', () => {
    const page = createPage();
    const initialVersion = page.version;
    page.markDirty(1, 1, 2, 2);
    const firstVersion = page.version;
    page.markDirty(10, 10, 2, 2);

    assert.lengthOf(page.getDirtyRectsSince(initialVersion)!, 2);
    assert.lengthOf(page.getDirtyRectsSince(firstVersion)!, 1);
    assert.lengthOf(page.getDirtyRectsSince(initialVersion)!, 2);
  });

  it('falls back to a full upload after retained history overflows', () => {
    const page = createPage();
    const initialVersion = page.version;
    for (let i = 0; i < 257; i++) {
      page.markDirty(i * 2, 0, 1, 1);
    }
    assert.isUndefined(page.getDirtyRectsSince(initialVersion));
  });

  it('falls back to a full upload after layout invalidation', () => {
    const page = createPage();
    const initialVersion = page.version;
    page.markDirty(1, 1, 2, 2);
    page.invalidateDirtyHistory();
    assert.isUndefined(page.getDirtyRectsSince(initialVersion));
  });
});
