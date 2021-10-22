/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { ICharacterJoinerService } from 'browser/services/Services';
import { CharacterJoinerService } from 'browser/services/CharacterJoinerService';
import { BufferLine } from 'common/buffer/BufferLine';
import { IBufferLine } from 'common/Types';
import { CellData } from 'common/buffer/CellData';
import { MockBufferService } from 'common/TestUtils.test';

describe('CharacterJoinerService', () => {
  let service: ICharacterJoinerService;

  beforeEach(() => {
    const bufferService = new MockBufferService(16, 10);
    const lines = bufferService.buffer.lines;
    lines.set(0, lineData([['a -> b -> c -> d']]));
    lines.set(1, lineData([['a -> b => c -> d']]));
    lines.set(2, lineData([['a -> b -', 0xFFFFFFFF], ['> c -> d', 0]]));

    lines.set(3, lineData([['no joined ranges']]));
    lines.set(4, new BufferLine(0));
    lines.set(5, lineData([['a', 0x11111111], [' -> b -> c -> '], ['d', 0x22222222]]));
    const line6 = lineData([['wi']]);
    line6.resize(line6.length + 1, CellData.fromCharData([0, '￥', 2, '￥'.charCodeAt(0)]));
    line6.resize(line6.length + 1, CellData.fromCharData([0, '', 0, 0]));
    let sub = lineData([['deemo']]);
    let oldSize = line6.length;
    line6.resize(oldSize + sub.length, CellData.fromCharData([0, '', 0, 0]));
    for (let i = 0; i < sub.length; ++i) line6.setCell(i + oldSize, sub.loadCell(i, new CellData()));
    line6.resize(line6.length + 1, CellData.fromCharData([0, '\xf0\x9f\x98\x81', 1, 128513]));
    line6.resize(line6.length + 1, CellData.fromCharData([0, ' ', 1, ' '.charCodeAt(0)]));
    sub = lineData([['jiabc']]);
    oldSize = line6.length;
    line6.resize(oldSize + sub.length, CellData.fromCharData([0, '', 0, 0]));
    for (let i = 0; i < sub.length; ++i) line6.setCell(i + oldSize, sub.loadCell(i, new CellData()));
    lines.set(6, line6);

    service = new CharacterJoinerService(bufferService);
  });

  it('has no joiners upon creation', () => {
    assert.deepEqual(service.getJoinedCharacters(0), []);
  });

  it('returns ranges matched by the registered joiners', () => {
    service.register(substringJoiner('->'));
    assert.deepEqual(
      service.getJoinedCharacters(0),
      [[2, 4], [7, 9], [12, 14]]
    );
  });

  it('processes the input using all provided joiners', () => {
    service.register(substringJoiner('->'));
    assert.deepEqual(
      service.getJoinedCharacters(1),
      [[2, 4], [12, 14]]
    );

    service.register(substringJoiner('=>'));
    assert.deepEqual(
      service.getJoinedCharacters(1),
      [[2, 4], [7, 9], [12, 14]]
    );
  });

  it('removes deregistered joiners from future calls', () => {
    const joiner1 = service.register(substringJoiner('->'));
    const joiner2 = service.register(substringJoiner('=>'));
    assert.deepEqual(
      service.getJoinedCharacters(1),
      [[2, 4], [7, 9], [12, 14]]
    );

    service.deregister(joiner1);
    assert.deepEqual(
      service.getJoinedCharacters(1),
      [[7, 9]]
    );

    service.deregister(joiner2);
    assert.deepEqual(
      service.getJoinedCharacters(1),
      []
    );
  });

  it('doesn\'t process joins on differently-styled characters', () => {
    service.register(substringJoiner('->'));
    assert.deepEqual(
      service.getJoinedCharacters(2),
      [[2, 4], [12, 14]]
    );
  });

  it('returns an empty list of ranges if there is nothing to be joined', () => {
    service.register(substringJoiner('->'));
    assert.deepEqual(
      service.getJoinedCharacters(3),
      []
    );
  });

  it('returns an empty list of ranges if the line is empty', () => {
    service.register(substringJoiner('->'));
    assert.deepEqual(
      service.getJoinedCharacters(4),
      []
    );
  });

  it('returns false when trying to deregister a joiner that does not exist', () => {
    service.register(substringJoiner('->'));
    assert.deepEqual(service.deregister(123), false);
    assert.deepEqual(
      service.getJoinedCharacters(0),
      [[2, 4], [7, 9], [12, 14]]
    );
  });

  it('doesn\'t process same-styled ranges that only have one character', () => {
    service.register(substringJoiner('a'));
    service.register(substringJoiner('b'));
    service.register(substringJoiner('d'));
    assert.deepEqual(
      service.getJoinedCharacters(5),
      [[5, 6]]
    );
  });

  it('handles ranges that extend all the way to the end of the line', () => {
    service.register(substringJoiner('-> d'));
    assert.deepEqual(
      service.getJoinedCharacters(2),
      [[12, 16]]
    );
  });

  it('handles adjacent ranges', () => {
    service.register(substringJoiner('->'));
    service.register(substringJoiner('> c '));
    assert.deepEqual(
      service.getJoinedCharacters(2),
      [[2, 4], [8, 12], [12, 14]]
    );
  });

  it('handles fullwidth characters in the middle of ranges', () => {
    service.register(substringJoiner('wi￥de'));
    assert.deepEqual(
      service.getJoinedCharacters(6),
      [[0, 6]]
    );
  });

  it('handles fullwidth characters at the end of ranges', () => {
    service.register(substringJoiner('wi￥'));
    assert.deepEqual(
      service.getJoinedCharacters(6),
      [[0, 4]]
    );
  });

  it('handles emojis in the middle of ranges', () => {
    service.register(substringJoiner('emo\xf0\x9f\x98\x81 ji'));
    assert.deepEqual(
      service.getJoinedCharacters(6),
      [[6, 13]]
    );
  });

  it('handles emojis at the end of ranges', () => {
    service.register(substringJoiner('emo\xf0\x9f\x98\x81 '));
    assert.deepEqual(
      service.getJoinedCharacters(6),
      [[6, 11]]
    );
  });

  it('handles ranges after wide and emoji characters', () => {
    service.register(substringJoiner('abc'));
    assert.deepEqual(
      service.getJoinedCharacters(6),
      [[13, 16]]
    );
  });

  describe('range merging', () => {
    it('inserts a new range before the existing ones', () => {
      service.register(() => [[1, 2], [2, 3]]);
      service.register(() => [[0, 1]]);
      assert.deepEqual(
        service.getJoinedCharacters(0),
        [[0, 1], [1, 2], [2, 3]]
      );
    });

    it('inserts in between two ranges', () => {
      service.register(() => [[0, 2], [4, 6]]);
      service.register(() => [[2, 4]]);
      assert.deepEqual(
        service.getJoinedCharacters(0),
        [[0, 2], [2, 4], [4, 6]]
      );
    });

    it('inserts after the last range', () => {
      service.register(() => [[0, 2], [4, 6]]);
      service.register(() => [[6, 8]]);
      assert.deepEqual(
        service.getJoinedCharacters(0),
        [[0, 2], [4, 6], [6, 8]]
      );
    });

    it('extends the beginning of a range', () => {
      service.register(() => [[0, 2], [4, 6]]);
      service.register(() => [[3, 5]]);
      assert.deepEqual(
        service.getJoinedCharacters(0),
        [[0, 2], [3, 6]]
      );
    });

    it('extends the end of a range', () => {
      service.register(() => [[0, 2], [4, 6]]);
      service.register(() => [[1, 4]]);
      assert.deepEqual(
        service.getJoinedCharacters(0),
        [[0, 4], [4, 6]]
      );
    });

    it('extends the last range', () => {
      service.register(() => [[0, 2], [4, 6]]);
      service.register(() => [[5, 7]]);
      assert.deepEqual(
        service.getJoinedCharacters(0),
        [[0, 2], [4, 7]]
      );
    });

    it('connects two ranges', () => {
      service.register(() => [[0, 2], [4, 6]]);
      service.register(() => [[1, 5]]);
      assert.deepEqual(
        service.getJoinedCharacters(0),
        [[0, 6]]
      );
    });

    it('connects more than two ranges', () => {
      service.register(() => [[0, 2], [4, 6], [8, 10], [12, 14]]);
      service.register(() => [[1, 10]]);
      assert.deepEqual(
        service.getJoinedCharacters(0),
        [[0, 10], [12, 14]]
      );
    });
  });
});

type IPartialLineData = ([string] | [string, number]);

function lineData(data: IPartialLineData[]): IBufferLine {
  const tline = new BufferLine(0);
  for (let i = 0; i < data.length; ++i) {
    const line = data[i][0];
    const attr = (data[i][1] || 0) as number;
    const offset = tline.length;
    tline.resize(tline.length + line.split('').length, CellData.fromCharData([0, '', 0, 0]));
    line.split('').map((char, idx) => tline.setCell(idx + offset, CellData.fromCharData([attr, char, 1, char.charCodeAt(0)])));
  }
  return tline;
}

function substringJoiner(substring: string): (sequence: string) => [number, number][] {
  return (sequence: string): [number, number][] => {
    const ranges: [number, number][] = [];
    let searchIndex = 0;
    let matchIndex = -1;

    while ((matchIndex = sequence.indexOf(substring, searchIndex)) !== -1) {
      const matchEndIndex = matchIndex + substring.length;
      searchIndex = matchEndIndex;
      ranges.push([matchIndex, matchEndIndex]);
    }

    return ranges;
  };
}
