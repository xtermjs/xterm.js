import { assert } from 'chai';

import { LineData, CharData } from '../Types';
import { MockTerminal, MockBuffer } from '../utils/TestUtils.test';
import { CircularList } from '../common/CircularList';

import { ICharacterJoinerRegistry } from './Types';
import { CharacterJoinerRegistry } from './CharacterJoinerRegistry';

describe('CharacterJoinerRegistry', () => {
  let registry: ICharacterJoinerRegistry;

  beforeEach(() => {
    const terminal = new MockTerminal();
    terminal.cols = 16;
    terminal.buffer = new MockBuffer();
    const lines = new CircularList<LineData>(7);
    lines.set(0, lineData('a -> b -> c -> d'));
    lines.set(1, lineData('a -> b => c -> d'));
    lines.set(2, [...lineData('a -> b -', 0xFFFFFFFF), ...lineData('> c -> d', 0)]);
    lines.set(3, lineData('no joined ranges'));
    lines.set(4, []);
    lines.set(5, [...lineData('a', 0x11111111), ...lineData(' -> b -> c -> '), ...lineData('d', 0x22222222)]);
    lines.set(6, [
      ...lineData('wi'),
      [0, '￥', 2, '￥'.charCodeAt(0)],
      [0, '', 0, null],
      ...lineData('deemo'),
      [0, '\xf0\x9f\x98\x81', 1, 128513],
      [0, ' ', 1, ' '.charCodeAt(0)],
      ...lineData('jiabc')
    ]);
    (<MockBuffer>terminal.buffer).setLines(lines);
    terminal.buffer.ydisp = 0;
    registry = new CharacterJoinerRegistry(terminal);
  });

  it('has no joiners upon creation', () => {
    assert.deepEqual(registry.getJoinedCharacters(0), []);
  });

  it('returns ranges matched by the registered joiners', () => {
    registry.registerCharacterJoiner(substringJoiner('->'));
    assert.deepEqual(
      registry.getJoinedCharacters(0),
      [[2, 4], [7, 9], [12, 14]]
    );
  });

  it('processes the input using all provided joiners', () => {
    registry.registerCharacterJoiner(substringJoiner('->'));
    assert.deepEqual(
      registry.getJoinedCharacters(1),
      [[2, 4], [12, 14]]
    );

    registry.registerCharacterJoiner(substringJoiner('=>'));
    assert.deepEqual(
      registry.getJoinedCharacters(1),
      [[2, 4], [7, 9], [12, 14]]
    );
  });

  it('removes deregistered joiners from future calls', () => {
    const joiner1 = registry.registerCharacterJoiner(substringJoiner('->'));
    const joiner2 = registry.registerCharacterJoiner(substringJoiner('=>'));
    assert.deepEqual(
      registry.getJoinedCharacters(1),
      [[2, 4], [7, 9], [12, 14]]
    );

    registry.deregisterCharacterJoiner(joiner1);
    assert.deepEqual(
      registry.getJoinedCharacters(1),
      [[7, 9]]
    );

    registry.deregisterCharacterJoiner(joiner2);
    assert.deepEqual(
      registry.getJoinedCharacters(1),
      []
    );
  });

  it('doesn\'t process joins on differently-styled characters', () => {
    registry.registerCharacterJoiner(substringJoiner('->'));
    assert.deepEqual(
      registry.getJoinedCharacters(2),
      [[2, 4], [12, 14]]
    );
  });

  it('returns an empty list of ranges if there is nothing to be joined', () => {
    registry.registerCharacterJoiner(substringJoiner('->'));
    assert.deepEqual(
      registry.getJoinedCharacters(3),
      []
    );
  });

  it('returns an empty list of ranges if the line is empty', () => {
    registry.registerCharacterJoiner(substringJoiner('->'));
    assert.deepEqual(
      registry.getJoinedCharacters(4),
      []
    );
  });

  it('returns false when trying to deregister a joiner that does not exist', () => {
    registry.registerCharacterJoiner(substringJoiner('->'));
    assert.deepEqual(registry.deregisterCharacterJoiner(123), false);
    assert.deepEqual(
      registry.getJoinedCharacters(0),
      [[2, 4], [7, 9], [12, 14]]
    );
  });

  it('doesn\'t process same-styled ranges that only have one character', () => {
    registry.registerCharacterJoiner(substringJoiner('a'));
    registry.registerCharacterJoiner(substringJoiner('b'));
    registry.registerCharacterJoiner(substringJoiner('d'));
    assert.deepEqual(
      registry.getJoinedCharacters(5),
      [[5, 6]]
    );
  });

  it('handles ranges that extend all the way to the end of the line', () => {
    registry.registerCharacterJoiner(substringJoiner('-> d'));
    assert.deepEqual(
      registry.getJoinedCharacters(2),
      [[12, 16]]
    );
  });

  it('handles adjacent ranges', () => {
    registry.registerCharacterJoiner(substringJoiner('->'));
    registry.registerCharacterJoiner(substringJoiner('> c '));
    assert.deepEqual(
      registry.getJoinedCharacters(2),
      [[2, 4], [8, 12], [12, 14]]
    );
  });

  it('handles fullwidth characters in the middle of ranges', () => {
    registry.registerCharacterJoiner(substringJoiner('wi￥de'));
    assert.deepEqual(
      registry.getJoinedCharacters(6),
      [[0, 6]]
    );
  });

  it('handles fullwidth characters at the end of ranges', () => {
    registry.registerCharacterJoiner(substringJoiner('wi￥'));
    assert.deepEqual(
      registry.getJoinedCharacters(6),
      [[0, 4]]
    );
  });

  it('handles emojis in the middle of ranges', () => {
    registry.registerCharacterJoiner(substringJoiner('emo\xf0\x9f\x98\x81 ji'));
    assert.deepEqual(
      registry.getJoinedCharacters(6),
      [[6, 13]]
    );
  });

  it('handles emojis at the end of ranges', () => {
    registry.registerCharacterJoiner(substringJoiner('emo\xf0\x9f\x98\x81 '));
    assert.deepEqual(
      registry.getJoinedCharacters(6),
      [[6, 11]]
    );
  });

  it('handles ranges after wide and emoji characters', () => {
    registry.registerCharacterJoiner(substringJoiner('abc'));
    assert.deepEqual(
      registry.getJoinedCharacters(6),
      [[13, 16]]
    );
  });

  describe('range merging', () => {
    it('inserts a new range before the existing ones', () => {
      registry.registerCharacterJoiner(() => [[1, 2], [2, 3]]);
      registry.registerCharacterJoiner(() => [[0, 1]]);
      assert.deepEqual(
        registry.getJoinedCharacters(0),
        [[0, 1], [1, 2], [2, 3]]
      );
    });

    it('inserts in between two ranges', () => {
      registry.registerCharacterJoiner(() => [[0, 2], [4, 6]]);
      registry.registerCharacterJoiner(() => [[2, 4]]);
      assert.deepEqual(
        registry.getJoinedCharacters(0),
        [[0, 2], [2, 4], [4, 6]]
      );
    });

    it('inserts after the last range', () => {
      registry.registerCharacterJoiner(() => [[0, 2], [4, 6]]);
      registry.registerCharacterJoiner(() => [[6, 8]]);
      assert.deepEqual(
        registry.getJoinedCharacters(0),
        [[0, 2], [4, 6], [6, 8]]
      );
    });

    it('extends the beginning of a range', () => {
      registry.registerCharacterJoiner(() => [[0, 2], [4, 6]]);
      registry.registerCharacterJoiner(() => [[3, 5]]);
      assert.deepEqual(
        registry.getJoinedCharacters(0),
        [[0, 2], [3, 6]]
      );
    });

    it('extends the end of a range', () => {
      registry.registerCharacterJoiner(() => [[0, 2], [4, 6]]);
      registry.registerCharacterJoiner(() => [[1, 4]]);
      assert.deepEqual(
        registry.getJoinedCharacters(0),
        [[0, 4], [4, 6]]
      );
    });

    it('extends the last range', () => {
      registry.registerCharacterJoiner(() => [[0, 2], [4, 6]]);
      registry.registerCharacterJoiner(() => [[5, 7]]);
      assert.deepEqual(
        registry.getJoinedCharacters(0),
        [[0, 2], [4, 7]]
      );
    });

    it('connects two ranges', () => {
      registry.registerCharacterJoiner(() => [[0, 2], [4, 6]]);
      registry.registerCharacterJoiner(() => [[1, 5]]);
      assert.deepEqual(
        registry.getJoinedCharacters(0),
        [[0, 6]]
      );
    });

    it('connects more than two ranges', () => {
      registry.registerCharacterJoiner(() => [[0, 2], [4, 6], [8, 10], [12, 14]]);
      registry.registerCharacterJoiner(() => [[1, 10]]);
      assert.deepEqual(
        registry.getJoinedCharacters(0),
        [[0, 10], [12, 14]]
      );
    });
  });
});

function lineData(line: string, attr: number = 0): LineData {
  return line.split('').map<CharData>(char => [attr, char, 1, char.charCodeAt(0)]);
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
