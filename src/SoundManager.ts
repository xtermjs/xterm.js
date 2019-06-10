/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal, ISoundManager } from './Types';

export class SoundManager implements ISoundManager {
  private static _audioContext: AudioContext;

  static get audioContext(): AudioContext | null {
    if (!SoundManager._audioContext) {
      const audioContextCtor: typeof AudioContext = (<any>window).AudioContext || (<any>window).webkitAudioContext;
      if (!audioContextCtor) {
        console.warn('Web Audio API is not supported by this browser. Consider upgrading to the latest version');
        return null;
      }
      SoundManager._audioContext = new audioContextCtor();
    }
    return SoundManager._audioContext;
  }

  constructor(
    private _terminal: ITerminal
  ) {
  }

  public playBellSound(): void {
    const ctx = SoundManager.audioContext;
    if (!ctx) {
      return;
    }
    const bellAudioSource = ctx.createBufferSource();
    ctx.decodeAudioData(this._base64ToArrayBuffer(this._removeMimeType(this._terminal.options.bellSound)), (buffer) => {
      bellAudioSource.buffer = buffer;
      bellAudioSource.connect(ctx.destination);
      bellAudioSource.start(0);
    });
  }

  private _base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }

  private _removeMimeType(dataURI: string): string {
    // Split the input to get the mime-type and the data itself
    const splitUri = dataURI.split(',');

    // Return only the data
    return splitUri[1];
  }
}
