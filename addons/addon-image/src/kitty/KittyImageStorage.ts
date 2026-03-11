/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from '@xterm/xterm';
import { ImageStorage } from '../ImageStorage';
import { ImageLayer } from '../Types';
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

  private readonly _previousOnImageDeleted: ((storageId: number) => void) | undefined;
  private readonly _wrappedOnImageDeleted: (storageId: number) => void;
  private readonly _handleStorageImageDeleted = (storageId: number): void => {
    const kittyId = this._storageIdToKittyId.get(storageId);
    if (kittyId !== undefined) {
      this._kittyIdToStorageId.delete(kittyId);
      this._storageIdToKittyId.delete(storageId);
      this._images.delete(kittyId);
    }
  };

  constructor(
    private readonly _storage: ImageStorage
  ) {
    this._previousOnImageDeleted = this._storage.onImageDeleted;
    this._wrappedOnImageDeleted = (storageId: number) => {
      this._previousOnImageDeleted?.(storageId);
      this._handleStorageImageDeleted(storageId);
    };
    this._storage.onImageDeleted = this._wrappedOnImageDeleted;
  }

  public reset(): void {
    this._nextImageId = 1;
    this._images.clear();
    this._kittyIdToStorageId.clear();
    this._storageIdToKittyId.clear();
  }

  public dispose(): void {
    this.reset();
    if (this._storage.onImageDeleted === this._wrappedOnImageDeleted) {
      this._storage.onImageDeleted = this._previousOnImageDeleted;
    }
  }

  public storeImage(id: number | undefined, imageData: Omit<IKittyImageData, 'id'>): number {
    const imageId = id ?? this._nextImageId++;

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
    const storageId = this._storage.addImage(image, scrolling, layer, zIndex);
    this._kittyIdToStorageId.set(kittyId, storageId);
    this._storageIdToKittyId.set(storageId, kittyId);
  }

  public getImage(kittyId: number): IKittyImageData | undefined {
    return this._images.get(kittyId);
  }

  public deleteById(kittyId: number): void {
    this._images.delete(kittyId);
    const storageId = this._kittyIdToStorageId.get(kittyId);
    if (storageId !== undefined) {
      this._storage.deleteImage(storageId);
      this._kittyIdToStorageId.delete(kittyId);
      this._storageIdToKittyId.delete(storageId);
    }
  }

  public deleteAll(): void {
    this._images.clear();
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
      if (!this._kittyIdToStorageId.has(kittyId)) {
        this._images.delete(kittyId);
      }
    }
  }
}
