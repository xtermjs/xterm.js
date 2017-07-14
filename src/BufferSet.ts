/**
 * @license MIT
 */

import { ITerminal } from './Interfaces';
import { Buffer } from './Buffer';
import { EventEmitter } from './EventEmitter';

/**
 * The BufferSet represents the set of two buffers used by xterm terminals (normal and alt) and
 * provides also utilities for working with them.
 */
export class BufferSet extends EventEmitter {
  private _normal: Buffer;
  private _alt: Buffer;
  private _activeBuffer: Buffer;

  /**
   * Create a new BufferSet for the given terminal.
   * @param {Terminal} terminal - The terminal the BufferSet will belong to
   */
  constructor(private _terminal: ITerminal) {
    super();
    this._normal = new Buffer(this._terminal);
    this._alt = new Buffer(this._terminal);
    this._activeBuffer = this._normal;
  }

  /**
   * Returns the alt Buffer of the BufferSet
   * @returns {Buffer}
   */
  public get alt(): Buffer {
    return this._alt;
  }

  /**
   * Returns the normal Buffer of the BufferSet
   * @returns {Buffer}
   */
  public get active(): Buffer {
    return this._activeBuffer;
  }

  /**
   * Returns the currently active Buffer of the BufferSet
   * @returns {Buffer}
   */
  public get normal(): Buffer {
    return this._normal;
  }

  /**
   * Sets the normal Buffer of the BufferSet as its currently active Buffer
   */
  public activateNormalBuffer(): void {
    this._activeBuffer = this._normal;
    this.emit('activate', this._normal);
  }

  /**
   * Sets the alt Buffer of the BufferSet as its currently active Buffer
   */
  public activateAltBuffer(): void {
    this._activeBuffer = this._alt;
    this.emit('activate', this._alt);
  }
}
