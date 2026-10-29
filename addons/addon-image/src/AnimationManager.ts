/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IDisposable } from '@xterm/xterm';
import type { ImageRenderer } from './ImageRenderer';
import { ImageTileInfo, type ImageStorage } from './ImageStorage';
import type { IImageSpec, ITerminalExt, IResetHandler } from './Types';
import type { IMetrics } from 'IIPMetrics';


/**
 * Note on Firefox Bug (https://bugzilla.mozilla.org/show_bug.cgi?id=2066911)
 *
 * ImageDecoder.decode() returns a corrupted VideoFrame,
 * if the frame was closed from a previous decode.
 *
 * Therefore the AnimationManager class implements certain
 * firefox shims gated by the isFirefox boolean:
 * - IAnimation.highest tracks highest frameID ever decoded
 * - whenever frameID is lesser or equal zu highest create new decoder
 * - raw image bytes need to be held for new decoder
 *
 * To be removed once the bug got fixed.
 */


interface IAnimation {
  /** image id in storage */
  id: number;
  /** image bytes */
  data: Blob;
  /** metrics of the image */
  metrics: IMetrics;
  /** width */
  w: number;
  /** height */
  h: number;
  /** number of frames */
  numFrames: number;
  frames: number[];
  /** ImageDecoder instance */
  decoder: ImageDecoder | undefined;
  decoderPromise: Promise<ImageDecoder> | undefined;
  cache: BitmapBuffer;
  /** start timestamp */
  startTime: number | undefined;
  /** whether a decode task ist scheduled */
  scheduled: boolean;
  /** whether the image is in viewport */
  inViewport: boolean;
  /** firefox bug helper */
  highest: number;
  /** playtime of animation */
  playtime: number;
  /** frame timestamps */
  timestamps: number[];
  /** frame ID targeted by animation */
  current: number;
  /** frame ID currently visible (owned by spec.actual) */
  actual: number;
  /** idx of current on frames */
  frameIdx: number;
}


interface IImageDraw {
  imageId: number;
  imgSpec: IImageSpec;
  tileId: number;
  col: number;
  row: number;
  count: number;
}


interface IBufferSlot {
  id: number;
  bm: ImageBitmap | null;
}


const enum Constants {
  BUFFERSIZE = 4,
  BUFFERMOD = BUFFERSIZE - 1,
  MAX_FRAMES = 65535
}


class BitmapBuffer implements IDisposable {
  private readonly _d: IBufferSlot[];
  private _disposed = false;

  constructor() {
    this._d = Array(Constants.BUFFERSIZE).fill(0).map(() => ({ id: -1, bm: null }));
  }

  public dispose(): void {
    this.clear();
    this._disposed = true;
  }

  public peek(id: number): ImageBitmap | null {
    const slot = this._d[id & Constants.BUFFERMOD];
    return id === slot.id ? slot.bm : null;
  }

  public pop(id: number): ImageBitmap | null {
    const slot = this._d[id & Constants.BUFFERMOD];
    const res = id === slot.id
      ? slot.bm
      : (slot.bm?.close(), null);
    slot.bm = null;
    slot.id = -1;
    return res;
  }

  public push(id: number, bm: ImageBitmap): void {
    /**
     * A late decode task might still push bitmaps.
     * Since push gives the buffer ownership of
     * the bitmap, we use the isDisposed flag to
     * free it right away.
     */
    if (this._disposed) {
      bm.close();
      return;
    }
    const slot = this._d[id & Constants.BUFFERMOD];
    slot.bm?.close();
    slot.bm = bm;
    slot.id = id;
  }

  public clear(): void {
    for (let i = 0; i < Constants.BUFFERSIZE; ++i) {
      const slot = this._d[i];
      slot.bm?.close();
      slot.bm = null;
      slot.id = -1;
    }
  }
}


// eslint-disable-next-line
declare const InstallTrigger: any;


// FIXME: move to AnimationManager ctor to control it from xterm side
const isChromium = (window as any).chrome !== undefined;
const isFirefox: boolean = typeof InstallTrigger !== 'undefined' || 'MozAppearance' in document.documentElement.style;


/**
 * Helper to create a read to use ImageDecoder instance from a blob.
 */
async function BlobDecoder(blob: Blob, type: string): Promise<ImageDecoder> {
  /**
   * Dealing with browser bugs - in theory this should be possible:
   *
   *    const decoder = new ImageDecoder({ data: blob.stream(), type, preferAnimation: true });
   *    await decoder.tracks.ready;
   *    return decoder;
   *
   * But this straightforward handling with blob.stream() uncovers several bugs:
   * 1. Chromium: Fails to stream chunked blobs reliably.
   * 2. Firefox: Native lifecycle race condition. Closing an old decoder breaks the
   *    shared underlying native stream of the same blob for new decoders, throwing
   *    an uncatchable "Closed decoder" DOMException during `tracks.ready`.
   *
   * So we use a safer approach by pulling full raw bytes over first and transferring ownership.
   */
  const data = await blob.arrayBuffer();
  const decoder = new ImageDecoder({ data, type, preferAnimation: true, transfer: [data] });
  await decoder.tracks.ready;
  if (isChromium && type === 'image/avif') {
    // chromium bug: random frame access in AVIF is
    // only possible after reading frame 0
    const res = await decoder.decode({ frameIndex: 0 });
    res.image.close();
  }
  return decoder;
}


/**
 * AnimationManager - orchestrates rendering of animated images.
 *
 * Current Workflow
 * When IIPMetrics.imageType reports an animated image the IIP handler
 * stores the image in the storage and registers an animation of it.
 *
 * The animation manager works mostly self-contained:
 * - RAF loop
 * - 3 frame ahead decoding
 * - own bitmap ownership handling
 *
 * There are a few intersections with the ImageStorage and the ImageRenderer,
 * which still need to be consolidated (TODOs):
 * - ImageStorage: API for announcing memory state, better eviction strategy
 * - ImageRenderer: API for better drawing primitives
 *
 * In particular the ownership model of ImageSpec bitmaps (actual and orig)
 * needs a better story. We prolly need here an API to flip bitmaps.
 */
export class AnimationManager implements IDisposable, IResetHandler {
  private _animations = new Map<number, IAnimation>();
  private _animationFrame: number | undefined = undefined;
  private _draws: IImageDraw[] = [];


  constructor(
    private _storage: ImageStorage,
    private _renderer: ImageRenderer,
    private _terminal: ITerminalExt
  ) {}


  private _requestAF(cb: FrameRequestCallback): number | undefined {
    return this._terminal._core._coreBrowserService?.window.requestAnimationFrame(cb);
  }


  private _cancelAF(id: number): void | undefined {
    return this._terminal._core._coreBrowserService?.window.cancelAnimationFrame(id);
  }


  public dispose(): void {
    this.reset();
  }


  /**
   * Reset handler.
   * Stops all animations and frees all ressources.
   */
  public reset(): void {
    for (const anim of this._animations.values()) {
      anim.inViewport = false;
      this._closeDecoder(anim);
      anim.cache.dispose();
    }
    this._animations.clear();
    this._draws = [];
    if (this._animationFrame) this._cancelAF(this._animationFrame);
    this._animationFrame = undefined;
  }


  /**
   * Main hook to register an animated image for animation.
   *
   * @param id Image ID of the image storage the image was registered under.
   * @param data Raw data bytes of the image.
   * @param metrics Metrics of the image as returned by IIPMetrics.imageType.
   * @param w Output width in pixel.
   * @param h Output height in pixel.
   */
  public async registerAnimation(id: number, data: Blob, metrics: IMetrics, w: number, h: number): Promise<void> {
    let decoder = await BlobDecoder(data, metrics.mime);
    const track = decoder.tracks.selectedTrack;
    if (!track || track.frameCount < 2) {
      decoder.close();
      return;
    }

    const frameCount = Math.min(track.frameCount, Constants.MAX_FRAMES);
    const frames: number[] = [];
    const timestamps: number[] = [];
    const durations: number[] = [];
    let elapsed = 0;

    for (let i = 0; i < frameCount; i++) {
      try {
        const result = await decoder.decode({ frameIndex: i });
        const frame = result.image;
        const width = frame.displayWidth;
        const height = frame.displayHeight;
        const duration = (frame.duration ?? 0) / 1000;
        frame.close();
        // skip wrong dimensions and zero duration
        if (width !== metrics.width || height !== metrics.height || !duration) {
          if (durations.length) {
            durations[durations.length - 1] += duration;
            elapsed += duration;
          }
          continue;
        }
        frames.push(i);
        timestamps.push(elapsed);
        durations.push(duration);
        elapsed += duration;
      } catch {
        break;
      }
    }

    /**
     * FIXME: still needs a consolidation of short frame durations:
     * We don't track v-sync, but just decode the next 3 follow-up frames.
     * This creates nonsense decoder pressure decoding frames,
     * that effectively never make it to the screen.
     * Currently our shortest time resolution is 1ms,
     * thus with 60 fps we would decode 15 1ms frames for no reason.
     * We prolly should introduce a lower bound of 8ms:
     * - in sync with 120 fps
     * - only every second frame is nonsense with 60 fps
     */

    if (frames.length < 2 || elapsed <= 0) {
      decoder.close();
      return;
    }

    if (isFirefox) {
      decoder.close();
      decoder = await BlobDecoder(data, metrics.mime);
    }

    const anim: IAnimation = {
      id, data, w, h, decoder,
      metrics,
      numFrames: frames.length,
      decoderPromise: undefined,
      cache: new BitmapBuffer(),
      frames,
      startTime: undefined,
      current: 0,
      actual: 0,
      scheduled: false,  // set by _schedule
      inViewport: true,  // start with active prefetching
      highest: -1,
      playtime: elapsed,
      timestamps,
      frameIdx: 0
    };
    this._animations.set(id, anim);
    this.viewportUpdated();
    // early schedule to give decoder time to fill the cache before RAF
    this._schedule(anim);
    this._animationFrame ??= this._requestAF(this._loop);
  }


  /**
   * Remove the animation for the given image id.
   */
  public unregisterAnimation(id: number): void {
    const a = this._animations.get(id);
    if (a) {
      a.inViewport = false;
      this._closeDecoder(a);
      a.cache.dispose();
      this._animations.delete(id);
    }
  }


  /**
   * onRender handler.
   * Scratches the viewport buffer to collect draws for animation RAF
   * and to pause/resume invisible/visible animations.
   */
  public viewportUpdated(_range?: { start: number, end: number }): void {
    const rows = this._terminal.rows;
    const cols = this._terminal.cols;
    const buffer = this._terminal._core.buffer;
    const actives: Set<number> = new Set();
    this._draws = [];
    for (let row = 0; row < rows; ++row) {
      const line = buffer.lines.get(row + buffer.ydisp);
      if (!line) break;
      for (let col = 0; col < cols; ++col) {
        const e = line.getExtended(col)?.payload;
        if (e instanceof ImageTileInfo) {
          const imageId = e.imageId;
          if (imageId === undefined || imageId === -1) {
            continue;
          }
          const imgSpec = this._storage.getImage(imageId);
          if (e.tileId !== -1) {
            const startTile = e.tileId;
            const startCol = col;
            let count = 1;
            /**
             * merge tiles to the right into a single draw call, if:
             * - not at end of line
             * - cell has same image id
             * - cell has consecutive tile id
             */
            while (++col < cols) {
              const nextE = line.getExtended(col)?.payload;
              if (!(nextE instanceof ImageTileInfo) || nextE.imageId !== imageId || nextE.tileId !== startTile + count) {
                break;
              }
              count++;
            }
            col--;
            if (imgSpec && this._animations.has(imageId)) {
              this._draws.push({ imageId, imgSpec, tileId: startTile, col: startCol, row, count });
              actives.add(imageId);
            }
          }
        }
      }
    }
    this._updateAnimations(actives);
  }


  /**
   * Get the frameIdx for elapsed time.
   * Note: The returned value is not the frame ID,
   * but the index for IAnimation.frames.
   */
  private _timedFrameIdx(a: IAnimation, elapsed: number): number {
    elapsed %= a.playtime;
    let low = 0;
    let high = a.timestamps.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const startTime = a.timestamps[mid];
      if (elapsed < startTime) {
        high = mid - 1;
      } else {
        if (mid === a.timestamps.length - 1 || elapsed < a.timestamps[mid + 1]) {
          return mid;
        }
        low = mid + 1;
      }
    }
    return 0;
  }

  /**
   * Pause/resume decoding from viewport changes.
   */
  private _updateAnimations(visibles: Set<number>): void {
    for (const [id, anim] of this._animations) {
      const isVisible = visibles.has(id);
      if (isVisible && !anim.inViewport) {
        /**
        * There are two strategies possible here:
        *
        * 1. Resume decoding and pumping frames as soon as possible.
        * 2. Delay resuming further by a debounce to prevent flooding
        *    new decoder instances on heavy scrolling.
        *
        * Currently the code below does 1. as the impact is rather
        * small from tests and gives the better user experience.
        */
        anim.inViewport = true;
        const frameIdx = this._timedFrameIdx(anim, performance.now() - anim.startTime!);
        anim.frameIdx = frameIdx;
        anim.current = anim.frames[frameIdx];
        if (!anim.decoder && !anim.decoderPromise) {
          anim.decoderPromise = BlobDecoder(anim.data, anim.metrics.mime);
        }
        this._schedule(anim);
      } else if (!isVisible && anim.inViewport) {
        anim.inViewport = false;
        anim.cache.clear();
        this._closeDecoder(anim);
      }
    }
    if (visibles.size && this._animationFrame === undefined) {
      this._animationFrame = this._requestAF(this._loop);
    }
  }


  /**
   * RAF for animations in viewport.
   */
  private _loop = (ts: number): void => {
    if (!this._animations.size) {
      this._animationFrame = undefined;
      return;
    }

    let mustRender = false;
    let anyVisible = false;

    for (const anim of this._animations.values()) {
      if (!anim.inViewport) continue;

      const spec = this._storage.getImage(anim.id);
      if (!spec) {
        this.unregisterAnimation(anim.id);
        continue;
      }
      anyVisible = true;
      anim.startTime ??= ts;
      const frameIdx = this._timedFrameIdx(anim, ts - anim.startTime);
      anim.frameIdx = frameIdx;
      const current = anim.frames[frameIdx];

      if (current !== anim.current) {
        anim.current = current;
        const bm = anim.cache.pop(current);
        if (bm) {
          // FIXME: setting spec.actual delegates draws from onRender back to ImageStorage.render
          // --> should be avoided to prevent double draws within same AF
          // idea: create a mutex on image spec to tell storage.render to skip

          // by swapping spec.actual we take ownership, thus have to close it here
          // but only if we have more than 4 frames (ringbuffer size is 4)
          // for <= 4 frames we move the bitmap back into cache
          // FIXME: create a bitmap swapping API in storage
          if (spec.actual instanceof ImageBitmap) {
            if (anim.numFrames > Constants.BUFFERSIZE) {
              spec.actual.close();
            } else {
              anim.cache.push(anim.actual, spec.actual);
            }
          }
          spec.actual = bm;
          anim.actual = current;
          mustRender = true;
        }
        this._schedule(anim);
      }
    }

    // FIXME: merge clears and draws into col x row rects
    if (mustRender) {
      for (let i = 0; i < this._draws.length; ++i) {
        const d = this._draws[i];
        this._renderer.clearLines(d.row, d.row);
        this._renderer.draw(d.imgSpec, d.tileId, d.col, d.row, d.count);
      }
    }
    this._animationFrame = anyVisible ? this._requestAF(this._loop) : undefined;
  };


  /**
   * Try to schedule frame decoding.
   */
  private _schedule(a: IAnimation): void {
    if (!a.scheduled) {
      let needsSchedule = false;
      // FIXME: do we need a == 4 test too?
      if (a.numFrames > 3) {
        needsSchedule =
          !a.cache.peek(a.frames[(a.frameIdx + 1) % a.numFrames]) ||
          !a.cache.peek(a.frames[(a.frameIdx + 2) % a.numFrames]) ||
          !a.cache.peek(a.frames[(a.frameIdx + 3) % a.numFrames]);
      } else if (a.numFrames === 3) {
        needsSchedule =
          !a.cache.peek(a.frames[(a.frameIdx + 1) % a.numFrames]) ||
          !a.cache.peek(a.frames[(a.frameIdx + 2) % a.numFrames]);
      } else {
        needsSchedule =
          !a.cache.peek(a.frames[(a.frameIdx + 1) % a.numFrames]);
      }
      if (needsSchedule) {
        a.scheduled = true;
        setTimeout(() => this._decode(a), 0);
      }
    }
  }


  /**
   * Decode up to next 3 frames.
   */
  private async _decode(a: IAnimation): Promise<void> {
    if (!a.inViewport) {
      a.scheduled = false;
      return;
    }
    if (!a.decoder) {
      const decP = a.decoderPromise;
      a.decoderPromise = undefined;
      a.decoder = await (decP ?? BlobDecoder(a.data, a.metrics.mime));
    }
    const n1 = a.frames[(a.frameIdx + 1) % a.numFrames];
    const n2 = a.frames[(a.frameIdx + 2) % a.numFrames];
    const n3 = a.frames[(a.frameIdx + 3) % a.numFrames];
    for (const n of [n1, n2, n3]) {
      if (!a.cache.peek(n)) {
        if (isFirefox) {
          if (n <= a.highest) {
            a.highest = -1;
            a.decoder?.close();
            a.decoder = await BlobDecoder(a.data, a.metrics.mime);
          }
          a.highest = Math.max(n, a.highest);
        }
        let res: ImageDecodeResult;
        try {
          res = await a.decoder.decode({ frameIndex: n });
        } catch { continue; }
        let bm: ImageBitmap;
        try {
          // FIXME: we should not resize here yet
          // BETTER: rescale during draw:
          // - eases the GPU druing decoding
          // - rescales only what needs to be drawn
          // --> funneling down
          // FIXME: needs changes in image spec and rendering functions
          bm = await createImageBitmap(res.image, { resizeWidth: a.w, resizeHeight: a.h });
        } catch { continue; } finally { res?.image?.close(); }
        if (!a.inViewport) {
          bm.close();
          break;
        }
        a.cache.push(n, bm);
      }
    }
    a.scheduled = false;
  }


  /**
   * Close the decoder defensively.
   */
  private _closeDecoder(a: IAnimation): void {
    const decoder = a.decoder;
    a.decoder = undefined;
    try { decoder?.close(); } catch {}
    const decP = a.decoderPromise;
    a.decoderPromise = undefined;
    decP?.then(dec => dec && dec !== decoder ? dec.close() : null).catch(() => {});
  }
}
