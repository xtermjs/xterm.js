/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IOptionsService } from 'common/services/Services';
import { ISoundService } from 'browser/services/Services';
import type = Mocha.utils.type;

export class SoundService implements ISoundService {
  public serviceBrand: undefined;

  private static _audioContext: AudioContext;

  public static get audioContext(): AudioContext | null {
    if (!SoundService._audioContext) {
      const audioContextCtor: typeof AudioContext = (<any>window).AudioContext || (<any>window).webkitAudioContext;
      if (!audioContextCtor) {
        console.warn('Web Audio API is not supported by this browser. Consider upgrading to the latest version');
        return null;
      }
      SoundService._audioContext = new audioContextCtor();
    }
    return SoundService._audioContext;
  }

  constructor(
    @IOptionsService private _optionsService: IOptionsService
  ) {
  }

  public playBellSound(): void {
    // Check if the bell sound is a data uri or a callback
    if (typeof this._optionsService.options.bellSound === 'string') {
      const ctx = SoundService.audioContext;
      if (!ctx) {
        return;
      }
      const bellAudioSource = ctx.createBufferSource();
      ctx.decodeAudioData(this._base64ToArrayBuffer(this._removeMimeType(this._optionsService.options.bellSound)), (buffer) => {
        bellAudioSource.buffer = buffer;
        bellAudioSource.connect(ctx.destination);
        bellAudioSource.start(0);
      });
    } else {
      this._optionsService.options.bellSound();
    }
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
