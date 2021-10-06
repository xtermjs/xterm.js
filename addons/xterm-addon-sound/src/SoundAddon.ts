/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 * 
 * Support for sound sequences in xtermjs.
 */

import { Terminal, ITerminalAddon, IDisposable } from 'xterm';

// tear down sound resources after inactivity
const TEARDOWN_MS = 5000;


/**
 * Equal MIDI tuning with a base pitch.
 */
 function equaltune(key: number, pitch: number): number {
  return Math.pow(2, (key - 69) / 12) * pitch;
}


export class SoundAddon implements ITerminalAddon {
  // 447 Hz is closest to documented frequency values for VT520
  public pitch = 447;
  public type: OscillatorType = 'sine';
  private _terminal: Terminal | undefined;
  private _oscillators: OscillatorNode[] = [];
  private _gains: GainNode[] = [];
  private _compressor: DynamicsCompressorNode | undefined;
  private _lastActive = 0;
  private _lastUsed = 0;
  private _tearDownInterval = 0;
  private _decpsHandler: IDisposable | undefined;

  public dispose(): void {
    this._stop();
    if (this._tearDownInterval) {
      clearInterval(this._tearDownInterval);
    }
    if (this._decpsHandler) {
      this._decpsHandler.dispose();
      this._decpsHandler = undefined;
    }
    this._terminal = undefined;
  }

  public activate(terminal: Terminal): void {
    this._decpsHandler = terminal.parser.registerCsiHandler(
      {intermediates: ',', final: '~'},
      params => this.decps(params)
    );
    this._terminal = terminal;
  }

  /**
   * DECPS - CSI Pvolume ; Pduration ; Pnote ; ... Pnote , ~
   * 
   * volume:  0 - off, 1 - 7 (low to high)
   * duration: 1/32 of a sec, value in 0-255
   * notes: 1 - 25 (semi tones c5 - c7), tuning: TODO
   */
  public decps(params: (number | number[])[]): boolean | Promise<boolean> {
    if (params.length < 3 || params[0] > 7 || params[1] > 255 || params[1] === 0) {
      return true;
    }
    for (let i = 0; i < params.length; ++i) {
      if (params[i] instanceof Array) {
        return true;
      }
    }
    // FIXME: move SoundService to addon
    const ctx = (this._terminal as any)._core?._soundService.constructor.audioContext as AudioContext;
    if (!ctx || ctx.state === 'closed') {
      return true;
    }

    // blocking promised return - wait for all notes to finish
    return new Promise(async res => {
      const volume = params[0] as number;
      const duration = params[1] as number;

      // try to circumvent weird user action constraint
      // TODO: PoC currently, polish and make confiurable from outside
      if (ctx.state === 'suspended') {
        await this.waitForAudioPermission(ctx);
      }

      for (let i = 2; i < params.length; ++i) {
        const note = params[i] as number || 1;  // ZDM normalization: 0 --> 1
        await this._play(
          ctx,
          // spread volume levels as 2^n gain
          (2 ** volume - 1) / 128,
          // 1/32 of a second
          1000 / 32 * duration,
          // 71: 1 == C5 is the 72th midikey
          equaltune(note + 71, this.pitch)
        );
      }
      this._lastUsed = Date.now();
      if (!this._tearDownInterval) {
        this._tearDownInterval = setInterval(() => {
          if (Date.now() - this._lastUsed > TEARDOWN_MS) {
            this._stop();
            clearInterval(this._tearDownInterval);
            this._tearDownInterval = 0;
          }
        }, TEARDOWN_MS * 2);
      }
      res(true);
    });
  }

  private waitForAudioPermission(ctx: AudioContext): Promise<void> {
    //TODO: make this customizable from outside + try resuming concurrently (prolly not working on safari)
    return new Promise<void>(res => {
      const handler = () => ctx.resume().then(() => {
        document.removeEventListener('click', handler);
        res();
      });
      document.addEventListener('click', handler);
    });
  }

  private _play(ctx: AudioContext, volume: number, duration: number, tune: number): Promise<void> {
    if (!this._oscillators.length) {
      this._start(ctx);
    }
    const currentIdx = (this._lastActive + 1) % 2;
    this._lastActive = currentIdx;

    const o = this._oscillators[currentIdx];
    const g = this._gains[currentIdx];

    o.frequency.value = tune;
    o.type = this.type;
    g.gain.setTargetAtTime(volume, ctx.currentTime, 0.005);
    return new Promise<void>(res => setTimeout(() => {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.01);
      res();
    }, duration - 10));
  }

  private _start(ctx: AudioContext): void {
    this._compressor = ctx.createDynamicsCompressor();
    this._compressor.connect(ctx.destination);
    for (let i = 0; i < 2; ++i) {
      const o = ctx.createOscillator();
      o.type = this.type;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(this._compressor);
      o.start();
      this._oscillators.push(o);
      this._gains.push(g);
    }
  }

  private _stop():void {
    for (const o of this._oscillators) {
      o.stop();
      o.disconnect();
    }
    for (const g of this._gains) {
      g.disconnect();
    }
    this._compressor?.disconnect();
    this._compressor = undefined;
    this._oscillators.length = 0;
    this._gains.length = 0;

    // FIXME: Suspend ctx too?
    const ctx = (this._terminal as any)._core?._soundService.constructor.audioContext as AudioContext;
    if (ctx) {
      ctx.suspend();
    }
  }
}
