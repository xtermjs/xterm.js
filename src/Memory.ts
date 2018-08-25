/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// TODO: ctypes.Structure: write optional packed regrouping alignment function
// TODO: string convenient functions

/**
 * Address type
 */
export type Address = number;

/**
 * memory access primitives
 * used to distinguish between typed array types
 */
export const enum AccessType {
  UINT8 = 1,
  UINT16 = 2,
  UINT32 = 4,
  INT8 = 8,
  INT16 = 16,
  INT32 = 32,
  FLOAT32 = 64
  // FLOAT64 = 128 // not supported by default
}

/**
 * bitwidth of the access types
 * used to adjust the address size and alignments
 */
export const enum AccessBits {
  BIT8 = AccessType.UINT8 | AccessType.INT8,
  BIT16 = AccessType.UINT16 | AccessType.INT16,
  BIT32 = AccessType.UINT32 | AccessType.INT32 | AccessType.FLOAT32
}

// 2, 4, 8 byte alignments
export function align2(num: number): number {
  return (num + 1) & ~1;
}
export function align4(num: number): number {
  return (num + 3) & ~3;
}
export function align8(num: number): number {
  return (num + 7) & ~7;
}

/**
 * Interface to access different typed array based memory types.
 * This is used by memory implementations.
 */
export interface IMemory {
  [index: number]: Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array;
  data: Uint32Array;
  registeredAccessTypes: AccessType;
  alloc(bytes: number): Address;
  free(idx: Address): void;
  registerAccess(acc: AccessType): void;
  updateAccess(): void;
  clear(): void;
  readonly RESERVED_BYTES: number;
}

// max usable bytes - due to 4 byte alignment the last 4 bytes to 2^32 are treated as not accessible
// Note: most JS engines will not allow you to allocate that much memory for a typed array
const MAX_BYTES = 0xFFFFFFFC;

/**
 * Base class for memory implementations.
 */
abstract class Memory implements IMemory {
  /** memory accessors */
  [index: number]: Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array;
  public [AccessType.UINT8]: Uint8Array;
  public [AccessType.UINT16]: Uint16Array;
  public [AccessType.UINT32]: Uint32Array;
  public [AccessType.INT8]: Int8Array;
  public [AccessType.INT16]: Int16Array;
  public [AccessType.INT32]: Int32Array;
  public [AccessType.FLOAT32]: Float32Array;
  public registeredAccessTypes = 0;
  /** data storage */
  public data: Uint32Array;
  /** reversed bytes at the beginning */
  readonly RESERVED_BYTES = 16;
  /** allocate `bytes`, returns 8bit address */
  abstract alloc(bytes: number): Address;
  /** free address `idx` */
  abstract free(idx: Address): void;
  /** frees the whole memory */
  abstract clear(): void;
  protected _callbacks: void[] = [];
  constructor(public initialBytes: number, public maxBytes?: number) {
    this.initialBytes >>>= 0;
    if (!this.maxBytes) this.maxBytes = MAX_BYTES;
    this.maxBytes >>>= 0;
    if (this.initialBytes % 4) throw new Error('initialBytes must be a multiple of 4');
    if (this.maxBytes % 4) throw new Error('maxBytes must be a multiple of 4');
    if (this.initialBytes > this.maxBytes) throw new Error('initialBytes is greater than maxBytes');
    this[AccessType.UINT8] = null;
    this[AccessType.UINT16] = null;
    this[AccessType.UINT32] = null;
    this[AccessType.INT8] = null;
    this[AccessType.INT16] = null;
    this[AccessType.INT32] = null;
    this[AccessType.FLOAT32] = null;
  }
  /** install typed array type if needed */
  registerAccess(acc: AccessType): void {
    if (acc & AccessType.UINT8 && !this[AccessType.UINT8]) this[AccessType.UINT8] = new Uint8Array(this.data.buffer);
    if (acc & AccessType.UINT16 && !this[AccessType.UINT16]) this[AccessType.UINT16] = new Uint16Array(this.data.buffer);
    if (acc & AccessType.UINT32 && !this[AccessType.UINT32]) this[AccessType.UINT32] = this.data;
    if (acc & AccessType.INT8 && !this[AccessType.INT8]) this[AccessType.INT8] = new Int8Array(this.data.buffer);
    if (acc & AccessType.INT16 && !this[AccessType.INT16]) this[AccessType.INT16] = new Int16Array(this.data.buffer);
    if (acc & AccessType.INT32 && !this[AccessType.INT32]) this[AccessType.INT32] = new Int32Array(this.data.buffer);
    if (acc & AccessType.FLOAT32 && !this[AccessType.FLOAT32]) this[AccessType.FLOAT32] = new Float32Array(this.data.buffer);
    this.registeredAccessTypes |= acc;
  }
  /** updates typed arrays, should be called after resize */
  updateAccess(): void {
    const acc = this.registeredAccessTypes;
    if (acc & AccessType.UINT8) this[AccessType.UINT8] = new Uint8Array(this.data.buffer);
    if (acc & AccessType.UINT16) this[AccessType.UINT16] = new Uint16Array(this.data.buffer);
    if (acc & AccessType.UINT32) this[AccessType.UINT32] = this.data;
    if (acc & AccessType.INT8) this[AccessType.INT8] = new Int8Array(this.data.buffer);
    if (acc & AccessType.INT16) this[AccessType.INT16] = new Int16Array(this.data.buffer);
    if (acc & AccessType.INT32) this[AccessType.INT32] = new Int32Array(this.data.buffer);
    if (acc & AccessType.FLOAT32) this[AccessType.FLOAT32] = new Float32Array(this.data.buffer);
  }
}

/**
 * StackMemory
 * This memory uses a linear allocator similar to stack memory in C.
 * It maintains a stack pointer `sp` to indicate next free portion in the memory.
 * Any allocation will advance `sp` in a linear fashion, a call to `free` will
 * treat any later allocation as freed. Note that there are no bound checks,
 * therefore call `free` only with returned pointer from a previous `alloc` or `sp`.
 * A typical use pattern is to save the stack pointer at the beginning,
 * do some work with additional allocations and call `free` with the saved stack pointer
 * to free all used memory at once. The stack memory will grow to `maxBytes` if needed.
 *
 * properties:
 *   - alloc O(1) (w'o growing)
 *   - free O(1)
 *   - double free safe
 *   - null pointer free safe
 *   - aligment 4 byte, start at 16
 */
export class StackMemory extends Memory {
  public sp: number;
  constructor(initialBytes: number, maxBytes?: number) {
    super(initialBytes, maxBytes);
    this.data = new Uint32Array((this.initialBytes + this.RESERVED_BYTES) >>> 2);
    this.clear();
  }
  alloc(bytes: number): Address {
    if (!bytes) return 0;
    const address = this.sp;
    this.sp += align4(bytes) >>> 2;
    if (this.data.length <= this.sp) {
      let newSize = this.data.length << 1;
      while (newSize < this.sp) newSize <<= 1;
      if (newSize > (this.maxBytes >>> 2)) newSize = this.maxBytes >>> 2;
      if ((newSize - address) << 2 < bytes) throw new Error('out of memory');
      const data = new Uint32Array(newSize);
      data.set(this.data);
      this.data = data;
      this.updateAccess();
    }
    return address << 2;
  }
  free(address: Address): void {
    if (address && address >>> 2 < this.sp) this.sp = address >>> 2;
  }
  clear(): void {
    this.sp = this.RESERVED_BYTES >>> 2;
  }
}

/**
 * PoolMemory
 * Allocates memory of a fixed `blockSize` in bytes (aligned to 4 bytes).
 * The allocator uses internally a linked list for free blocks.
 * The underlying memory will grow to `blockSize` if needed.
 *
 * properties:
 *   - alloc O(1) (w'o growing)
 *   - free O(1)
 *   - not double free safe
 *   - null pointer free safe
 *   - alignment 4 byte, start at 16
 */
export class PoolMemory extends Memory {
  public head: Address;
  public blockSize: number;
  public numBlocks: number;
  public maxBlocks: number;
  public entrySize: number;
  constructor(blockSize: number, initialBlocks: number, maxBlocks?: number) {
    blockSize = align4(blockSize);
    super(initialBlocks * blockSize, maxBlocks * blockSize || MAX_BYTES - (MAX_BYTES % blockSize));
    this.blockSize = blockSize;
    this.entrySize = blockSize >> 2;
    this.numBlocks = initialBlocks;
    this.maxBlocks = this.maxBytes / blockSize;
    this.data = new Uint32Array((this.initialBytes + this.RESERVED_BYTES) >>> 2);
    this.clear();
  }
  alloc(bytes: number): Address {
    if (!bytes) return 0;
    if (align4(bytes) > this.blockSize) throw new Error('blockSize exceeded');
    if (!this.head) {
      let newBlocks = this.numBlocks * 2;
      if (newBlocks > this.maxBlocks) newBlocks = this.maxBlocks;
      if (newBlocks === this.numBlocks) throw new Error('out of memory');
      const data = new Uint32Array(this.entrySize * newBlocks + (this.RESERVED_BYTES >>> 2));
      data.set(this.data);
      for (let i = this.data.length; i < data.length; i += this.entrySize) data[i] = i + this.entrySize;
      data[data.length - this.entrySize] = 0;
      this.head = this.data.length;
      this.numBlocks = newBlocks;
      this.data = data;
      this.updateAccess();
    }
    const address = this.head;
    this.head = this.data[address];
    return address << 2;
  }
  free(address: Address): void {
    if (address) {
      this.data[address >>> 2] = this.head;
      this.head = address >>> 2;
    }
  }
  clear(): void {
    this.head = this.RESERVED_BYTES >>> 2;
    for (let i = this.head; i < this.data.length; i += this.entrySize) this.data[i] = i + this.entrySize;
    this.data[this.data.length - this.entrySize] = 0;
  }
}

// seglist constants
export const enum SL {
  PREV_SIZE = 0,    // offset to real previous block size
  SIZE = 1,         // offset to own block size
  PREV_LINKED = 2,  // offset to pointer to previous in seglist
  NEXT_LINKED = 3,  // offset to pointer to next in seglist
  DATA = 2,         // offset of data part
  HEADER_SIZE = 2   // block header size
}

/**
 * SeglistMemory
 * Unlike `StackMemory` and `PoolMemory` this memory is a general purpose heap
 * similar to malloc/free in C, thus different sizes can be allocated and freed
 * independently. The allocator implements the seglist paradigm with LIFO first fit.
 * The allocator maintains 8 seglists for these sizes:
 *     list:     0     1      2      3      4         5        6       7
 *     bytes:  1-8, 9-16, 17-32, 33-64, 65-128, 129-256, 257-512,   >512
 * For allocations up to 512 bytes the runtime is O(1), for bigger allocations
 * it is O(k) for k free slots in the biggest seglist.
 * On allocation a found free block will be split if the remaining space can hold
 * another block (min block size is 16 bytes). Freed blocks will be merged with
 * free neighbour blocks (left and right coalesce).
 * To guarantee 8 byte alignment of the data location, the right coalesce size hint
 * is not at the end of a block, instead it was moved to the next block header.
 * Therefore it is needed to track the highest defined block separately with
 * the `.last` property.
 * block header layout:
 *    free block   [ blocksize of left block, own blocksize, previous block, next block, ..... ]
 *    taken block  [ blocksize of left block, own blocksize, data, ..... ]
 * A block is marked as taken with the 1st bit in blocksize.
 * Note: There are no boundary checks, writing outside of the allocated location is likely
 * to corrupt the heap data. Same goes for double free.
 *
 * properties:
 *   - alloc O(1) for allocations <= 512 bytes
 *   - alloc O(k) for allocations > 512 bytes
 *   - free O(1)
 *   - not double free safe
 *   - null pointer free safe
 *   - alignment 8 byte, block start at 16 (24 is the first data location)
 */
export class SeglistMemory extends Memory {
  public heads: Address[];
  public last: Address;
  public readonly SEGLIST_SIZE = 8;
  public readonly HEAD_IDX = [
    0, 7, 1, 7, 7, 7, 2, 7, 7, 7, 7, 7, 7, 7, 3, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6, 7, 5, 4, 31
  ];
  private _toHeadIndex(v: number): number {
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    return this.HEAD_IDX[(32 + ((v * 0x07C4ACDD) >> 27)) & 31];
  }
  constructor(initialBytes: number, maxBytes?: number) {
    super(initialBytes, maxBytes || MAX_BYTES - 4);
    if (this.initialBytes % 8) throw new Error('initialBytes must be a multiple of 8');
    if (this.maxBytes % 8) throw new Error('maxBytes must be a multiple of 8');
    this.data = new Uint32Array((this.initialBytes + this.RESERVED_BYTES) >>> 2);
    this.heads = [];
    this.clear();
  }
  getFromHead(v: number): number {
    return this._toHeadIndex(v - 1);
  }
  setToHead(v: number): number {
    return (v >= 256) ? 7 : this._toHeadIndex(v) - 1;
  }
  isTaken(block: Address): number {
    if (!block) return 1;
    return this.data[block + SL.SIZE] & 1;
  }
  realNext(block: Address): Address {
    const next = block + (this.data[block + SL.SIZE] & ~1) + SL.HEADER_SIZE;
    return (next < this.data.length) ? next : 0;
  }
  realPrev(block: Address): Address {
    const prev = block - (this.data[block + SL.PREV_SIZE] & ~1) - SL.HEADER_SIZE;
    return (prev > 3) ? prev : 0;
  }
  removeFromList(block: Address, hIdx: number): void {
    const prev = this.data[block + SL.PREV_LINKED];
    const next = this.data[block + SL.NEXT_LINKED];
    if (next) this.data[next + SL.PREV_LINKED] = prev;
    if (prev) this.data[prev + SL.NEXT_LINKED] = next;
    if (this.heads[hIdx] === block) this.heads[hIdx] = next;
  }
  insertToList(block: Address, hIdx: number): void {
    const next = this.heads[hIdx];
    this.data[block + SL.PREV_LINKED] = 0;
    this.data[block + SL.NEXT_LINKED] = next;
    if (next) this.data[next + SL.PREV_LINKED] = block;
    this.heads[hIdx] = block;
  }
  splitBlock(block: Address, size: number): void {
    const newBlockSize = this.data[block + SL.SIZE] - size - SL.HEADER_SIZE;
    const next = this.realNext(block);
    if (next) this.data[next + SL.PREV_SIZE] = newBlockSize;
    const newBlock = block + size + SL.HEADER_SIZE;
    this.data[newBlock + SL.PREV_SIZE] = size;
    this.data[newBlock + SL.SIZE] = newBlockSize;
    this.insertToList(newBlock, this.setToHead(this.data[newBlock + SL.SIZE]));
    this.data[block + SL.SIZE] = size;
    if (block === this.last) this.last = newBlock;
  }
  leftCoalesce(prev: Address, size: number): void {
    const oldhIdx = this.setToHead(this.data[prev + SL.SIZE]);
    this.data[prev + SL.SIZE] += size;
    const newhIdx = this.setToHead(this.data[prev + SL.SIZE]);
    if (oldhIdx !== newhIdx) {
      this.removeFromList(prev, oldhIdx);
      this.insertToList(prev, newhIdx);
    }
  }
  alloc(bytes: number): Address {
    if (!bytes) return 0;
    const size = align8(bytes) >>> 2;
    let block = 0;
    let hIdx = this.getFromHead(size);
    while (!(block = this.heads[hIdx]) && hIdx < 7) hIdx++;
    if (hIdx === 7) {
      block = this.heads[7];
      while (block && this.data[block + SL.SIZE] < size) block = this.data[block + SL.NEXT_LINKED];
    }
    if (!block) {
      // no suitable block found, resize
      const oldSize = this.data.length;
      let newSize = this.data.length << 1;
      let requestedSize = this.data.length + size + 2;
      if (!this.isTaken(this.last)) requestedSize -= this.data[this.last + SL.SIZE];
      while (newSize < requestedSize) newSize <<= 1;
      if (newSize > (this.maxBytes >>> 2)) newSize = this.maxBytes >>> 2;
      if (newSize < requestedSize) throw new Error('out of memory');
      const data = new Uint32Array(newSize);
      data.set(this.data);
      this.data = data;
      if (this.isTaken(this.last)) {
        // last block is taken, create fresh block at the end and insert as head in seglist
        block = oldSize;
        const blockSize = newSize - oldSize - SL.HEADER_SIZE;
        this.data[block + SL.PREV_SIZE] = this.data[this.last + SL.SIZE];
        this.data[block + SL.SIZE] = blockSize;
        this.last = block;
        hIdx = this.setToHead(blockSize);
        this.insertToList(block, hIdx);
      } else {
        // last block is free, merge added space with last
        block = this.last;
        this.leftCoalesce(block, newSize - oldSize);
        hIdx = this.setToHead(this.data[block + SL.SIZE]);
      }
      this.updateAccess();
    }
    this.removeFromList(block, hIdx);
    if (this.data[block + SL.SIZE] - size > 3) this.splitBlock(block, size);
    const next = this.realNext(block);
    if (next) this.data[next + SL.PREV_SIZE] |= 1;
    this.data[block + SL.SIZE] |= 1;
    return (block + SL.DATA) << 2;
  }
  free(address: Address): void {
    if (!address) return;
    const block = (address >>> 2) - SL.DATA;
    this.data[block + SL.SIZE] &= ~1;
    const realNext = this.realNext(block);
    const realPrev = this.realPrev(block);
    if (realNext) {
      this.data[realNext + SL.PREV_SIZE] &= ~1;
      if (!this.isTaken(realNext)) {
        this.removeFromList(realNext, this.setToHead(this.data[realNext + SL.SIZE]));
        this.data[block + SL.SIZE] += this.data[realNext + SL.SIZE] + SL.HEADER_SIZE;
        if (this.last === realNext) this.last = block;
        else this.data[this.realNext(realNext) + SL.PREV_SIZE] = this.data[block + SL.SIZE];
      }
    }
    if (realPrev && !this.isTaken(realPrev)) {
      this.leftCoalesce(realPrev, this.data[block + SL.SIZE] + SL.HEADER_SIZE);
      if (this.last === block) this.last = realPrev;
      else this.data[this.realNext(realPrev) + SL.PREV_SIZE] = this.data[realPrev + SL.SIZE];
    } else {
      this.insertToList(block, this.setToHead(this.data[block + SL.SIZE]));
    }
  }
  clear(): void {
    this.heads = [];
    for (let i = 0; i < this.SEGLIST_SIZE; ++i) this.heads.push(0);
    const start = this.RESERVED_BYTES >>> 2;
    this.data[start + SL.PREV_SIZE] = 1;
    this.data[start + SL.SIZE] = this.data.length - start - SL.HEADER_SIZE;
    this.data[start + SL.NEXT_LINKED] = 0;
    this.data[start + SL.PREV_LINKED] = 0;
    this.last = start;
    this.heads[this.setToHead(this.data[start + SL.SIZE])] = start;
  }
}

/**
 * Basic C like types.
 *
 * Implemented types:
 *   - numerical types up to 32 bit (see `NumberType`)
 *   - character types (`Char` and `WChar`)
 *   - pointer types (`VoidPointer` and `TypedPointer`)
 *   - array types creation with any of the others (`CArray`)
 *   - struct creation with any of the others (`Structure`)
 * Missing:
 *   - double support (see notes below)
 *   - convenient types for strings
 *
 * All ctypes have the same constructor signature:
 *     new ctype(memory: Memory, value?: any, address?: Address)
 *
 * The ctor creates a JS object with some bookkeeping for
 * the underlying memory access. The ctor will alloc the needed
 * space from `memory` automatically if `address` is omitted.
 * `value` can be any suitable object that closely reassembles the
 * created ctype:
 *    - numbers for `NumberType` (including pointers)
 *    - string for `CharType`
 *    - iterable for `CArray`, base type must match though
 *    - object with similar properties for `Structure`
 * If `value` is omitted the memory is not touched (no default).
 *
 * About lifecycle:
 * Any ctype object created without `address` needs to be freed afterwards
 * by calling `memory.free(ctypeObject.address)`.
 * There are no plans to implement a generic ref counting or GC on top of this
 * (use native JS objects if you rely on such). For short living values
 * consider using `StackMemory` and free the memory at once when done.
 * About Performance:
 * Generally creating and freeing ctype objects has worse performance
 * than native JS due to the translation overhead. It will run faster
 * if you rearrange your code to use the ctypes as references
 * ("move" them around by adjusting the address with `setAddress`) to load
 * and store data to and from JS and do the work directly on the memory.
 * With reusing the ctype objects the GC will drop almost to 0%.
 * Note on double support:
 * To save memory `StackMemory` and `PoolMemory` are aligned to 4 byte,
 * therefore doubles will not work out of the box (needs 8 byte alignment).
 * With `StackMemory` you can pad with a dummy allocation to get a multiple of 8.
 * With `PoolMemory` the `blockSize` must be a multiple of 8 to get double support.
 * `SeglistMemory` automatically aligns memory locations to 8 byte.
 */

export namespace ctypes {

  /**
   * Interfaces.
   */
  export interface ICTypeConstructor<T> {
    new(memory: IMemory, value?: any, address?: Address): T;
    typename: string;
    bytes: number;
    accessType: AccessType;
    fromAddress(accessor: Memory, address: Address): T;
  }
  export interface IPointerConstructor<T extends CType> extends ICTypeConstructor<T> {
    new(memory: IMemory, value: any, address?: Address): IPointer<T>;
    type: T;
  }
  export interface IVoidPointerConstructor extends IPointerConstructor<any> {
  }
  export interface ICArrayConstructor<T extends CType> extends ICTypeConstructor<T> {
    new(memory: IMemory, value: any, address?: Address): CArrayBase;
    type: T;
    size: number;
  }
  export interface IStructureConstructor<T extends CType> extends ICTypeConstructor<T> {
    fields: [string, ICTypeConstructor<any>][];
    alignments: { [index: string]: number[] } | null;
  }

  // interface for all ctypes
  export interface ICType {
    accessType: AccessType;
    memory: IMemory;
    setAddress(address: Address): void;
    value: any;
    getValue(): any;
    setValue(value: any): void;
    getBytes(): Uint8Array;
    setBytes(value: Uint8Array): void;
    address: Address;
    // _accessAddress: Address;
  }

  // pointer interface
  export interface IPointer<T extends CType> extends ICType {
    deref(): T | never;
    cast<U extends CType>(type: ICTypeConstructor<U>): IPointer<U>;
    inc(): void | never;
    dec(): void | never;
    add(value: number): void | never;
  }

  // array interface
  export interface ICArray extends ICType {
    length: number;
    getValue(): any[];
    setValue(value: any): void;
    get(index: number): any;
    set(index: number, value: any): void;
    reverse(): void;
  }

  // structure interface
  interface IStructure extends ICType {
    fields: { [index: string]: ICType };
  }


  /**
   * CType base class.
   */
  export abstract class CType implements ICType {
    static typename = 'CType';
    static bytes = 0;
    static accessType = 0;
    static fromAddress<T extends CType>(accessor: Memory, address: Address): T {
      return new (this as ICTypeConstructor<T>)(accessor, null, address);
    }
    accessType: AccessType;
    address: Address;
    protected _accessAddress: Address;
    protected _bytearray: Uint8Array;
    constructor(public memory: IMemory, value?: any | null, address?: Address) {
      this.accessType = (this.constructor as typeof CType).accessType;
      this.setAddress(address || memory.alloc((this.constructor as typeof CType).bytes));
      memory.registerAccess(this.accessType);
      this.setValue(value);
    }
    setAddress(address: Address): void {
      this.address = address;
      this._accessAddress = (this.accessType & AccessBits.BIT32)
        ? this.address >> 2
        : (this.accessType & AccessBits.BIT16) ? this.address >> 1 : this.address;
    }
    getBytes(): Uint32Array {
      if (this._bytearray) return this._bytearray;
      this.memory.registerAccess(AccessType.UINT8);
      this._bytearray = this.memory[AccessType.UINT8].subarray(
        this.address,
        this.address + (this.constructor as typeof CType).bytes);
      return this._bytearray;
    }
    setBytes(value: Uint8Array): void {
      this.memory.registerAccess(AccessType.UINT8);
      this.memory[AccessType.UINT8].set(value, this.address);
    }
    abstract value: any;
    abstract getValue(): any;
    abstract setValue(value: any): void;
  }

  /**
   * Numerical types.
   */
  export abstract class NumberType extends CType implements ICType {
    getValue(): number {
      return this.memory[this.accessType][this._accessAddress];
    }
    setValue(value: number | NumberType): void {
      if (value === null || value === undefined) return;
      if (value instanceof NumberType) {
        this.memory[this.accessType][this._accessAddress] = value.memory[value.accessType][value._accessAddress];
      } else {
        this.memory[this.accessType][this._accessAddress] = value;
      }
    }
    get value(): number { return this.memory[this.accessType][this._accessAddress]; }
    set value(value: number) { this.memory[this.accessType][this._accessAddress] = value; }
    inc(): void { this.memory[this.accessType][this._accessAddress]++; }
    dec(): void { this.memory[this.accessType][this._accessAddress]--; }
    iadd(value: NumberType): void { this.memory[this.accessType][this._accessAddress] += value.memory[value.accessType][value._accessAddress]; }
    isub(value: NumberType): void { this.memory[this.accessType][this._accessAddress] -= value.memory[value.accessType][value._accessAddress]; }
    imul(value: NumberType): void { this.memory[this.accessType][this._accessAddress] *= value.memory[value.accessType][value._accessAddress]; }
    idiv(value: NumberType): void { this.memory[this.accessType][this._accessAddress] /= value.memory[value.accessType][value._accessAddress]; }
    imod(value: NumberType): void { this.memory[this.accessType][this._accessAddress] %= value.memory[value.accessType][value._accessAddress]; }
  }
  export class Uint8 extends NumberType {
    static typename = 'Uint8';
    static bytes = 1;
    static accessType = AccessType.UINT8;
  }
  export class Uint16 extends NumberType {
    static typename = 'Uint16';
    static bytes = 2;
    static accessType = AccessType.UINT16;
  }
  export class Uint32 extends NumberType {
    static typename = 'Uint32';
    static bytes = 4;
    static accessType = AccessType.UINT32;
  }
  export class Int8 extends NumberType {
    static typename = 'Int8';
    static bytes = 1;
    static accessType = AccessType.INT8;
  }
  export class Int16 extends NumberType {
    static typename = 'Int16';
    static bytes = 2;
    static accessType = AccessType.INT16;
  }
  export class Int32 extends NumberType {
    static typename = 'Int32';
    static bytes = 4;
    static accessType = AccessType.INT32;
  }
  export class Float extends NumberType {
    static typename = 'Float';
    static bytes = 4;
    static accessType = AccessType.FLOAT32;
  }

  /**
   * Character types.
   */
  export class CharType extends CType implements ICType {
    getValue(): string {
      return String.fromCharCode(this.memory[this.accessType][this._accessAddress]);
    }
    setValue(value: string | CharType): void {
      if (value === null || value === undefined) return;
      if (value instanceof CharType) {
        this.memory[this.accessType][this._accessAddress] = value.memory[value.accessType][value._accessAddress];
      } else {
        this.memory[this.accessType][this._accessAddress] = (value.length) ? value.charCodeAt(0) : 0;
      }
    }
    get value(): string {
      return String.fromCharCode(this.memory[this.accessType][this._accessAddress]);
    }
    set value(value: string) {
      this.memory[this.accessType][this._accessAddress] = (value.length) ? value.charCodeAt(0) : 0;
    }
  }
  export class Char extends CharType {
    static typename = 'Char';
    static bytes = 1;
    static accessType = AccessType.UINT8;
  }
  export class WChar extends CharType {
    static typename = 'WChar';
    static bytes = 2;
    static accessType = AccessType.UINT16;
  }

  /**
   * Pointer types.
   * A call `Pointer<ctype>(ctype)` creates the `ctype*` pointer constructor.
   * Casting is done by `.cast<new_ctype>(new_ctype)`.
   * Pointers follow the `IPointer<ctype>` interface to get proper type checks.
   * Double pointers can be created by several `Pointer` invocations.
   * Example:
   *   let P_Char = Pointer<Char>(Char);              // ctor for pointer type char*
   *   let PP_Char = Pointer<IPointer<Char>>(P_Char); // ctor for pointer type char**
   *   let c = new Char(stack, '!');
   *   let p = new PChar(stack, c.address);           // creates pointer to c
   *   let pp = new PP_Char(stack, p.address);        // double pointer to c
   * which is roughly equivalent to:
   *   char c = '!';
   *   char *p = &c;
   *   char **pp = &p;
   */
  export class VoidPointer extends NumberType implements IPointer<null> {
    static typename = 'void*';
    static bytes = 4;
    static accessType = AccessType.UINT32;
    static type: null = null;
    deref(): never {
      throw new Error('trying to deref void pointer');
    }
    cast<T extends CType>(type: ICTypeConstructor<T>): IPointer<T> {
      if (type === null) return new VoidPointer(this.memory, this.value, this.address);
      return new (pointer<T>(type))(this.memory, this.value, this.address);
    }
    inc(): never {
      throw new Error('arithmetic on void pointer');
    }
    dec(): never {
      throw new Error('arithmetic on void pointer');
    }
    add(value: number): never {
      throw new Error('arithmetic on void pointer');
    }
  }

  // save pointer type ctors
  const registeredPointerTypes: { [type: string]: IPointerConstructor<any> } = {};

  // Pointer type factory function.
  export function pointer<T extends CType>(type: ICTypeConstructor<T> | null): IVoidPointerConstructor | IPointerConstructor<T> {
    if (!type === null) return VoidPointer;
    if (registeredPointerTypes[type.typename]) return registeredPointerTypes[type.typename];

    class TypedPointer extends NumberType implements IPointer<T> {
      static typename = type.typename + '*';
      static type = type;
      static bytes = 4;
      static accessType = AccessType.UINT32;
      deref(): T {
        if (!this.value) throw new Error('trying to deref NULL pointer');
        return new type(this.memory, null, this.value);
      }
      cast<U extends CType>(type: ICTypeConstructor<U> | null): IPointer<U> {
        if (type === null) return new VoidPointer(this.memory, this.value, this.address);
        return new (pointer<U>(type))(this.memory, this.value, this.address);
      }
      inc(): void {
        this.value += type.bytes;
      }
      dec(): void {
        this.value -= type.bytes;
      }
      add(value: number): void {
        this.value += value * type.bytes;
      }
    }

    if (!registeredPointerTypes[type.typename]) registeredPointerTypes[type.typename] = TypedPointer;
    return registeredPointerTypes[type.typename];
  }

  /**
   * Array types.
   * A call `Array<ctype>(ctype, 10)` creates the `ctype[10]` array constructor.
   * Example usage:
   *   let Uint8_10 = Array<Uint8>(Uint8, 10);
   *   let array = new Uint8_10(stack, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
   */
  // we need this array base class to get something in the prototype chain
  // to test against with `instanceof` to find CArray types
  abstract class CArrayBase extends CType implements ICArray {
    abstract length: number = 0;
    abstract getValue(): any[];
    abstract setValue(value: any): void;
    abstract get(index: number): any;
    abstract set(index: number, value: any): void;
    abstract reverse(): void;
  }

  // save array type ctors
  const registeredArrayTypes: { [type: string]: ICArrayConstructor<any> } = {};

  // Array type factory function.
  export function array<T extends CType>(type: ICTypeConstructor<T>, length: number): ICArrayConstructor<T> {
    const typename = `${type.typename}[${length}]`;
    if (registeredArrayTypes[typename]) return registeredArrayTypes[typename];

    class CArray extends CArrayBase {
      static typename = typename;
      static type = type;
      static bytes = type.bytes * length;
      static accessType = type.accessType;
      static size = length;
      length: number;
      constructor(memory: Memory, value?: any, address?: Address) {
        super(memory, null, address);
        this.length = length;
        this.setValue(value);
      }
      get value(): any[] | CArrayBase | any {
        return this.getValue();
      }
      set value(value: any[] | CArrayBase | any) {
        this.setValue(value);
      }
      getValue(): any[] {
        const res = [];
        const obj = new type(this.memory, null, this.address);
        let p = this.address;
        for (let i = 0; i < this.length; ++i, p += type.bytes) {
          obj.setAddress(p);
          res.push(obj.getValue());
        }
        return res;
      }
      setValue(value: any): void {
        if (value === null || value === undefined) return;
        const corrThis = (this.accessType & AccessBits.BIT32) ? 2 : (this.accessType & AccessBits.BIT16) ? 1 : 0;
        const end = (this.length < value.length) ? this.length : value.length;
        if (value instanceof CArrayBase) {
          const corrValue = (value.accessType & AccessBits.BIT32) ? 2 : (value.accessType & AccessBits.BIT16) ? 1 : 0;
          const valueCtor = (value.constructor as typeof CArray).type.prototype;
          // direct copy for character types and number types
          if ((type.prototype instanceof NumberType && valueCtor instanceof NumberType)
            || (type.prototype instanceof CharType && valueCtor instanceof CharType)) {
            let pThis = this.address;
            let pValue = value.address;
            for (let i = 0; i < end; ++i, pThis += type.bytes, pValue += (value.constructor as typeof CArray).type.bytes) {
              this.memory[this.accessType][pThis >> corrThis] = value.memory[value.accessType][pValue >> corrValue];
            }
            return;
          }
          // copy struct arrays of same type
          if (type.prototype instanceof Structure && type === (value.constructor as typeof CArray).type) {
            const access = (this.accessType & AccessBits.BIT32)
              ? AccessType.UINT32
              : (this.accessType & AccessBits.BIT16) ? AccessType.UINT16 : AccessType.UINT8;
            const pThis = this.address >> corrThis;
            const pValue = value.address >> corrThis;
            const slots = (type.bytes * end) >> corrThis;
            for (let i = 0; i < slots; ++i) this.memory[access][pThis + i] = value.memory[access][pValue + i];
            return;
          }
        }
        // get values by index access
        if (value instanceof array || value.length !== undefined) {
          const obj = new type(this.memory, null, this.address);
          let p = this.address;
          for (let i = 0; i < end; ++i, p += type.bytes) {
            obj.setAddress(p);
            obj.setValue(value[i]);
          }
          return;
        }
        // FIXME: How to deal with different CArray types?
        // fallthrough to for .. of
        const pend = this.address + type.bytes * this.length;
        const obj = new type(this.memory, null, this.address);
        let p = this.address;
        for (const v of value) {
          obj.setAddress(p);
          obj.setValue(v);
          p += type.bytes;
          if (p >= pend) break;
        }
      }
      get(index: number): any {
        return new type(this.memory, null, this.address + type.bytes * (index % this.length)).getValue();
      }
      set(index: number, value: any): void {
        new type(this.memory, null, this.address + type.bytes * (index % this.length)).setValue(value);
      }
      reverse(): void {
        const corr = (this.accessType & AccessBits.BIT32) ? 2 : (this.accessType & AccessBits.BIT16) ? 1 : 0;
        const slotLength = type.bytes >> corr;
        for (let i = 0; i < this.length >> 1; ++i) {
          let start = (this.address + type.bytes * i) >> corr;
          let end = (this.address + type.bytes * (this.length - 1 - i)) >> corr;
          for (let j = 0; j < slotLength; ++j, ++start, ++end) {
            const temp = this.memory[this.accessType][start];
            this.memory[this.accessType][start] = this.memory[this.accessType][end];
            this.memory[this.accessType][end] = temp;
          }
        }
      }
    }

    if (!registeredArrayTypes[typename]) registeredArrayTypes[typename] = CArray;
    return registeredArrayTypes[typename];
  }

  /**
   * Structure base class.
   * Base class to create C like struct types. Simply subclass it and define
   * the struct members in the `fields` property. The `typename` is needed for
   * pointers or arrays of the struct and must be unique across all ctypes.
   * After instantiation the struct members are exposed under `fields`.
   *
   * Example usage:
   *   class Foo extends Structure {
   *     static typename = 'Foo';
   *     static fields: [string, ICTypeConstructor<any>][] = [
   *       ['a', Uint8],
   *       ['b', Float]
   *     ];
   *   }
   *   let foo = new Foo(stack, {a: 123, b: 1.23456});
   *   foo.fields.a.value == 123;                       // true
   *   foo.fields.a.value = 42;                         // assignment
   *
   * Note: The struct size is aligned to the highest member access type to avoid
   * offset errors in arrays. Members are aligned according to their access type
   * thus creating lots of padding bytes if the next bytes cannot be addressed by
   * the following member's access type. To get a better pack rate group similar types together.
   *
   * Example:
   *   layout     [['a', Int8], ['b', Int32], ['c', Int8], ['d', Int32], ['e', Int16]]
   *   byte usage [X---         XXXX          X---         XXXX          XX**        ] = 20 bytes
   * The '-' bytes are lost since the access type of Int32 can only address every 4th byte.
   * The '*' bytes are lost due to alignment of the struct size to the access type of Int32.
   * In total 8 bytes are wasted. With some regrouping all bytes can be used:
   *   layout     [['a', Int8], ['c', Int8], ['e', Int16], ['b', Int32], ['d', Int32]]
   *   byte usage [X            X            XX            XXXX          XXXX        ] = 12 bytes
   */
  export abstract class Structure extends CType implements IStructure {
    fields: { [index: string]: ICType };
    static fields: [string, ICTypeConstructor<any>][] = [];
    private static _accessors: AccessType = 0;
    private static _aligments: { [index: string]: number[] } | null = null;
    private static _bytes: number;
    static get accessType(): any {
      if (this._accessors) return this._accessors;
      for (let i = 0; i < this.fields.length; ++i) this._accessors |= this.fields[i][1].accessType;
      return this._accessors;
    }
    static get alignments(): { [index: string]: number[] } {
      if (this._aligments) this._aligments;
      this._aligments = {};
      let p = 0;
      for (let i = 0; i < this.fields.length; ++i) {
        const byteSize = this.fields[i][1].bytes;
        const acc = this.fields[i][1].accessType;
        if (acc & AccessBits.BIT32 && p & 3) p = ((p >> 2) + 1) << 2; // TODO: use align function
        else if (acc & AccessBits.BIT16 && p & 1) p++;
        this._aligments[this.fields[i][0]] = [p, byteSize];
        p += byteSize;
      }
      return this._aligments;
    }
    static get bytes(): number {
      if (this._bytes) this._bytes;
      const lastMemberAlign = this.alignments[this.fields[this.fields.length - 1][0]];
      this._bytes = lastMemberAlign[0] + lastMemberAlign[1];
      if (this.accessType & AccessBits.BIT32 && this._bytes & 3) this._bytes = ((this._bytes >> 2) + 1) << 2;
      else if (this.accessType & AccessBits.BIT16 && this._bytes & 1) this._bytes++;
      return this._bytes;
    }
    constructor(memory: IMemory, value?: any, address?: Address) {
      super(memory, null, address);
      const fields = (this.constructor as IStructureConstructor<any>).fields;
      const alignments = (this.constructor as IStructureConstructor<any>).alignments;
      this.fields = {};
      for (let i = 0; i < fields.length; ++i) {
        this.fields[fields[i][0]] = new fields[i][1](memory, null, this.address + alignments[fields[i][0]][0]);
      }
      this.setValue(value);
    }
    get value(): any {
      return this.getValue();
    }
    set value(value: any) {
      this.setValue(value);
    }
    getValue(): any {
      const res: { [index: string]: any } = {};
      for (const el in this.fields) res[el] = this.fields[el].getValue();
      return res;
    }
    setValue(value: any): void {
      if (value === null || value === undefined) return;
      if (value && this.constructor === value.constructor) {
        const corr = (this.accessType & AccessBits.BIT32) ? 2 : (this.accessType & AccessBits.BIT16) ? 1 : 0;
        const access = (this.accessType & AccessBits.BIT32)
          ? AccessType.UINT32
          : (this.accessType & AccessBits.BIT16) ? AccessType.UINT16 : AccessType.UINT8;
        const pThis = this.address >> corr;
        const pValue = value._address >> corr;
        const slots = (this.constructor as IStructureConstructor<any>).bytes >> corr;
        for (let i = 0; i < slots; ++i) this.memory[access][pThis + i] = value.memory[access][pValue + i];
        return;
      }
      if (value instanceof Structure) value = value.fields;
      for (const el in this.fields) if (value[el] !== undefined) this.fields[el].setValue(value[el]);
    }
    setAddress(address: Address): void {
      super.setAddress(address);
      if (!this.fields) return;
      const fields = (this.constructor as IStructureConstructor<any>).fields;
      const alignments = (this.constructor as IStructureConstructor<any>).alignments;
      for (let i = 0; i < fields.length; ++i) this.fields[fields[i][0]].setAddress(this.address + alignments[fields[i][0]][0]);
    }
  }

} // end namespace ctypes
