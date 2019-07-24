/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { generateConfig, configEquals } from 'browser/renderer/atlas/CharAtlasUtils';
import { BaseCharAtlas } from 'browser/renderer/atlas/BaseCharAtlas';
import { DynamicCharAtlas } from 'browser/renderer/atlas/DynamicCharAtlas';
import { ICharAtlasConfig } from 'browser/renderer/atlas/Types';
import { IColorSet } from 'browser/Types';
import { ITerminalOptions } from 'common/services/Services';

interface ICharAtlasCacheEntry {
  atlas: BaseCharAtlas;
  config: ICharAtlasConfig;
  // N.B. This implementation potentially holds onto copies of the terminal forever, so
  // this may cause memory leaks.
  ownedBy: number[];
}

const charAtlasCache: ICharAtlasCacheEntry[] = [];

/**
 * Acquires a char atlas, either generating a new one or returning an existing
 * one that is in use by another terminal.
 */
export function acquireCharAtlas(
  options: ITerminalOptions,
  rendererId: number,
  colors: IColorSet,
  scaledCharWidth: number,
  scaledCharHeight: number
): BaseCharAtlas {
  const newConfig = generateConfig(scaledCharWidth, scaledCharHeight, options, colors);

  // Check to see if the renderer already owns this config
  for (let i = 0; i < charAtlasCache.length; i++) {
    const entry = charAtlasCache[i];
    const ownedByIndex = entry.ownedBy.indexOf(rendererId);
    if (ownedByIndex >= 0) {
      if (configEquals(entry.config, newConfig)) {
        return entry.atlas;
      }
      // The configs differ, release the renderer from the entry
      if (entry.ownedBy.length === 1) {
        entry.atlas.dispose();
        charAtlasCache.splice(i, 1);
      } else {
        entry.ownedBy.splice(ownedByIndex, 1);
      }
      break;
    }
  }

  // Try match a char atlas from the cache
  for (let i = 0; i < charAtlasCache.length; i++) {
    const entry = charAtlasCache[i];
    if (configEquals(entry.config, newConfig)) {
      // Add the renderer to the cache entry and return
      entry.ownedBy.push(rendererId);
      return entry.atlas;
    }
  }

  const newEntry: ICharAtlasCacheEntry = {
    atlas: new DynamicCharAtlas(
      document,
      newConfig
    ),
    config: newConfig,
    ownedBy: [rendererId]
  };
  charAtlasCache.push(newEntry);
  return newEntry.atlas;
}

/**
 * Removes a terminal reference from the cache, allowing its memory to be freed.
 */
export function removeTerminalFromCache(rendererId: number): void {
  for (let i = 0; i < charAtlasCache.length; i++) {
    const index = charAtlasCache[i].ownedBy.indexOf(rendererId);
    if (index !== -1) {
      if (charAtlasCache[i].ownedBy.length === 1) {
        // Remove the cache entry if it's the only renderer
        charAtlasCache[i].atlas.dispose();
        charAtlasCache.splice(i, 1);
      } else {
        // Remove the reference from the cache entry
        charAtlasCache[i].ownedBy.splice(index, 1);
      }
      break;
    }
  }
}
