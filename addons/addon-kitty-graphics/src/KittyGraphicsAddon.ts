/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { KittyGraphicsAddon as IKittyGraphicsApi, IKittyGraphicsOptions, IKittyImage } from '@xterm/addon-kitty-graphics';

/**
 * Kitty graphics protocol action types.
 */
const enum KittyAction {
  TRANSMIT = 't',
  TRANSMIT_DISPLAY = 'T',
  QUERY = 'q',
  PLACEMENT = 'p',
  DELETE = 'd'
}

/**
 * Kitty graphics protocol format types.
 */
const enum KittyFormat {
  RGB = 24,
  RGBA = 32,
  PNG = 100
}

/**
 * Parsed Kitty graphics command.
 */
export interface IKittyCommand {
  action?: string;
  format?: number;
  id?: number;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  columns?: number;
  rows?: number;
  more?: number;
  quiet?: number;
  payload?: string;
}

/**
 * Parses Kitty graphics control data into a command object.
 * Exported for testing.
 */
export function parseKittyCommand(data: string): IKittyCommand {
  const cmd: IKittyCommand = {};
  const parts = data.split(',');

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;

    const key = part.substring(0, eqIdx);
    const value = part.substring(eqIdx + 1);

    switch (key) {
      // Question: How do we know which radix to use?
      case 'a': cmd.action = value; break;
      case 'f': cmd.format = parseInt(value); break;
      case 'i': cmd.id = parseInt(value); break;
      case 's': cmd.width = parseInt(value); break;
      case 'v': cmd.height = parseInt(value); break;
      case 'x': cmd.x = parseInt(value); break;
      case 'y': cmd.y = parseInt(value); break;
      case 'c': cmd.columns = parseInt(value); break;
      case 'r': cmd.rows = parseInt(value); break;
      case 'm': cmd.more = parseInt(value); break;
      case 'q': cmd.quiet = parseInt(value); break;
    }
  }

  return cmd;
}

export class KittyGraphicsAddon implements ITerminalAddon, IKittyGraphicsApi {
  private _terminal: Terminal | undefined;
  private _apcHandler: IDisposable | undefined;
  private _images: Map<number, IKittyImage> = new Map();
  private _pendingData: Map<number, string> = new Map();
  private _nextImageId = 1;
  private _debug: boolean;

  constructor(options?: IKittyGraphicsOptions) {
    this._debug = options?.debug ?? false;
  }

  public get images(): ReadonlyMap<number, IKittyImage> {
    return this._images;
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    // TODO: Remove console log
    console.log('[KittyGraphicsAddon] Activated');

    // Register APC handler for 'G' (0x47) - Kitty graphics protocol
    // APC sequence format: ESC _ G <data> ESC \
    this._apcHandler = terminal.parser.registerApcHandler(0x47, (data: string) => {
      return this._handleKittyGraphics(data);
    });
  }

  public dispose(): void {
    this._apcHandler?.dispose();
    this._images.clear();
    this._pendingData.clear();
    this._terminal = undefined;
  }

  private _handleKittyGraphics(data: string): boolean {
    const semiIdx = data.indexOf(';');
    const controlData = semiIdx === -1 ? data : data.substring(0, semiIdx);
    const payload = semiIdx === -1 ? '' : data.substring(semiIdx + 1);

    const cmd = parseKittyCommand(controlData);
    cmd.payload = payload;

    if (this._debug) {
      console.log('[KittyGraphicsAddon] Received command:', cmd);
    }

    const action = cmd.action || 't';

    switch (action) {
      case KittyAction.TRANSMIT:
        return this._handleTransmit(cmd);
      case KittyAction.TRANSMIT_DISPLAY:
        return this._handleTransmitDisplay(cmd);
      case KittyAction.QUERY:
        return this._handleQuery(cmd);
      case KittyAction.DELETE:
        return this._handleDelete(cmd);
      default:
        return true;
    }
  }

  private _handleTransmit(cmd: IKittyCommand): boolean {
    const id = cmd.id || this._nextImageId++;
    const payload = cmd.payload || '';

    if (cmd.more === 1) {
      const existing = this._pendingData.get(id) || '';
      this._pendingData.set(id, existing + payload);
      return true;
    }

    let fullPayload = payload;
    if (this._pendingData.has(id)) {
      fullPayload = this._pendingData.get(id)! + payload;
      this._pendingData.delete(id);
    }

    const image: IKittyImage = {
      id,
      data: fullPayload,
      width: cmd.width || 0,
      height: cmd.height || 0,
      format: (cmd.format || KittyFormat.PNG) as 24 | 32 | 100
    };

    this._images.set(id, image);

    if (this._debug) {
      console.log(`[KittyGraphicsAddon] Stored image ${id}`);
    }

    return true;
  }

  private _handleTransmitDisplay(cmd: IKittyCommand): boolean {
    this._handleTransmit(cmd);
    // TODO: Display image at cursor position (canvas layer)
    return true;
  }

  private _handleQuery(cmd: IKittyCommand): boolean {
    // TODO: Respond with APC sequence indicating graphics support
    // Protocol: terminal should reply with ESC _ G i=<id>;OK ESC \
    if (this._debug) {
      console.log('[KittyGraphicsAddon] Query received');
    }
    return true;
  }

  private _handleDelete(cmd: IKittyCommand): boolean {
    if (cmd.id !== undefined) {
      this._images.delete(cmd.id);
    } else {
      this._images.clear();
    }
    return true;
  }
}
