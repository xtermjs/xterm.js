/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { Buffer } from './Buffer';
import { EventEmitter } from './EventEmitter';

export class BufferSet extends EventEmitter {
  private _normal: Buffer;
  private _alt: Buffer;
  private _activeBuffer: Buffer;

  constructor(private _terminal: ITerminal) {
    super();
    this._normal = new Buffer(this._terminal);
    this._alt = new Buffer(this._terminal);
    this._activeBuffer = this._normal;
  }

  public get alt(): Buffer {
    return this._alt;
  }

  public get active(): Buffer {
    return this._activeBuffer;
  }

  public get normal(): Buffer {
    return this._normal;
  }

  public activateNormalBuffer(): void {
    this._activeBuffer = this._normal;
    this.emit('activate', this._normal); // todo maybe simpler this._terminal.buffer = this._terminal.buffers.normal than using EventEmitter?
  }

  public activateAltBuffer(): void {
    this._activeBuffer = this._alt;
    this.emit('activate', this._alt); // todo maybe simpler this._terminal.buffer = this._terminal.buffers.alt than using EventEmitter?
  }
}
