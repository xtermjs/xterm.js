/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { HeaderParser, HeaderState, IHeaderFields, SequenceType } from './IIPHeaderParser';


const CASES: [string, IHeaderFields][] = [
  ['File=size=123456;name=dGVzdA==:', {type: SequenceType.FILE, name: 'test', size: 123456}],
  ['File=size=123456;name=dGVzdA:', {type: SequenceType.FILE, name: 'test', size: 123456}],
  // utf-8 encoding in name
  ['File=size=123456;name=w7xtbMOkdXTDnw==:', {type: SequenceType.FILE, name: 'ümläutß', size: 123456}],
  ['File=size=123456;name=w7xtbMOkdXTDnw:', {type: SequenceType.FILE, name: 'ümläutß', size: 123456}],
  // full header spec
  [
    'File=inline=1;width=10px;height=20%;preserveAspectRatio=1;size=123456;name=w7xtbMOkdXTDnw:',
    {
      type: SequenceType.FILE,
      inline: 1,
      width: '10px',
      height: '20%',
      preserveAspectRatio: 1,
      size: 123456,
      name: 'ümläutß'
    }
  ],
  [
    'File=inline=1;width=auto;height=20;preserveAspectRatio=1;size=123456;name=w7xtbMOkdXTDnw:',
    {
      type: SequenceType.FILE,
      inline: 1,
      width: 'auto',
      height: '20',
      preserveAspectRatio: 1,
      size: 123456,
      name: 'ümläutß'
    }
  ]
];

function fromBs(bs: string): Uint32Array {
  const r = new Uint32Array(bs.length);
  for (let i = 0; i < r.length; ++i) r[i] = bs.charCodeAt(i);
  return r;
}

describe('IIPHeaderParser', () => {
  it('at once', () => {
    const hp = new HeaderParser();
    for (const example of CASES) {
      hp.reset();
      const inp = fromBs(example[0]);
      const res = hp.parse(inp, 0, inp.length);
      assert.strictEqual(res, inp.length);
      assert.strictEqual(hp.state, HeaderState.END);
      assert.deepEqual(hp.fields, example[1]);
    }
  });
  it('bytewise', () => {
    const hp = new HeaderParser();
    for (const example of CASES) {
      hp.reset();
      const inp = fromBs(example[0]);
      let pos = 0;
      let res = -2;
      while (res === -2 && pos < inp.length) {
        res = hp.parse(new Uint32Array([inp[pos++]]), 0, 1);
      }
      assert.strictEqual(res, 1);
      assert.strictEqual(hp.state, HeaderState.END);
      assert.deepEqual(hp.fields, example[1]);
    }
  });
  it('no File= starter', () => {
    const hp = new HeaderParser();
    let inp = fromBs('size=123456;name=dGVzdA==:');
    let res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, -1);
    hp.reset();
    inp = fromBs(CASES[0][0]);
    res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, inp.length);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields, CASES[0][1]);
  });
  it('empty key - error', () => {
    const hp = new HeaderParser();
    let inp = fromBs('File=size=123456;=dGVzdA==:');
    let res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, -1);
    hp.reset();
    inp = fromBs(CASES[0][0]);
    res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, inp.length);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields, CASES[0][1]);
  });
  it('empty size value - set to 0', () => {
    const hp = new HeaderParser();
    let inp = fromBs('File=size=;name=dGVzdA==:');
    let res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, inp.length);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields, {type: SequenceType.FILE, name: 'test', size: 0});
    hp.reset();
    inp = fromBs(CASES[0][0]);
    res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, inp.length);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields, CASES[0][1]);
  });
  it('empty name value - set to empty string', () => {
    const hp = new HeaderParser();
    let inp = fromBs('File=size=123456;name=:');
    let res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, inp.length);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields, {type: SequenceType.FILE, name: '', size: 123456});
    hp.reset();
    inp = fromBs(CASES[0][0]);
    res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, inp.length);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields, CASES[0][1]);
  });
  it('empty size value - error', () => {
    const hp = new HeaderParser();
    let inp = fromBs('File=inline=1;width=;height=20%;preserveAspectRatio=1;size=123456;name=w7xtbMOkdXTDnw:');
    let res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, -1);
    hp.reset();
    inp = fromBs(CASES[0][0]);
    res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, inp.length);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields, CASES[0][1]);
  });
  it('FilePart sequence', () => {
    const hp = new HeaderParser();
    const inp = fromBs('FilePart=w7xtbMOkdXTDnw');
    const res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, 9);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields.type, SequenceType.FILEPART);
  });
  it('FilePart sequence - bytewise', () => {
    const hp = new HeaderParser();
    const inp = fromBs('FilePart=w7xtbMOkdXTDnw');
    let res = -2;
    let pos = 0;
    while (res === -2 && pos < inp.length) {
      res = hp.parse(new Uint32Array([inp[pos++]]), 0, 1);
    }
    assert.strictEqual(res, 1);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields.type, SequenceType.FILEPART);
  });
  it('MultipartFile sequence', () => {
    const hp = new HeaderParser();
    const inp = fromBs('MultipartFile=inline=1;width=10px;height=20%;preserveAspectRatio=1;size=123456;name=w7xtbMOkdXTDnw');
    let res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, -2);
    assert.strictEqual(hp.state, HeaderState.VALUE);
    res = hp.end();
    assert.strictEqual(res, 0);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(
      hp.fields,
      {
        type: SequenceType.MULTIPARTFILE,
        inline: 1,
        width: '10px',
        height: '20%',
        preserveAspectRatio: 1,
        size: 123456,
        name: 'ümläutß'
      }
    );
  });
  it('MultipartFile sequence - bytewise', () => {
    const hp = new HeaderParser();
    const inp = fromBs('MultipartFile=inline=1;width=10px;height=20%;preserveAspectRatio=1;size=123456;name=w7xtbMOkdXTDnw');
    let res = -2;
    let pos = 0;
    while (res === -2 && pos < inp.length) {
      res = hp.parse(new Uint32Array([inp[pos++]]), 0, 1);
    }
    assert.strictEqual(res, -2);
    assert.strictEqual(hp.state, HeaderState.VALUE);
    res = hp.end();
    assert.strictEqual(res, 0);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(
      hp.fields,
      {
        type: SequenceType.MULTIPARTFILE,
        inline: 1,
        width: '10px',
        height: '20%',
        preserveAspectRatio: 1,
        size: 123456,
        name: 'ümläutß'
      }
    );
  });
  it('FileEnd sequence', () => {
    const hp = new HeaderParser();
    const inp = fromBs('FileEnd');
    let res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, -2);
    assert.strictEqual(hp.state, HeaderState.START);
    res = hp.end();
    assert.strictEqual(res, 0);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields.type, SequenceType.FILEEND);
  });
  it('FileEnd sequence - bytewise', () => {
    const hp = new HeaderParser();
    const inp = fromBs('FileEnd');
    let res = -2;
    let pos = 0;
    while (res === -2 && pos < inp.length) {
      res = hp.parse(new Uint32Array([inp[pos++]]), 0, 1);
    }
    assert.strictEqual(res, -2);
    assert.strictEqual(hp.state, HeaderState.START);
    res = hp.end();
    assert.strictEqual(res, 0);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields.type, SequenceType.FILEEND);
  });
  it('ReportCellSize sequence', () => {
    const hp = new HeaderParser();
    const inp = fromBs('ReportCellSize');
    let res = hp.parse(inp, 0, inp.length);
    assert.strictEqual(res, -2);
    assert.strictEqual(hp.state, HeaderState.START);
    res = hp.end();
    assert.strictEqual(res, 0);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields, { type: SequenceType.REPORTCELLSIZE });
  });
  it('ReportCellSize sequence - bytewise', () => {
    const hp = new HeaderParser();
    const inp = fromBs('ReportCellSize');
    let res = -2;
    let pos = 0;
    while (res === -2 && pos < inp.length) {
      res = hp.parse(new Uint32Array([inp[pos++]]), 0, 1);
    }
    assert.strictEqual(res, -2);
    assert.strictEqual(hp.state, HeaderState.START);
    res = hp.end();
    assert.strictEqual(res, 0);
    assert.strictEqual(hp.state, HeaderState.END);
    assert.deepEqual(hp.fields, { type: SequenceType.REPORTCELLSIZE });
  });
});
