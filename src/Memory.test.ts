/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as chai from 'chai';
import { StackMemory, PoolMemory, IMemory, AccessType, AccessBits, SeglistMemory, SL, Address, ctypes } from './Memory';

describe('Memory', function (): void {
  describe('StackMemory', function (): void {
    let mem: StackMemory;
    beforeEach(function (): void {
      mem = new StackMemory(8);
    });
    it('init', function (): void {
      chai.expect(mem.sp).equals(mem.RESERVED_BYTES >>> 2);
      chai.expect(mem.data.length).equals((8 + mem.RESERVED_BYTES) >>> 2);
    });
    it('alloc', function (): void {
      let sp = mem.sp;
      let p = mem.alloc(7);
      chai.expect(p).equals(sp << 2);
      chai.expect(mem.data.length >= sp - 1).equals(true);
      sp = mem.sp;
      chai.expect(sp - (p >> 2)).equals(2);
      p = mem.alloc(123);
      sp = mem.sp;
      chai.expect(sp - (p >> 2)).equals(31);
      chai.expect(mem.data.length >= sp - 1).equals(true);
    });
    it('alloc - out of memory', function (): void {
      mem = new StackMemory(0, 52);
      for (let i = 0; i < 9; ++i) mem.alloc(1);
      // next alloc of one byte should raise: 16 (reserved) + 9*4 (alloc'd) = 52
      chai.expect(() => { mem.alloc(1); }).throw(Error, 'out of memory');
    });
    it('free', function (): void {
      const p1 = mem.alloc(13); // 4 slots
      mem.alloc(23);            // 6 slots
      const p3 = mem.alloc(65); // 17 slots
      chai.expect(mem.sp).equals((mem.RESERVED_BYTES >>> 2) + 4 + 6 + 17);
      mem.free(p3);
      chai.expect(mem.sp).equals((mem.RESERVED_BYTES >>> 2) + 4 + 6);
      mem.free(p1);
      chai.expect(mem.sp).equals(mem.RESERVED_BYTES >>> 2); // note: p2 is also lost
      mem.free(p1); // double free is ignored
    });
  });
  describe('PoolMemory', function (): void {
    function checkFreeList(m: PoolMemory, expectedFree: number): void {
      let head = m.head;
      let count = 0;
      while (head) {
        count++;
        head = m.data[head];
      }
      chai.expect(count).equals(expectedFree);
    }
    let mem: PoolMemory;
    it('init - alignment of different slot sizes', function (): void {
      mem = new PoolMemory(2, 10);    // always takes at least 4 bytes
      chai.expect(mem.data.length).equals((mem.RESERVED_BYTES >>> 2) + 1 * 10);
      chai.expect(mem.head).equals(4);
      checkFreeList(mem, 10);
      mem = new PoolMemory(7, 10);    // 2x
      chai.expect(mem.data.length).equals((mem.RESERVED_BYTES >>> 2) + 2 * 10);
      checkFreeList(mem, 10);
      mem = new PoolMemory(8, 10);    // 2x
      chai.expect(mem.data.length).equals((mem.RESERVED_BYTES >>> 2) + 2 * 10);
      checkFreeList(mem, 10);
      mem = new PoolMemory(9, 10);    // 3x
      chai.expect(mem.data.length).equals((mem.RESERVED_BYTES >>> 2) + 3 * 10);
      checkFreeList(mem, 10);
      mem = new PoolMemory(997, 10);  // 250x
      chai.expect(mem.data.length).equals((mem.RESERVED_BYTES >>> 2) + 250 * 10);
      checkFreeList(mem, 10);
    });
    it('alloc - bytes bound check', function (): void {
      // slotSize is 4 bytes align: 17 --> 20
      // we should be able to alloc any up to 20
      mem = new PoolMemory(17, 20);
      for (let i = 0; i < 21; ++i) mem.alloc(i);
      chai.expect(() => { mem.alloc(21); }).throw(Error, 'blockSize exceeded');
    });
    it('alloc - out of memory', function (): void {
      mem = new PoolMemory(17, 10, 10);
      for (let i = 0; i < 10; ++i) {
        mem.alloc(5);
        checkFreeList(mem, 10 - i - 1);
      }
      chai.expect(() => { mem.alloc(1); }).throw(Error, 'out of memory');
    });
    it('free', function (): void {
      mem = new PoolMemory(17, 10, 10);
      const pointers = [];
      for (let i = 0; i < 10; ++i) pointers.push(mem.alloc(5));
      checkFreeList(mem, 0);
      for (let i = 0; i < 10; ++i) {
        mem.free(pointers.pop());
        checkFreeList(mem, i + 1);
      }
    });
    it('non overlapping write/read', function (): void {
      mem = new PoolMemory(8, 10, 10);
      const pointers = [];
      for (let i = 0; i < 10; ++i) pointers.push(mem.alloc(8));
      for (let i = 0; i < 10; ++i) {
        mem.data[pointers[i] >>> 2] = i;
        mem.data[(pointers[i] + 1) >>> 2] = i;
      }
      for (let i = 0; i < 10; ++i) {
        chai.expect(mem.data[pointers[i] >>> 2]).equals(i);
        chai.expect(mem.data[(pointers[i] + 1) >>> 2]).equals(i);
      }
    });
  });
  describe('SeglistMemory', function (): void {
    let mem: SeglistMemory;
    function getSegLists(m: SeglistMemory): number[][][] {
      const res = [];
      for (let i = 0; i < m.SEGLIST_SIZE; ++i) {
        const l = [];
        let p = mem.heads[i];
        while (p) {
          l.push([p, mem.data[p + SL.SIZE]]);
          p = mem.data[p + SL.NEXT_LINKED];
        }
        res.push(l);
      }
      return res;
    }
    function takenBlockSize(m: SeglistMemory, datapointer: Address): number {
      return m.data[(datapointer >>> 2) - 1] & ~1;
    }
    function checkBlocksizeSum(m: SeglistMemory, takenBlocks: Address[], expected: number): void {
      let takenSum = 0;
      for (let i = 0; i < takenBlocks.length; ++i) takenSum += takenBlockSize(m, takenBlocks[i]) + SL.HEADER_SIZE;
      let freeSum = 0;
      const freeBlocks = getSegLists(m);
      for (let i = 0; i < freeBlocks.length; ++i) {
        for (let j = 0; j < freeBlocks[i].length; ++j) freeSum += freeBlocks[i][j][1] + SL.HEADER_SIZE;
      }
      const total = 4 + takenSum + freeSum;
      chai.expect(total << 2).equals(expected);
    }
    it('seglist index - getFromHead (request memory)', function (): void {
      mem = new SeglistMemory(8);
      for (let i = 1; i < 300; ++i) {
        const idx = mem.getFromHead(i);  // i as 4 byte slots
        if (i <= 2) chai.expect(idx).equals(0);
        else if (i <= 4) chai.expect(idx).equals(1);
        else if (i <= 8) chai.expect(idx).equals(2);
        else if (i <= 16) chai.expect(idx).equals(3);
        else if (i <= 32) chai.expect(idx).equals(4);
        else if (i <= 64) chai.expect(idx).equals(5);
        else if (i <= 128) chai.expect(idx).equals(6);
        else if (i > 256) chai.expect(idx).equals(7);
      }
    });
    it('seglist index - setToHead (insert memory)', function (): void {
      mem = new SeglistMemory(8);
      for (let i = 1; i < 300; ++i) {
        const idx = mem.setToHead(i);  // i as 4 byte slots
        if (i === 1) chai.expect(idx).equals(-1);
        else if (i < 4) chai.expect(idx).equals(0);
        else if (i < 8) chai.expect(idx).equals(1);
        else if (i < 16) chai.expect(idx).equals(2);
        else if (i < 32) chai.expect(idx).equals(3);
        else if (i < 64) chai.expect(idx).equals(4);
        else if (i < 128) chai.expect(idx).equals(5);
        else if (i < 256) chai.expect(idx).equals(6);
        else if (i >= 256) chai.expect(idx).equals(7);
      }
    });
    it('init', function (): void {
      mem = new SeglistMemory(16);
      chai.expect(getSegLists(mem)).eql([[[4, 2]], [], [], [], [], [], [], []]);
      mem = new SeglistMemory(24);
      chai.expect(getSegLists(mem)).eql([[], [[4, 4]], [], [], [], [], [], []]);
      mem = new SeglistMemory(32);
      chai.expect(getSegLists(mem)).eql([[], [[4, 6]], [], [], [], [], [], []]);
      mem = new SeglistMemory(40);
      chai.expect(getSegLists(mem)).eql([[], [], [[4, 8]], [], [], [], [], []]);
      mem = new SeglistMemory(48);
      chai.expect(getSegLists(mem)).eql([[], [], [[4, 10]], [], [], [], [], []]);
      mem = new SeglistMemory(56);
      chai.expect(getSegLists(mem)).eql([[], [], [[4, 12]], [], [], [], [], []]);
      mem = new SeglistMemory(64);
      chai.expect(getSegLists(mem)).eql([[], [], [[4, 14]], [], [], [], [], []]);
      mem = new SeglistMemory(128);
      chai.expect(getSegLists(mem)).eql([[], [], [], [[4, 30]], [], [], [], []]);
      mem = new SeglistMemory(256);
      chai.expect(getSegLists(mem)).eql([[], [], [], [], [[4, 62]], [], [], []]);
      mem = new SeglistMemory(512);
      chai.expect(getSegLists(mem)).eql([[], [], [], [], [], [[4, 126]], [], []]);
      mem = new SeglistMemory(1024);
      chai.expect(getSegLists(mem)).eql([[], [], [], [], [], [], [[4, 254]], []]);
      mem = new SeglistMemory(1032);
      chai.expect(getSegLists(mem)).eql([[], [], [], [], [], [], [], [[4, 256]]]);
      mem = new SeglistMemory(1040);
      chai.expect(getSegLists(mem)).eql([[], [], [], [], [], [], [], [[4, 258]]]);
      mem = new SeglistMemory(65536);
      chai.expect(getSegLists(mem)).eql([[], [], [], [], [], [], [], [[4, 16382]]]);
    });
    it('alloc', function (): void {
      mem = new SeglistMemory(16);
      chai.expect(mem.data.length).equals(8);    // 16 reserved + 16 free
      chai.expect(getSegLists(mem)).eql([[[4, 2]], [], [], [], [], [], [], []]);  // usable 1x 8 (16 - 8) slot 0
      const p1 = mem.alloc(16);                  // need 24 bytes, have only 8 --> resize
      chai.expect(mem.data.length).equals(16);   // 16 reserved + 24 taken + 24 free
      chai.expect(getSegLists(mem)).eql([[], [[10, 4]], [], [], [], [], [], []]); // usable 1x 16 (24 - 8) slot 1
      chai.expect(takenBlockSize(mem, p1)).gte(16 >>> 2);
      const p2 = mem.alloc(16);                  // another 24 bytes --> no resize
      chai.expect(mem.data.length).equals(16);   // 16 reserved + 24 taken + 24 taken
      chai.expect(getSegLists(mem)).eql([[], [], [], [], [], [], [], []]);        // no free block in seglists
      chai.expect(takenBlockSize(mem, p2)).gte(16 >>> 2);
      const p3 = mem.alloc(123);                 // need 128 + 8 bytes --> resize
      chai.expect(mem.data.length).equals(64);   // 16 reserved + 24 taken + 24 taken + 136 taken + 56 free
      chai.expect(getSegLists(mem)).eql([[], [], [[50, 12]], [], [], [], [], []]); // usable 1x 48 (56 - 8) slot 2
      chai.expect(takenBlockSize(mem, p3)).gte(128 >>> 2);
      checkBlocksizeSum(mem, [p1, p2, p3], (16 + 24 + 24 + 136 + 56));
    });
    it('free', function (): void {
      mem = new SeglistMemory(16);
      const p1 = mem.alloc(16);
      const p2 = mem.alloc(16);
      const p3 = mem.alloc(123);
      checkBlocksizeSum(mem, [p1, p2, p3], (16 + 24 + 24 + 136 + 56));
      mem.free(p3);
      checkBlocksizeSum(mem, [p1, p2], (16 + 24 + 24 + 192));
      chai.expect(getSegLists(mem)).eql([[], [], [], [], [[16, 46]], [], [], []]);
      mem.free(p1);
      checkBlocksizeSum(mem, [p2], (16 + 24 + 24 + 192));
      chai.expect(getSegLists(mem)).eql([[], [[4, 4]], [], [], [[16, 46]], [], [], []]);
      mem.free(p2);
      checkBlocksizeSum(mem, [], (16 + 24 + 24 + 192));
      chai.expect(getSegLists(mem)).eql([[], [], [], [], [[4, 58]], [], [], []]);
    });
    it('8 byte alignment', function (): void {
      mem = new SeglistMemory(16);
      for (let i = 1; i < 20; ++i) {
        const p1 = mem.alloc((1 << i) - 1);
        const p2 = mem.alloc(1 << i);
        const p3 = mem.alloc((1 << i) + 1);
        chai.expect(p1 % 8).equals(0);
        chai.expect(p2 % 8).equals(0);
        chai.expect(p3 % 8).equals(0);
        chai.expect(takenBlockSize(mem, p1) % 2).equals(0);
        chai.expect(takenBlockSize(mem, p2) % 2).equals(0);
        chai.expect(takenBlockSize(mem, p3) % 2).equals(0);
        mem.free(p1);
        mem.free(p2);
        mem.free(p3);
      }
    });
  });
  describe('accessors', function (): void {
    let mem: IMemory;
    it('register', function (): void {
      mem = new StackMemory(8);
      const accessTypes: AccessType[] = [
        AccessType.UINT8, AccessType.INT8, AccessType.UINT16, AccessType.INT16,
        AccessType.UINT32, AccessType.INT32, AccessType.FLOAT32];
      for (let i = 0; i < accessTypes.length; ++i) {
        const accessType = accessTypes[i];
        chai.expect(mem.registeredAccessTypes & accessType).equals(0);
        chai.expect(mem[accessType]).equals(null);
        mem.registerAccess(accessType);
        chai.expect(mem.registeredAccessTypes & accessType).equals(accessType);
        chai.expect(mem[accessType] !== null).equals(true);
      }
    });
    it('update', function (): void {
      // tests 2x4 slots with every memory and access type
      const accessTypes: AccessType[] = [
        AccessType.UINT8, AccessType.INT8, AccessType.UINT16, AccessType.INT16,
        AccessType.UINT32, AccessType.INT32, AccessType.FLOAT32];
      for (let i = 0; i < accessTypes.length; ++i) {
        const accessType = accessTypes[i];
        const pointerCorr = (accessType & AccessBits.BIT32) ? 2 : (accessType & AccessBits.BIT16) ? 1 : 0;
        const impl = [
          new StackMemory(4 << pointerCorr),
          new PoolMemory(4 << pointerCorr, 1),
          new SeglistMemory(8)
        ];
        for (let j = 0; j < impl.length; ++j) {
          mem = impl[j];
          mem.registerAccess(accessType);
          const p1 = mem.alloc(4 << pointerCorr) >>> pointerCorr;
          for (let i = 0; i < 4; ++i) mem[accessType][p1 + i] = 4.1;
          const p2 = mem.alloc(4 << pointerCorr) >>> pointerCorr;
          for (let i = 0; i < 4; ++i) mem[accessType][p2 + i] = 8.2;
          if (accessType === AccessType.FLOAT32) {
            for (let i = 0; i < 4; ++i) chai.expect(mem[accessType][p1 + i]).closeTo(4.1, 0.001);
            for (let i = 0; i < 4; ++i) chai.expect(mem[accessType][p2 + i]).closeTo(8.2, 0.001);
          } else {
            for (let i = 0; i < 4; ++i) chai.expect(mem[accessType][p1 + i]).equals(4);
            for (let i = 0; i < 4; ++i) chai.expect(mem[accessType][p2 + i]).equals(8);
          }
        }
      }
    });
  });
});

// example with primitve types
class Example1 extends ctypes.Structure {
  static typename = 'Example1';
  static fields: [string, ctypes.ICTypeConstructor<any>][] = [
    ['a', ctypes.Int8],
    ['b', ctypes.Int16],
    ['c', ctypes.Int32]
  ];
}

/**
 * example with complicated types
 * struct {
 *   Example1 example1;
 *   int16_t *pointer;
 *   int32_t array[5];
 * };
 */
class Example2 extends ctypes.Structure {
  static typename = 'Example2';
  static fields: [string, ctypes.ICTypeConstructor<any>][] = [
    ['example1', Example1],
    ['pointer', ctypes.pointer<ctypes.Int16>(ctypes.Int16)],
    ['array', ctypes.array<ctypes.Int32>(ctypes.Int32, 5)]
  ];
}

describe('ctypes', function (): void {
  let m: IMemory;
  beforeEach(function (): void {
    m = new SeglistMemory(16);
  });
  describe('primitives', function (): void {
    it('Uint8', function (): void {
      const num = new ctypes.Uint8(m, 123);
      chai.expect(num.getValue()).equals(123);
      chai.expect(num.value).equals(123);
      num.setValue(45);
      chai.expect(num.getValue()).equals(45);
      num.value += 123;
      chai.expect(num.getValue()).equals(168);
      num.value += 123;
      chai.expect(num.getValue()).equals(35);
      const num2 = new ctypes.Uint8(m, num);
      chai.expect(num2.getValue()).equals(35);
      m.free(num.address);
      m.free(num2.address);
    });
    it('Int8', function (): void {
      const num = new ctypes.Int8(m, 123);
      chai.expect(num.getValue()).equals(123);
      chai.expect(num.value).equals(123);
      num.setValue(45);
      chai.expect(num.getValue()).equals(45);
      num.value += 123;
      chai.expect(num.getValue()).equals(-88);
      num.value += 123;
      chai.expect(num.getValue()).equals(35);
      const num2 = new ctypes.Int8(m, num);
      chai.expect(num2.getValue()).equals(35);
      m.free(num.address);
      m.free(num2.address);
    });
    it('Uint16', function (): void {
      const num = new ctypes.Uint16(m, 123);
      chai.expect(num.getValue()).equals(123);
      chai.expect(num.value).equals(123);
      num.setValue(32000);
      chai.expect(num.getValue()).equals(32000);
      num.value += 10000;
      chai.expect(num.getValue()).equals(42000);
      num.value += 50000;
      chai.expect(num.getValue()).equals(26464);
      const num2 = new ctypes.Uint16(m, num);
      chai.expect(num2.getValue()).equals(26464);
      m.free(num.address);
      m.free(num2.address);
    });
    it('Int16', function (): void {
      const num = new ctypes.Int16(m, 123);
      chai.expect(num.getValue()).equals(123);
      chai.expect(num.value).equals(123);
      num.setValue(32000);
      chai.expect(num.getValue()).equals(32000);
      num.value += 10000;
      chai.expect(num.getValue()).equals(-23536);
      num.value += 50000;
      chai.expect(num.getValue()).equals(26464);
      const num2 = new ctypes.Int16(m, num);
      chai.expect(num2.getValue()).equals(26464);
      m.free(num.address);
      m.free(num2.address);
    });
    it('Uint32', function (): void {
      const num = new ctypes.Uint32(m, 123456789);
      chai.expect(num.getValue()).equals(123456789);
      chai.expect(num.value).equals(123456789);
      num.setValue(2000000000);
      chai.expect(num.getValue()).equals(2000000000);
      num.value += 2000000000;
      chai.expect(num.getValue()).equals(4000000000);
      num.value += 1000000000;
      chai.expect(num.getValue()).equals(705032704);
      const num2 = new ctypes.Uint32(m, num);
      chai.expect(num2.getValue()).equals(705032704);
      m.free(num.address);
      m.free(num2.address);
    });
    it('Int32', function (): void {
      const num = new ctypes.Int32(m, 123456789);
      chai.expect(num.getValue()).equals(123456789);
      chai.expect(num.value).equals(123456789);
      num.setValue(2000000000);
      chai.expect(num.getValue()).equals(2000000000);
      num.value += 2000000000;
      chai.expect(num.getValue()).equals(-294967296);
      num.value += 1000000000;
      chai.expect(num.getValue()).equals(705032704);
      const num2 = new ctypes.Int32(m, num);
      chai.expect(num2.getValue()).equals(705032704);
      m.free(num.address);
      m.free(num2.address);
    });
    it('Float', function (): void {
      const num = new ctypes.Float(m, Math.PI);
      chai.expect(num.getValue()).closeTo(Math.PI, 0.00001);
      chai.expect(num.value).closeTo(Math.PI, 0.00001);
      num.setValue(Math.E);
      chai.expect(num.getValue()).closeTo(Math.E, 0.00001);
      const num2 = new ctypes.Float(m, num);
      chai.expect(num2.getValue()).closeTo(Math.E, 0.00001);
      m.free(num.address);
      m.free(num2.address);
    });
    it('Char', function (): void {
      const c = new ctypes.Char(m, 'abc');
      chai.expect(c.getValue()).equals('a');
      chai.expect(c.value).equals('a');
      c.setValue('b');
      chai.expect(c.getValue()).equals('b');
      const c2 = new ctypes.Char(m, c);
      chai.expect(c2.getValue()).equals('b');
      m.free(c.address);
      m.free(c2.address);
    });
    it('WChar', function (): void {
      const c = new ctypes.WChar(m, 'abc');
      chai.expect(c.getValue()).equals('a');
      chai.expect(c.value).equals('a');
      c.setValue('€');
      chai.expect(c.getValue()).equals('€');
      const c2 = new ctypes.WChar(m, c);
      chai.expect(c2.getValue()).equals('€');
      m.free(c.address);
      m.free(c2.address);
    });
  });
  describe('Pointer', function(): void {
    it('VoidPointer', function(): void {
      const p = new ctypes.VoidPointer(m, 123);
      chai.expect(p.getValue()).equals(123);
      chai.expect(p.value).equals(123);
      chai.expect(() => { p.deref(); }).throw(Error, 'trying to deref void pointer');
      chai.expect(() => { p.inc(); }).throw(Error, 'arithmetic on void pointer');
      chai.expect(() => { p.dec(); }).throw(Error, 'arithmetic on void pointer');
      chai.expect(() => { p.add(12); }).throw(Error, 'arithmetic on void pointer');
      m.free(p.address);
    });
    it('TypedPointer', function(): void {
      const num = new ctypes.Uint16(m, 12345);
      const pUint16 = ctypes.pointer<ctypes.Uint16>(ctypes.Uint16);
      const p = new pUint16(m, num.address);
      chai.expect(p.getValue()).equals(num.address);
      chai.expect(p.value).equals(num.address);
      chai.expect(p.deref() instanceof ctypes.Uint16).equals(true);
      chai.expect(p.deref().value).equals(12345);
      p.inc();
      chai.expect(p.value).equals(num.address + ctypes.Uint16.bytes);
      p.dec();
      chai.expect(p.value).equals(num.address);
      p.add(5);
      chai.expect(p.value).equals(num.address + ctypes.Uint16.bytes * 5);
      m.free(p.address);
      m.free(num.address);
    });
    it('cast uint16* to void* to uint16*', function(): void {
      const num = new ctypes.Uint16(m, 12345);
      const pUint16 = ctypes.pointer<ctypes.Uint16>(ctypes.Uint16);
      const p = new pUint16(m, num.address);
      // cast to void pointer
      const vp = p.cast<ctypes.VoidPointer>(null);
      chai.expect(vp instanceof ctypes.VoidPointer).equals(true);
      chai.expect(vp.address).equals(p.address);
      chai.expect(vp.value).equals(p.value);
      // cast back to uint16 pointer
      const pp = vp.cast<ctypes.Uint16>(ctypes.Uint16);
      chai.expect(pp.deref() instanceof ctypes.Uint16).equals(true);
      chai.expect(pp.address).equals(p.address);
      chai.expect(pp.value).equals(p.value);
      chai.expect(pp.deref().value).equals(12345);
      pp.inc();
      chai.expect(pp.value).equals(num.address + ctypes.Uint16.bytes);
      pp.dec();
      chai.expect(pp.value).equals(num.address);
      pp.add(5);
      chai.expect(pp.value).equals(num.address + ctypes.Uint16.bytes * 5);
      m.free(p.address);
      m.free(num.address);
    });
  });
  describe('CArray', function(): void {
    it('create from JS array', function(): void {
      const UINT16_A5 = ctypes.array<ctypes.Uint16>(ctypes.Uint16, 5);
      const data = [1, 2, 3, 4, 65535, 66, 77]; // actually 7 items
      const ar = new UINT16_A5(m, data);
      chai.expect(ar instanceof UINT16_A5).equals(true);
      chai.expect(ar.length).equals(5);
      chai.expect(ar.value).eql(data.slice(0, -2));
      for (let i = 0; i < ar.length; ++i) chai.expect(ar.get(i)).equals(data[i]);
      ar.set(4, 65537);
      chai.expect(ar.get(4)).equals(1);
      m.free(ar.address);
    });
    it('create from CArray', function(): void {
      const UINT16_A5 = ctypes.array<ctypes.Uint16>(ctypes.Uint16, 5);
      const data = [1, 2, 3, 4, 65535, 66, 77];
      const ar = new UINT16_A5(m, data);
      const UINT16_A3 = ctypes.array<ctypes.Uint16>(ctypes.Uint16, 3);
      const ar2 = new UINT16_A3(m, ar);
      chai.expect(ar2 instanceof UINT16_A3).equals(true);
      chai.expect(ar2 instanceof UINT16_A5).equals(false);
      chai.expect(ar2.length).equals(3);
      chai.expect(ar2.value).eql(ar.value.slice(0, -2));
      m.free(ar.address);
      m.free(ar2.address);
    });
  });
  describe('Structure', function(): void {
    it('Example1', function(): void {
      chai.expect(Example1.bytes).equals(8);
      const data = {a: 1, b: 2, c: 3};
      const example = new Example1(m, data);
      chai.expect(example.value).eql(data);
      chai.expect(Object.getOwnPropertyNames(example.fields)).eql(['a', 'b', 'c']);
      chai.expect(example.fields.a instanceof ctypes.Int8).equals(true);
      chai.expect(example.fields.b instanceof ctypes.Int16).equals(true);
      chai.expect(example.fields.c instanceof ctypes.Int32).equals(true);
      m.free(example.address);
    });
    it('Example2', function(): void {
      chai.expect(Example2.bytes).equals(32);
      const data = {example1: {a: 1, b: 2, c: 3}, pointer: 0, array: [1, 2, 3, 4, 5]};
      const example = new Example2(m, data);
      chai.expect(example.value).eql(data);
      chai.expect(Object.getOwnPropertyNames(example.fields)).eql(['example1', 'pointer', 'array']);
      chai.expect(example.fields.example1 instanceof Example1).equals(true);
      chai.expect(example.fields.pointer instanceof ctypes.pointer<ctypes.Int16>(ctypes.Int16)).equals(true);
      chai.expect(example.fields.array instanceof ctypes.array<ctypes.Int32>(ctypes.Int32, 5)).equals(true);
      chai.expect(() => { (example.fields.pointer as ctypes.IPointer<ctypes.Int32>).deref(); }).throw(Error, 'trying to deref NULL pointer');
      example.fields.pointer.value = (example.fields.example1 as Example1).fields.c.address;
      chai.expect((example.fields.pointer as ctypes.IPointer<ctypes.Int32>).deref().value).equals(3);
      m.free(example.address);
    });
    it('Example2 array and pointer', function(): void {
      const EXAMPLE2_A3 = ctypes.array<Example2>(Example2, 3);
      const data = [
        {example1: {a: 1, b: 2, c: 3}, pointer: 0, array: [1, 2, 3, 4, 5]},
        {example1: {a: 4, b: 5, c: 6}, pointer: 255, array: [6, 7, 8, 9, 10]},
        {example1: {a: 1, b: 2, c: 3}, pointer: 123456789, array: [11, 12, 13, 14, 15]}
      ];
      const ar = new EXAMPLE2_A3(m, data);
      chai.expect(ar.value).eql(data);
      const pExample2 = ctypes.pointer<Example2>(Example2);
      const p = new pExample2(m, ar.address);
      chai.expect(p.deref().value).eql(data[0]);
      p.inc();
      chai.expect(p.deref().value).eql(data[1]);
      p.add(1);
      chai.expect(p.deref().value).eql(data[2]);
      p.add(-2);
      chai.expect(p.deref().value).eql(data[0]);
      m.free(p.address);
      m.free(ar.address);
    });
  });
});
