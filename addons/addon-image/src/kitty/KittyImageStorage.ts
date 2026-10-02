/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from '@xterm/xterm';
import { ImageStorage } from '../ImageStorage';
import { ImageLayer, IAddImageOpts } from '../Types';
import { IKittyImageData } from './KittyGraphicsTypes';

// Kitty-specific image storage controller.
//
// Wraps shared ImageStorage with kitty protocol semantics:
// - tracks transmitted image payloads by kitty image id
// - tracks kitty image id -> shared ImageStorage id mapping for displayed images
// - mirrors shared-storage evictions into kitty maps
// - applies protocol-level undisplayed-image eviction policy
export class KittyImageStorage implements IDisposable {
  private static readonly _maxStoredImages = 256;

  private _nextImageId = 1;
  private readonly _images: Map<number, IKittyImageData> = new Map();
  // TODO: Support multiple placements per image. The kitty spec identifies
  // placements by an (image id, placement id) pair — same i + different p
  // values should coexist, and same i + same p should replace the prior
  // placement. Currently we track only one storage entry per kitty image id,
  // so multiple placements of the same image overwrite each other. Fixing
  // this requires changing these maps to Map<number, Map<number, number>>
  // (kittyId → placementId → storageId) and updating addImage/deleteById
  // accordingly. The underlying shared ImageStorage would also need to
  // support multiple entries per logical image.
  private readonly _kittyIdToStorageId: Map<number, number> = new Map();
  private readonly _storageIdToKittyId: Map<number, number> = new Map();
  // Virtual placements (U=1): kitty image id -> placement id -> storage id.
  // Drawn wherever placeholder cells reference them, never written to cells.
  private readonly _virtualPlacements: Map<number, Map<number, number>> = new Map();
  private readonly _storageIdToVirtual: Map<number, { kittyId: number, placementId: number }> = new Map();

  private readonly _previousOnImageDeleted: ((storageId: number) => void) | undefined;
  private readonly _wrappedOnImageDeleted: (storageId: number) => void;
  private readonly _handleStorageImageDeleted = (storageId: number): void => {
    const virtual = this._storageIdToVirtual.get(storageId);
    if (virtual) {
      this._storageIdToVirtual.delete(storageId);
      const placements = this._virtualPlacements.get(virtual.kittyId);
      if (placements?.get(virtual.placementId) === storageId) {
        placements.delete(virtual.placementId);
        if (!placements.size) {
          this._virtualPlacements.delete(virtual.kittyId);
        }
      }
      return;
    }
    const kittyId = this._storageIdToKittyId.get(storageId);
    if (kittyId !== undefined) {
      this._kittyIdToStorageId.delete(kittyId);
      this._storageIdToKittyId.delete(storageId);
      this._images.delete(kittyId);
    }
  };
  private _addImageOpts: IAddImageOpts = { scrolling: true, layer: 'top', zIndex: 0, cursorPos: 'iip' };

  constructor(
    private readonly _storage: ImageStorage
  ) {
    this._previousOnImageDeleted = this._storage.onImageDeleted;
    this._wrappedOnImageDeleted = (storageId: number) => {
      this._previousOnImageDeleted?.(storageId);
      this._handleStorageImageDeleted(storageId);
    };
    this._storage.onImageDeleted = this._wrappedOnImageDeleted;
    this._storage.resolvePlaceholder = this._resolvePlaceholder;
  }

  public reset(): void {
    this._nextImageId = 1;
    this._images.clear();
    this._kittyIdToStorageId.clear();
    this._storageIdToKittyId.clear();
    this._virtualPlacements.clear();
    this._storageIdToVirtual.clear();
  }

  public dispose(): void {
    this.reset();
    if (this._storage.onImageDeleted === this._wrappedOnImageDeleted) {
      this._storage.onImageDeleted = this._previousOnImageDeleted;
    }
    if (this._storage.resolvePlaceholder === this._resolvePlaceholder) {
      this._storage.resolvePlaceholder = undefined;
    }
  }

  /**
   * Store transmitted image data. Replacing an image drops its placements;
   * pass `keepVirtual` when a virtual placement of the new data follows right
   * away, so the old one stays visible until it is replaced.
   */
  public storeImage(id: number | undefined, imageData: Omit<IKittyImageData, 'id'>, keepVirtual: boolean = false): number {
    const imageId = id ?? this._nextImageId++;
    if (!keepVirtual) {
      this._deleteVirtualPlacements(imageId);
    }

    const oldStorageId = this._kittyIdToStorageId.get(imageId);
    if (oldStorageId !== undefined) {
      this._storage.deleteImage(oldStorageId);
      this._kittyIdToStorageId.delete(imageId);
      this._storageIdToKittyId.delete(oldStorageId);
    }

    if (!this._images.has(imageId) && this._images.size >= KittyImageStorage._maxStoredImages) {
      this._evictUndisplayedImages();
    }

    this._images.set(imageId, {
      ...imageData,
      id: imageId
    });
    return imageId;
  }

  public addImage(kittyId: number, image: HTMLCanvasElement | ImageBitmap, scrolling: boolean, layer: ImageLayer, zIndex: number): void {
    // Clean up stale reverse-mapping from a previous placement of the same
    // kitty image.  The old shared-storage entry is kept (it may still be
    // visible on screen) but its reverse mapping is removed so that eviction
    // of the old entry won't incorrectly delete the kitty image data.
    const oldStorageId = this._kittyIdToStorageId.get(kittyId);
    if (oldStorageId !== undefined) {
      this._storageIdToKittyId.delete(oldStorageId);
    }
    this._addImageOpts.scrolling = scrolling;
    this._addImageOpts.layer = layer;
    this._addImageOpts.zIndex = zIndex;
    const storageId = this._storage.addImage(image, this._addImageOpts);
    this._kittyIdToStorageId.set(kittyId, storageId);
    this._storageIdToKittyId.set(storageId, kittyId);
  }

  /**
   * Add a virtual placement (U=1) of a kitty image. Replaces the placement
   * with the same placement id, or every virtual placement of the image when
   * `replaceAll` is set (the image was just retransmitted). The old entries are
   * removed only after the new one is stored, so animations do not flicker.
   */
  public addVirtualPlacement(kittyId: number, placementId: number, image: HTMLCanvasElement | ImageBitmap, layer: ImageLayer, zIndex: number, replaceAll: boolean): void {
    const storageId = this._storage.addVirtualImage(image, layer, zIndex);
    let placements = this._virtualPlacements.get(kittyId);
    const old: number[] = [];
    if (placements) {
      for (const [pid, id] of placements) {
        if (replaceAll || pid === placementId) {
          old.push(id);
        }
      }
    } else {
      placements = new Map();
      this._virtualPlacements.set(kittyId, placements);
    }
    for (const id of old) {
      this._storageIdToVirtual.delete(id);
      for (const [pid, sid] of placements) {
        if (sid === id) placements.delete(pid);
      }
      this._storage.deleteImage(id);
    }
    placements.set(placementId, storageId);
    this._storageIdToVirtual.set(storageId, { kittyId, placementId });
  }

  public get virtualPlacements(): ReadonlyMap<number, ReadonlyMap<number, number>> {
    return this._virtualPlacements;
  }

  // Placeholder cells without a placement id use the most recent virtual placement of the image.
  private readonly _resolvePlaceholder = (kittyId: number, placementId: number): number | undefined => {
    const placements = this._virtualPlacements.get(kittyId);
    if (!placements) {
      return undefined;
    }
    if (placementId) {
      return placements.get(placementId);
    }
    let latest: number | undefined;
    for (const storageId of placements.values()) {
      if (latest === undefined || storageId > latest) latest = storageId;
    }
    return latest;
  };

  private _deleteVirtualPlacements(kittyId: number): void {
    const placements = this._virtualPlacements.get(kittyId);
    if (!placements) {
      return;
    }
    this._virtualPlacements.delete(kittyId);
    for (const storageId of placements.values()) {
      this._storageIdToVirtual.delete(storageId);
      this._storage.deleteImage(storageId);
    }
  }

  public getImage(kittyId: number): IKittyImageData | undefined {
    return this._images.get(kittyId);
  }

  public deleteById(kittyId: number): void {
    this._images.delete(kittyId);
    this._deleteVirtualPlacements(kittyId);
    const storageId = this._kittyIdToStorageId.get(kittyId);
    if (storageId !== undefined) {
      this._storage.deleteImage(storageId);
      this._kittyIdToStorageId.delete(kittyId);
      this._storageIdToKittyId.delete(storageId);
    }
  }

  public deleteAll(): void {
    this._images.clear();
    for (const kittyId of [...this._virtualPlacements.keys()]) {
      this._deleteVirtualPlacements(kittyId);
    }
    for (const storageId of this._kittyIdToStorageId.values()) {
      this._storage.deleteImage(storageId);
    }
    this._kittyIdToStorageId.clear();
    this._storageIdToKittyId.clear();
  }

  public get images(): ReadonlyMap<number, IKittyImageData> {
    return this._images;
  }

  public get kittyIdToStorageId(): ReadonlyMap<number, number> {
    return this._kittyIdToStorageId;
  }

  public get lastImageId(): number {
    return this._nextImageId - 1;
  }

  private _evictUndisplayedImages(): void {
    for (const [kittyId] of this._images) {
      if (this._images.size <= KittyImageStorage._maxStoredImages / 2) {
        break;
      }
      if (!this._kittyIdToStorageId.has(kittyId) && !this._virtualPlacements.has(kittyId)) {
        this._images.delete(kittyId);
      }
    }
  }
}
