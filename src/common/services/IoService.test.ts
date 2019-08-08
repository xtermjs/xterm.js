/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { IOptionsService } from 'common/services/Services';
import { IEncoding } from 'common/Types';
import { DEFAULT_ENCODINGS, utf32ToString } from 'common/input/Encodings';
import { IoService } from 'common/services/IoService';
import { OptionsService } from './OptionsService';

declare let setTimeout: (handler: () => void, timeout?: number) => number;

function getOptionService(): IOptionsService {
  const optionsService = new OptionsService({});
  optionsService.options.encoding = 'utf-8';
  return optionsService;
}

function getEncoding(name: string): IEncoding {
  for (const encoding of DEFAULT_ENCODINGS) {
    if (encoding.name === name) {
      return encoding;
    }
    for (const alias of encoding.aliases) {
      if (alias === name) {
        return encoding;
      }
    }
  }
  throw new Error('unknown encoding');
}

const TERM_DATA: any[] = [];
function parse(data: Uint32Array, length: number): void {
  TERM_DATA.push(utf32ToString(data, 0, length));
}

describe('IoService', () => {
  let optionsService: IOptionsService;
  let ios: IoService;
  beforeEach(() => {
    optionsService = getOptionService();
    ios = new IoService(parse, optionsService);
    while (TERM_DATA.length) TERM_DATA.pop();
  });
  describe('encoding handling', () => {
    it('should support default encodings', () => {
      const defaultEncodingNames = DEFAULT_ENCODINGS.map(el => el.name);
      assert.deepEqual(Object.keys(ios.encodings), defaultEncodingNames);
    });
    it('should default to options.encoding', () => {
      optionsService.options.encoding = 'utf-8';
      let ios = new IoService(parse, optionsService);
      assert.equal((ios as any)._encoder.constructor, getEncoding('utf-8').encoder);
      assert.equal((ios as any)._decoder.constructor, getEncoding('utf-8').decoder);
      optionsService.options.encoding = 'iso-8859-1';
      ios = new IoService(parse, optionsService);
      assert.equal((ios as any)._encoder.constructor, getEncoding('iso-8859-1').encoder);
      assert.equal((ios as any)._decoder.constructor, getEncoding('iso-8859-1').decoder);
    });
    it('should switch encoding on option change', () => {
      optionsService.setOption('encoding', 'iso-8859-1');
      assert.equal(optionsService.options.encoding, 'iso-8859-1');
      assert.equal((ios as any)._encoder.constructor, getEncoding('iso-8859-1').encoder);
      // Note: decoder changes is delayed if writeBuffer is not empty!
      assert.equal((ios as any)._decoder.constructor, getEncoding('iso-8859-1').decoder);
    });
    it('switch should support all registered encoding names', () => {
      Object.keys(ios.encodings).forEach(name => {
        optionsService.setOption('encoding', name);
        assert.equal((ios as any)._encoder.constructor, getEncoding(name).encoder);
        assert.equal((ios as any)._decoder.constructor, getEncoding(name).decoder);
      });
      assert.throws(() => {optionsService.setOption('encoding', 'foo'); }, 'unsupported encoding "foo"');
    });
    it('switch should support all registered encoding aliases', () => {
      let aliases: string[] = [];
      DEFAULT_ENCODINGS.forEach(el => aliases = aliases.concat(el.aliases));
      aliases.forEach(name => {
        optionsService.setOption('encoding', 'utf-8');
        optionsService.setOption('encoding', name);
        assert.equal((ios as any)._encoder.constructor, getEncoding(name).encoder);
        assert.equal((ios as any)._decoder.constructor, getEncoding(name).decoder);
      });
    });
    it('setEncoding should also update options.encoding', () => {
      ios.setEncoding('iso-8859-1');
      assert.equal(optionsService.options.encoding, 'iso-8859-1');
    });
    it('addEncoding should register custom encoding', () => {
      const FOO_ENCODING: IEncoding = {
        name: 'foo',
        aliases: ['foo1'],
        encoder: class { encode(data: string): Uint8Array { return new Uint8Array([1, 2, 3]); } },
        decoder: class { decode(data: Uint8Array, target: Uint32Array): number { return -25; } }
      };
      ios.addEncoding(FOO_ENCODING);
      ios.setEncoding('foo');
      assert.equal((ios as any)._encoder.constructor, FOO_ENCODING.encoder);
      assert.equal((ios as any)._decoder.constructor, FOO_ENCODING.decoder);
      ios.setEncoding('iso-8859-1');
      optionsService.setOption('encoding', 'foo1');
      assert.equal((ios as any)._encoder.constructor, FOO_ENCODING.encoder);
      assert.equal((ios as any)._decoder.constructor, FOO_ENCODING.decoder);
    });
  });
  describe('IO tests', () => {
    describe('input', () => {
      it('write with strings', done => {
        ios.write('test');
        ios.write('ümläutß and €');
        setTimeout(() => {
          assert.deepEqual(TERM_DATA, ['test', 'ümläutß and €']);
          done();
        });
      });
      it('write with bytes - should apply correct decoder', done => {
        DEFAULT_ENCODINGS.forEach(el => {
          ios.setEncoding(el.name);
          const encoder = new (getEncoding(el.name).encoder)();
          ios.write(encoder.encode('test'));
          ios.write(encoder.encode('ümläutß and €'));
        });
        setTimeout(() => {
          DEFAULT_ENCODINGS.forEach(el => {
            const expected = el.name === 'utf-8' ? ['test', 'ümläutß and €'] :
                             el.name === 'iso-8859-15' ? ['test', 'ümläutß and €'] :
                             el.name === 'iso-8859-1' ? ['test', 'ümläutß and ?'] :
                             el.name === 'windows-1252' ? ['test', 'ümläutß and €'] :
                             ['test', '?ml?ut? and ?'];
            assert.deepEqual([TERM_DATA.shift(), TERM_DATA.shift()], expected);
            if (TERM_DATA.length) {
              assert.equal(TERM_DATA.shift(), ''); // placeholder to trigger the decoder switch in IoService
            }
          });
          done();
        });
      });
      it('write callbacks - sync call after parsing', done => {
        ios.write('a', () => assert.deepEqual(TERM_DATA, ['a']));
        ios.write('b', () => assert.deepEqual(TERM_DATA, ['a', 'b']));
        ios.write('c');
        ios.write('d', () => assert.deepEqual(TERM_DATA, ['a', 'b', 'c', 'd']));
        ios.write(new Uint8Array([65, 66]), () => {
          assert.deepEqual(TERM_DATA, ['a', 'b', 'c', 'd', 'AB']);
          done();
        });
      });
      it('write - chunkify big data', done => {
        // string
        const stringData = 'A'.repeat(100000) + 'B'.repeat(100000) + 'C'.repeat(100000);
        ios.write(stringData, () => {
          assert.deepEqual(TERM_DATA.reduce((accu, el) => accu + el, ''), stringData);
          while (TERM_DATA.length) TERM_DATA.pop();
        });
        // bytes
        const byteData = new Uint8Array(300000);
        byteData.fill(65);
        for (let i = 100000; i < 200000; ++i) byteData[i] = 66;
        for (let i = 200000; i < 300000; ++i) byteData[i] = 67;
        ios.write(byteData, () => {
          assert.deepEqual(TERM_DATA.reduce((accu, el) => accu + el, ''), stringData);
          while (TERM_DATA.length) TERM_DATA.pop();
          done();
        });
      });
    });
    describe('output', () => {
      it('onStringData', () => {
        const sent: any[] = [];
        ios.onStringData(e => sent.push(e));
        ios.triggerStringDataEvent('test');
        ios.triggerStringDataEvent('ümläutß and €');
        assert.deepEqual(sent, ['test', 'ümläutß and €']);
      });
      it('onRawData', () => {
        const sent: any[] = [];
        ios.onRawData(e => sent.push(e));
        ios.triggerRawDataEvent('test');
        ios.triggerRawDataEvent('ümläutß and €');
        assert.deepEqual(sent, ['test', 'ümläutß and €']);
      });
      it('onData', () => {
        const sent: any[] = [];
        ios.onData(e => sent.push(Array.from(e)));
        ios.triggerDataEvent(new Uint8Array([65, 66]));
        ios.triggerDataEvent(new Uint8Array([67, 68]));
        assert.deepEqual(sent, [[65, 66], [67, 68]]);
      });
      it('triggerStringDataEvent + onData (UTF8)', () => {
        // same as Array.from(Buffer.from('ümläutß and €'))
        const sent: any[] = [];
        ios.onData(e => sent.push(Array.from(e)));
        ios.triggerStringDataEvent('test');
        ios.triggerStringDataEvent('ümläutß and €');
        assert.deepEqual(sent, [
          [116, 101, 115, 116],
          [195, 188, 109, 108, 195, 164, 117, 116, 195, 159, 32, 97, 110, 100, 32, 226, 130, 172]
        ]);
      });
      it('triggerRawDataEvent + onData (binary)', () => {
        // same as Array.from(Buffer.from('ümläutß and €', 'binary'))
        const sent: any[] = [];
        ios.onData(e => sent.push(Array.from(e)));
        ios.triggerRawDataEvent('test');
        ios.triggerRawDataEvent('ümläutß and €');
        assert.deepEqual(sent, [
          [116, 101, 115, 116],
          [252, 109, 108, 228, 117, 116, 223, 32, 97, 110, 100, 32, 172]
        ]);
      });
    });
    describe('full cycle tests', () => {
      // should not drop/alter any encodable character
      // test up to trademark sign ™ (8482) which is the highest supported codepoint in default encodings
      // test: encoded input bytes should cycle through write --> onData unchanged
      let inputString = '';
      for (let i = 0; i <= 8482; ++i) inputString += String.fromCharCode(i);
      DEFAULT_ENCODINGS.forEach(el => {
        it(el.name, done => {
          // encode DATA to bytes with the current encoding
          const input = (new (el.encoder)()).encode(inputString);

          // setup onData listener to do the final test
          ios.onData(e => {
            assert.deepEqual(Array.from(e), Array.from(input));
            done();
          });

          // do write/read cycle on IoService
          ios.setEncoding(el.name);
          // write input to service applying active decoder
          ios.write(input);
          setTimeout(() => {
            // TERM_DATA now contains JS string version of the input
            // (UTF32 --> string done by utf32ToString in parse)
            // write data back applying active encoder
            ios.triggerStringDataEvent(TERM_DATA[0]);
          });
        });
      });
    });
  });
});
