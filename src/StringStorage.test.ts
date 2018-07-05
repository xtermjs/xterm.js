/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as chai from 'chai';
import { StringStorage } from './StringStorage';

describe('StringStorage', function(): void {
  let cs: null | StringStorage = null;
  beforeEach(function(): void {
    cs = new StringStorage(4);
  });
  it('16bit codepoints: setString (alloc) & free', function(): void {
    // should not alloc any space
    for (let i = 1; i < 65536; ++i) {
      const p = cs.setString(String.fromCharCode(i));
      chai.expect(p).equals(i);
      cs.free(p);
    }
    let stats = cs.getStats();
    chai.expect(stats.size).equals(4);
    chai.expect(stats.segments).equals(0);
    chai.expect(stats.freeSegments).equals(0);
  });
  it('16bit codepoints: getString', function(): void {
    for (let i = 1; i < 65536; ++i) {
      chai.expect(cs.getString(i)).equals(String.fromCharCode(i));
    }
  });
  it('16bit codepoints: getLength', function(): void {
    for (let i = 1; i < 65536; ++i) {
      chai.expect(cs.getLength(i)).equals(1);
    }
  });
  it('32bit codepoints: setString (alloc) & free', function(): void {
    // should not alloc any space
    for (let i = 65536; i < 0x110000; ++i) {
      let cp = i - 0x10000;
      let s = String.fromCharCode((cp >> 10) + 0xD800) + String.fromCharCode((cp % 0x400) + 0xDC00);
      const p = cs.setString(s);
      chai.expect(p).equals(i);
      cs.free(p);
    }
    let stats = cs.getStats();
    chai.expect(stats.size).equals(4);
    chai.expect(stats.segments).equals(0);
    chai.expect(stats.freeSegments).equals(0);
  });
  it('32bit codepoints: getString', function(): void {
    for (let i = 65536; i < 0x110000; ++i) {
      let cp = i - 0x10000;
      let s = String.fromCharCode((cp >> 10) + 0xD800) + String.fromCharCode((cp % 0x400) + 0xDC00);
      chai.expect(cs.getString(i)).equals(s);
    }
  });
  it('32bit codepoints: getLength', function(): void {
    for (let i = 65536; i < 0x110000; ++i) {
      chai.expect(cs.getLength(i)).equals(2);
    }
  });
  it('combined: setString (alloc) & free', function(): void {
    const p = cs.setString('e\u0301');
    let stats = cs.getStats();
    chai.expect(stats.size).equals(8);
    chai.expect(stats.segments).equals(1);
    chai.expect(stats.freeSegments).equals(0);
    cs.free(p);
    stats = cs.getStats();
    chai.expect(stats.size).equals(8);
    chai.expect(stats.segments).equals(1);
    chai.expect(stats.freeSegments).equals(1);
  });
  it('combined: getString', function(): void {
    const p = cs.setString('e\u0301');
    chai.expect(cs.getString(p)).equals('e\u0301');
    cs.free(p);
  });
  it('combined: getLength', function(): void {
    const p = cs.setString('e\u0301');
    chai.expect(cs.getLength(p)).equals(2);
    cs.free(p);
  });
  it('resize memory by multiple of 2', function(): void {
    const p1 = cs.setString('abc'); // fits into one segment
    let stats = cs.getStats();
    chai.expect(stats.size).equals(8);
    chai.expect(stats.freeSegments).equals(0);
    const p2 = cs.setString('def');
    stats = cs.getStats();
    chai.expect(stats.size).equals(16);
    chai.expect(stats.freeSegments).equals(1);
    const p3 = cs.setString('ghi');
    stats = cs.getStats();
    chai.expect(stats.size).equals(16);
    chai.expect(stats.freeSegments).equals(0);
    const p4 = cs.setString('jkl');
    stats = cs.getStats();
    chai.expect(stats.size).equals(32);
    chai.expect(stats.freeSegments).equals(3);
    chai.expect(
      cs.getString(p1) + cs.getString(p2) + cs.getString(p3) + cs.getString(p4)).equals('abcdefghijkl');
    cs.free(p1);
    cs.free(p2);
    cs.free(p3);
    cs.free(p4);
    stats = cs.getStats();
    chai.expect(stats.size).equals(32);
    chai.expect(stats.freeSegments).equals(7); // all freed
  });
  it('resize memory by multiple of 2 + overhead', function(): void {
    const p1 = cs.setString('abcedfghijk'); // takes three segments
    let stats = cs.getStats();
    chai.expect(stats.size).equals(20); // 20: (12 (null terminated string length) / 4 + 1) * 4 + 4 (not usable)
    chai.expect(stats.freeSegments).equals(1);
    chai.expect(cs.getString(p1)).equals('abcedfghijk');
    cs.free(p1);
    stats = cs.getStats();
    chai.expect(stats.size).equals(20);
    chai.expect(stats.freeSegments).equals(4); // all freed
  });
  it('concat: 16bit codepoint + 16bit codepoint', function() {
    const p1 = cs.setString('a');
    const p2 = cs.setString('b');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('ab');
    chai.expect(cs.getLength(p3)).equals(2);
  });
  it('concat: 32bit codepoint + 16bit codepoint', function() {
    const p1 = cs.setString('𐐷');
    const p2 = cs.setString('b');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('𐐷b');
    chai.expect(cs.getLength(p3)).equals(3);
  });
  it('concat: 16bit codepoint + 32bit codepoint', function() {
    const p1 = cs.setString('a');
    const p2 = cs.setString('𐐷');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('a𐐷');
    chai.expect(cs.getLength(p3)).equals(3);
  });
  it('concat: 32bit codepoint + 32bit codepoint', function() {
    const p1 = cs.setString('𐐷');
    const p2 = cs.setString('𐐷');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('𐐷𐐷');
    chai.expect(cs.getLength(p3)).equals(4);
  });
  it('concat not preserving, mutating: string + 16bit codepoint', function() {
    const p1 = cs.setString('ab');
    const p2 = cs.setString('c');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('abc');
    chai.expect(cs.getLength(p3)).equals(3);
    chai.expect(p1).equals(p3);
  });
  it('concat not preserving: string + 32bit codepoint', function() {
    const p1 = cs.setString('ab');
    const p2 = cs.setString('𐐷');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('ab𐐷');
    chai.expect(cs.getLength(p3)).equals(4);
    chai.expect(cs.isFreed(p1)).equals(true);
  });
  it('concat not preserving: 16bit codepoint + string', function() {
    const p1 = cs.setString('a');
    const p2 = cs.setString('bc');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('abc');
    chai.expect(cs.getLength(p3)).equals(3);
    chai.expect(cs.isFreed(p2)).equals(true);
  });
  it('concat not preserving: 32bit codepoint + string', function() {
    const p1 = cs.setString('𐐷');
    const p2 = cs.setString('bc');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('𐐷bc');
    chai.expect(cs.getLength(p3)).equals(4);
    chai.expect(cs.isFreed(p2)).equals(true);
  });
  it('concat not preserving: string + string', function() {
    const p1 = cs.setString('ab');
    const p2 = cs.setString('cd');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('abcd');
    chai.expect(cs.getLength(p3)).equals(4);
    chai.expect(cs.isFreed(p1)).equals(true);
    chai.expect(cs.isFreed(p2)).equals(true);
  });
  it('concat preserving: string + string', function() {
    const p1 = cs.setString('ab');
    const p2 = cs.setString('cd');
    const p3 = cs.concat(p1, p2, true, true);
    chai.expect(cs.getString(p3)).equals('abcd');
    chai.expect(cs.getLength(p3)).equals(4);
    chai.expect(cs.getString(p1)).equals('ab');
    chai.expect(cs.getString(p2)).equals('cd');
  });
  it('concat not preserving, mutating: string + string', function() {
    const p1 = cs.setString('abcd');
    const p2 = cs.setString('ef');
    const p3 = cs.concat(p1, p2);
    chai.expect(cs.getString(p3)).equals('abcdef');
    chai.expect(cs.getLength(p3)).equals(6);
    chai.expect(p1).equals(p3);
  });
  it('copy strings', function(): void {
    const strings = ['a', '𐐷', 'abcdefg'];
    for (let i = 0; i < strings.length; ++i) {
      const p = cs.setString(strings[i]);
      const p2 = cs.copy(p);
      chai.expect(cs.getString(p2)).equals(strings[i]);
      if (cs.isPointer(p)) chai.expect(p === p2).equals(false);
      else chai.expect(p === p2).equals(true);
    }
  });
});
