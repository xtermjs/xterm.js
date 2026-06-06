/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { StringToUtf32, stringFromCodePoint, Utf8ToUtf32, utf32ToString } from './TextDecoder';


// convert UTF32 codepoints to string
function toString(data: Uint32Array, length: number): string {
  if ((String as any).fromCodePoint) {
    return (String as any).fromCodePoint.apply(null, data.subarray(0, length));
  }
  let result = '';
  for (let i = 0; i < length; ++i) {
    result += stringFromCodePoint(data[i]);
  }
  return result;
}

// convert "bytestring" (charCode 0-255) to bytes
function fromByteString(s: string): Uint8Array {
  const result = new Uint8Array(s.length);
  for (let i = 0; i < s.length; ++i) {
    result[i] = s.charCodeAt(i);
  }
  return result;
}

function stringToUtf8Bytes(s: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i);
    if (cp >= 0xD800 && cp <= 0xDBFF && i + 1 < s.length) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) {
        cp = 0x10000 + ((cp - 0xD800) << 10) + (next - 0xDC00);
        i++;
      }
    }
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
    } else if (cp < 0x10000) {
      bytes.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    } else {
      bytes.push(
        0xF0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3F),
        0x80 | ((cp >> 6) & 0x3F),
        0x80 | (cp & 0x3F)
      );
    }
  }
  return new Uint8Array(bytes);
}

function assertDecodedRange(
  min: number,
  max: number,
  skip: (codePoint: number) => boolean,
  buildChar: (codePoint: number) => string,
  decode: (input: string, target: Uint32Array) => number,
  outputToString: (data: Uint32Array, length: number) => string
): void {
  if (max <= min) {
    return;
  }
  let input = '';
  let count = 0;
  for (let i = min; i < max; ++i) {
    if (skip(i)) {
      continue;
    }
    input += buildChar(i);
    count++;
  }
  const target = new Uint32Array(count);
  const length = decode(input, target);
  assert.strictEqual(length, count);
  let mismatchIndex = -1;
  let index = 0;
  for (let i = min; i < max; ++i) {
    if (skip(i)) {
      continue;
    }
    if (target[index] !== i) {
      mismatchIndex = index;
      break;
    }
    index++;
  }
  assert.strictEqual(mismatchIndex, -1);
  assert.strictEqual(outputToString(target, length), input);
}

const BATCH_SIZE = 8192;

const TEST_STRINGS = [
  'Лорем ипсум долор сит амет, ех сеа аццусам диссентиет. Ан еос стет еирмод витуперата. Иус дицерет урбанитас ет. Ан при алтера долорес сплендиде, цу яуо интегре денияуе, игнота волуптариа инструцтиор цу вим.',
  'ლორემ იფსუმ დოლორ სით ამეთ, ფაცერ მუციუს ცონსეთეთურ ყუო იდ, ფერ ვივენდუმ ყუაერენდუმ ეა, ესთ ამეთ მოვეთ სუავითათე ცუ. ვითაე სენსიბუს ან ვიხ. ეხერცი დეთერრუისსეთ უთ ყუი. ვოცენთ დებითის ადიფისცი ეთ ფერ. ნეც ან ფეუგაით ფორენსიბუს ინთერესსეთ. იდ დიცო რიდენს იუს. დისსენთიეთ ცონსეყუუნთურ სედ ნე, ნოვუმ მუნერე ეუმ ათ, ნე ეუმ ნიჰილ ირაცუნდია ურბანითას.',
  'अधिकांश अमितकुमार प्रोत्साहित मुख्य जाने प्रसारन विश्लेषण विश्व दारी अनुवादक अधिकांश नवंबर विषय गटकउसि गोपनीयता विकास जनित परस्पर गटकउसि अन्तरराष्ट्रीयकरन होसके मानव पुर्णता कम्प्युटर यन्त्रालय प्रति साधन',
  '覧六子当聞社計文護行情投身斗来。増落世的況上席備界先関権能万。本物挙歯乳全事携供板栃果以。頭月患端撤競見界記引去法条公泊候。決海備駆取品目芸方用朝示上用報。講申務紙約週堂出応理田流団幸稿。起保帯吉対阜庭支肯豪彰属本躍。量抑熊事府募動極都掲仮読岸。自続工就断庫指北速配鳴約事新住米信中験。婚浜袋著金市生交保他取情距。',
  '八メル務問へふらく博辞説いわょ読全タヨムケ東校どっ知壁テケ禁去フミ人過を装5階がねぜ法逆はじ端40落ミ予竹マヘナセ任1悪た。省ぜりせ製暇ょへそけ風井イ劣手はぼまず郵富法く作断タオイ取座ゅょが出作ホシ月給26島ツチ皇面ユトクイ暮犯リワナヤ断連こうでつ蔭柔薄とレにの。演めけふぱ損田転10得観びトげぎ王物鉄夜がまけ理惜くち牡提づ車惑参ヘカユモ長臓超漫ぼドかわ。',
  '모든 국민은 행위시의 법률에 의하여 범죄를 구성하지 아니하는 행위로 소추되지 아니하며. 전직대통령의 신분과 예우에 관하여는 법률로 정한다, 국회는 헌법 또는 법률에 특별한 규정이 없는 한 재적의원 과반수의 출석과 출석의원 과반수의 찬성으로 의결한다. 군인·군무원·경찰공무원 기타 법률이 정하는 자가 전투·훈련등 직무집행과 관련하여 받은 손해에 대하여는 법률이 정하는 보상외에 국가 또는 공공단체에 공무원의 직무상 불법행위로 인한 배상은 청구할 수 없다.',
  'كان فشكّل الشرقي مع, واحدة للمجهود تزامناً بعض بل. وتم جنوب للصين غينيا لم, ان وبدون وكسبت الأمور ذلك, أسر الخاسر الانجليزية هو. نفس لغزو مواقعها هو. الجو علاقة الصعداء انه أي, كما مع بمباركة للإتحاد الوزراء. ترتيب الأولى أن حدى, الشتوية باستحداث مدن بل, كان قد أوسع عملية. الأوضاع بالمطالبة كل قام, دون إذ شمال الربيع،. هُزم الخاصّة ٣٠ أما, مايو الصينية مع قبل.',
  'או סדר החול מיזמי קרימינולוגיה. קהילה בגרסה לויקיפדים אל היא, של צעד ציור ואלקטרוניקה. מדע מה ברית המזנון ארכיאולוגיה, אל טבלאות מבוקשים כלל. מאמרשיחהצפה העריכהגירסאות שכל אל, כתב עיצוב מושגי של. קבלו קלאסיים ב מתן. נבחרים אווירונאוטיקה אם מלא, לוח למנוע ארכיאולוגיה מה. ארץ לערוך בקרבת מונחונים או, עזרה רקטות לויקיפדים אחר גם.',
  'Лорем ლორემ अधिकांश 覧六子 八メル 모든 בקרבת 💮 😂 äggg 123€ 𝄞.'
];

describe('text encodings', () => {
  it('stringFromCodePoint/utf32ToString', () => {
    const s = 'abcdefg';
    const data = new Uint32Array(s.length);
    for (let i = 0; i < s.length; ++i) {
      data[i] = s.charCodeAt(i);
      assert.strictEqual(stringFromCodePoint(data[i]), s[i]);
    }
    assert.strictEqual(utf32ToString(data), s);
  });

  describe('StringToUtf32 decoder', () => {
    describe('full codepoint test', () => {
      for (let min = 0; min < 65535; min += BATCH_SIZE) {
        const max = Math.min(min + BATCH_SIZE, 65536);
        it(`${formatRange(min, max)}`, () => {
          const decoder = new StringToUtf32();
          assertDecodedRange(
            min,
            max,
            (i) => (i >= 0xD800 && i <= 0xDFFF) || i === 0xFEFF,
            (i) => String.fromCharCode(i),
            (input, target) => decoder.decode(input, target),
            (data, length) => utf32ToString(data, 0, length)
          );
        });
      }
      for (let min = 65536; min < 0x10FFFF; min += BATCH_SIZE) {
        const max = Math.min(min + BATCH_SIZE, 0x10FFFF);
        it(`${formatRange(min, max)} (surrogates)`, () => {
          const decoder = new StringToUtf32();
          assertDecodedRange(
            min,
            max,
            () => false,
            (i) => {
              const codePoint = i - 0x10000;
              return String.fromCharCode((codePoint >> 10) + 0xD800, (codePoint % 0x400) + 0xDC00);
            },
            (input, target) => decoder.decode(input, target),
            (data, length) => utf32ToString(data, 0, length)
          );
        });
      }

      it('0xFEFF(BOM)', () => {
        const decoder = new StringToUtf32();
        const target = new Uint32Array(5);
        const length = decoder.decode(String.fromCharCode(0xFEFF), target);
        assert.strictEqual(length, 0);
        decoder.clear();
      });
    });

    it('test strings', () => {
      const decoder = new StringToUtf32();
      const target = new Uint32Array(500);
      for (let i = 0; i < TEST_STRINGS.length; ++i) {
        const length = decoder.decode(TEST_STRINGS[i], target);
        assert.strictEqual(toString(target, length), TEST_STRINGS[i]);
        decoder.clear();
      }
    });

    describe('stream handling', () => {
      it('surrogates mixed advance by 1', () => {
        const decoder = new StringToUtf32();
        const target = new Uint32Array(5);
        const input = 'Ä€𝄞Ö𝄞€Ü𝄞€';
        let decoded = '';
        for (let i = 0; i < input.length; ++i) {
          const written = decoder.decode(input[i], target);
          decoded += toString(target, written);
        }
        assert.strictEqual(decoded, 'Ä€𝄞Ö𝄞€Ü𝄞€');
      });
    });
  });

  describe('Utf8ToUtf32 decoder', () => {
    describe('full codepoint test', () => {
      for (let min = 0; min < 65535; min += BATCH_SIZE) {
        const max = Math.min(min + BATCH_SIZE, 65536);
        it(`${formatRange(min, max)} (1/2/3 byte sequences)`, () => {
          const decoder = new Utf8ToUtf32();
          assertDecodedRange(
            min,
            max,
            (i) => (i >= 0xD800 && i <= 0xDFFF) || i === 0xFEFF,
            (i) => String.fromCharCode(i),
            (input, target) => decoder.decode(stringToUtf8Bytes(input), target),
            (data, length) => toString(data, length)
          );
        });
      }
      for (let minRaw = 60000; minRaw < 0x10FFFF; minRaw += BATCH_SIZE) {
        const min = Math.max(minRaw, 65536);
        const max = Math.min(minRaw + BATCH_SIZE, 0x10FFFF);
        it(`${formatRange(min, max)} (4 byte sequences)`, function (): void {
          const decoder = new Utf8ToUtf32();
          assertDecodedRange(
            min,
            max,
            () => false,
            (i) => stringFromCodePoint(i),
            (input, target) => decoder.decode(stringToUtf8Bytes(input), target),
            (data, length) => toString(data, length)
          );
        });
      }

      it('0xFEFF(BOM)', () => {
        const decoder = new Utf8ToUtf32();
        const target = new Uint32Array(5);
        const utf8Data = stringToUtf8Bytes(String.fromCharCode(0xFEFF));
        const length = decoder.decode(utf8Data, target);
        assert.strictEqual(length, 0);
        decoder.clear();
      });
    });

    it('test strings', () => {
      const decoder = new Utf8ToUtf32();
      const target = new Uint32Array(500);
      for (let i = 0; i < TEST_STRINGS.length; ++i) {
        const utf8Data = stringToUtf8Bytes(TEST_STRINGS[i]);
        const length = decoder.decode(utf8Data, target);
        assert.strictEqual(toString(target, length), TEST_STRINGS[i]);
        decoder.clear();
      }
    });

    describe('stream handling', () => {
      it('2 byte sequences - advance by 1', () => {
        const decoder = new Utf8ToUtf32();
        const target = new Uint32Array(5);
        const utf8Data = fromByteString('\xc3\x84\xc3\x96\xc3\x9c\xc3\x9f\xc3\xb6\xc3\xa4\xc3\xbc');
        let decoded = '';
        for (let i = 0; i < utf8Data.length; ++i) {
          const written = decoder.decode(utf8Data.slice(i, i + 1), target);
          decoded += toString(target, written);
        }
        assert.strictEqual(decoded, 'ÄÖÜßöäü');
      });

      it('2/3 byte sequences - advance by 1', () => {
        const decoder = new Utf8ToUtf32();
        const target = new Uint32Array(5);
        const utf8Data = fromByteString('\xc3\x84\xe2\x82\xac\xc3\x96\xe2\x82\xac\xc3\x9c\xe2\x82\xac\xc3\x9f\xe2\x82\xac\xc3\xb6\xe2\x82\xac\xc3\xa4\xe2\x82\xac\xc3\xbc');
        let decoded = '';
        for (let i = 0; i < utf8Data.length; ++i) {
          const written = decoder.decode(utf8Data.slice(i, i + 1), target);
          decoded += toString(target, written);
        }
        assert.strictEqual(decoded, 'Ä€Ö€Ü€ß€ö€ä€ü');
      });

      it('2/3/4 byte sequences - advance by 1', () => {
        const decoder = new Utf8ToUtf32();
        const target = new Uint32Array(5);
        const utf8Data = fromByteString('\xc3\x84\xe2\x82\xac\xf0\x9d\x84\x9e\xc3\x96\xf0\x9d\x84\x9e\xe2\x82\xac\xc3\x9c\xf0\x9d\x84\x9e\xe2\x82\xac');
        let decoded = '';
        for (let i = 0; i < utf8Data.length; ++i) {
          const written = decoder.decode(utf8Data.slice(i, i + 1), target);
          decoded += toString(target, written);
        }
        assert.strictEqual(decoded, 'Ä€𝄞Ö𝄞€Ü𝄞€');
      });

      it('2/3/4 byte sequences - advance by 2', () => {
        const decoder = new Utf8ToUtf32();
        const target = new Uint32Array(5);
        const utf8Data = fromByteString('\xc3\x84\xe2\x82\xac\xf0\x9d\x84\x9e\xc3\x96\xf0\x9d\x84\x9e\xe2\x82\xac\xc3\x9c\xf0\x9d\x84\x9e\xe2\x82\xac');
        let decoded = '';
        for (let i = 0; i < utf8Data.length; i += 2) {
          const written = decoder.decode(utf8Data.slice(i, i + 2), target);
          decoded += toString(target, written);
        }
        assert.strictEqual(decoded, 'Ä€𝄞Ö𝄞€Ü𝄞€');
      });

      it('2/3/4 byte sequences - advance by 3', () => {
        const decoder = new Utf8ToUtf32();
        const target = new Uint32Array(5);
        const utf8Data = fromByteString('\xc3\x84\xe2\x82\xac\xf0\x9d\x84\x9e\xc3\x96\xf0\x9d\x84\x9e\xe2\x82\xac\xc3\x9c\xf0\x9d\x84\x9e\xe2\x82\xac');
        let decoded = '';
        for (let i = 0; i < utf8Data.length; i += 3) {
          const written = decoder.decode(utf8Data.slice(i, i + 3), target);
          decoded += toString(target, written);
        }
        assert.strictEqual(decoded, 'Ä€𝄞Ö𝄞€Ü𝄞€');
      });

      it('BOMs (3 byte sequences) - advance by 2', () => {
        const decoder = new Utf8ToUtf32();
        const target = new Uint32Array(5);
        const utf8Data = fromByteString('\xef\xbb\xbf\xef\xbb\xbf');
        let decoded = '';
        for (let i = 0; i < utf8Data.length; i += 2) {
          const written = decoder.decode(utf8Data.slice(i, i + 2), target);
          decoded += toString(target, written);
        }
        assert.strictEqual(decoded, '');
      });

      it('test break after 3 bytes - issue #2495', () => {
        const decoder = new Utf8ToUtf32();
        const target = new Uint32Array(5);
        const utf8Data = fromByteString('\xf0\xa0\x9c\x8e');
        let written = decoder.decode(utf8Data.slice(0, 3), target);
        assert.strictEqual(written, 0);
        written = decoder.decode(utf8Data.slice(3), target);
        assert.strictEqual(written, 1);
        assert.strictEqual(toString(target, written), '𠜎');
      });

      describe('0x80 not swallowed in continuation', () => {
        it('A—B', () => {
          const decoder = new Utf8ToUtf32();
          const target = new Uint32Array(5);
          const utf8Data = new TextEncoder().encode('A—BA—BA—BA—BA—B');
          let decoded = '';
          for (let i = 0; i < utf8Data.length; i += 2) {
            const written = decoder.decode(utf8Data.slice(i, i + 2), target);
            decoded += toString(target, written);
          }
          assert.strictEqual(decoded, 'A—BA—BA—BA—BA—B');
        });
        it('A𐀀B', () => {
          const decoder = new Utf8ToUtf32();
          const target = new Uint32Array(5);
          const utf8Data = new TextEncoder().encode('A𐀀BA𐀀BA𐀀BA𐀀BA𐀀B');
          let decoded = '';
          for (let i = 0; i < utf8Data.length; i += 2) {
            const written = decoder.decode(utf8Data.slice(i, i + 2), target);
            decoded += toString(target, written);
          }
          assert.strictEqual(decoded, 'A𐀀BA𐀀BA𐀀BA𐀀BA𐀀B');
        });
      });

    });
  });
});

function formatRange(min: number, max: number): string {
  return `${min}..${max} (0x${min.toString(16).toUpperCase()}..0x${max.toString(16).toUpperCase()})`;
}
