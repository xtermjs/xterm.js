/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { KittyGraphicsAddon as IKittyGraphicsApi, IKittyGraphicsOptions, IKittyImage } from '@xterm/addon-kitty-graphics';
import { KittyImageRenderer } from './KittyImageRenderer';
import type { ITerminalExt } from './Types';
import { KittyApcHandler } from './KittyApcHandler';

export class KittyGraphicsAddon implements ITerminalAddon, IKittyGraphicsApi {
  private _terminal: ITerminalExt | undefined;
  private _apcHandler: IDisposable | undefined;
  private _kittyApcHandler: KittyApcHandler | undefined;
  private _renderer: KittyImageRenderer | undefined;
  // Question: ImageAddon has ImageStorage, lot going on there though comapred to IKittyImage atm.
  // Maybe add more, rename to IKittyImageStorage instead of IKittyImage?
  private _images: Map<number, IKittyImage> = new Map();
  private _decodedImages: Map<number, ImageBitmap> = new Map();
  private _debug: boolean;

  constructor(options?: IKittyGraphicsOptions) {
    this._debug = options?.debug ?? false;
  }

  public get images(): ReadonlyMap<number, IKittyImage> {
    return this._images;
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal as ITerminalExt;
    this._renderer = new KittyImageRenderer(terminal);

    if (this._debug) {
      console.log('[KittyGraphicsAddon] Registering APC handler for G (0x47)');
    }

    this._kittyApcHandler = new KittyApcHandler(
      this._images,
      this._decodedImages,
      this._renderer,
      this._terminal,
      this._debug
    );

    // Register APC handler for 'G' (0x47) - Kitty graphics protocol
    // APC sequence format: ESC _ G <data> ESC \
    this._apcHandler = terminal.parser.registerApcHandler(0x47, (data: string) => {
      return this._kittyApcHandler?.handle(data) ?? true;
    });
  }

  public dispose(): void {
    this._apcHandler?.dispose();
    this._kittyApcHandler?.clearPendingTransmissions();
    this._renderer?.dispose();
    this._images.clear();

    // Close all decoded bitmaps
    for (const bitmap of this._decodedImages.values()) {
      bitmap.close();
    }
    this._decodedImages.clear();

    this._terminal = undefined;
    this._kittyApcHandler = undefined;
  }
}
