/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { CompositionHelper } from 'browser/input/CompositionHelper';
import { MockRenderService } from 'browser/TestUtils.test';
import { C0 } from 'common/data/EscapeSequences';
import { MockCoreService, MockBufferService, MockOptionsService } from 'common/TestUtils.test';

describe('CompositionHelper', () => {
  let compositionHelper: CompositionHelper;
  let compositionView: HTMLElement;
  let textarea: HTMLTextAreaElement;
  let handledText: string;
  const nextTick = (callback: () => void): void => {
    setTimeout(callback, 0);
  };
  const keydown229 = (key: string): boolean => compositionHelper.keydown({ keyCode: 229, key } as KeyboardEvent);
  const keyup229 = (key: string): void => compositionHelper.keyup({ keyCode: 229, key } as KeyboardEvent);
  const startPending229 = (oldValue: string, key = 'x'): void => {
    textarea.value = oldValue;
    assert.equal(keydown229(key), false);
  };
  const applyPending229Change = (oldValue: string, newValue: string, key = 'x'): void => {
    startPending229(oldValue, key);
    textarea.value = newValue;
    keyup229(key);
  };

  beforeEach(() => {
    compositionView = {
      classList: {
        add: () => {},
        remove: () => {}
      },
      getBoundingClientRect: () => {
        return { width: 0 };
      },
      style: {
        left: 0,
        top: 0
      },
      textContent: ''
    } as any;
    textarea = {
      value: '',
      style: {
        left: 0,
        top: 0
      }
    } as any;
    const coreService = new MockCoreService();
    coreService.triggerDataEvent = (text: string) => {
      handledText += text;
    };
    handledText = '';
    const bufferService = new MockBufferService(10, 5);
    compositionHelper = new CompositionHelper(textarea, compositionView, bufferService, new MockOptionsService(), coreService, new MockRenderService());
  });

  describe('Input', () => {
    it('Should insert simple characters', (done) => {
      // First character 'ㅇ'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'ㅇ' });
      textarea.value = 'ㅇ';
      setTimeout(() => { // wait for any textarea updates
        compositionHelper.compositionend();
        setTimeout(() => { // wait for any textarea updates
          assert.equal(handledText, 'ㅇ');
          // Second character 'ㅇ'
          compositionHelper.compositionstart();
          compositionHelper.compositionupdate({ data: 'ㅇ' });
          textarea.value = 'ㅇㅇ';
          setTimeout(() => { // wait for any textarea updates
            compositionHelper.compositionend();
            setTimeout(() => { // wait for any textarea updates
              assert.equal(handledText, 'ㅇㅇ');
              done();
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert complex characters', (done) => {
      // First character '앙'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'ㅇ' });
      textarea.value = 'ㅇ';
      setTimeout(() => { // wait for any textarea updates
        compositionHelper.compositionupdate({ data: '아' });
        textarea.value = '아';
        setTimeout(() => { // wait for any textarea updates
          compositionHelper.compositionupdate({ data: '앙' });
          textarea.value = '앙';
          setTimeout(() => { // wait for any textarea updates
            compositionHelper.compositionend();
            setTimeout(() => { // wait for any textarea updates
              assert.equal(handledText, '앙');
              // Second character '앙'
              compositionHelper.compositionstart();
              compositionHelper.compositionupdate({ data: 'ㅇ' });
              textarea.value = '앙ㅇ';
              setTimeout(() => { // wait for any textarea updates
                compositionHelper.compositionupdate({ data: '아' });
                textarea.value = '앙아';
                setTimeout(() => { // wait for any textarea updates
                  compositionHelper.compositionupdate({ data: '앙' });
                  textarea.value = '앙앙';
                  setTimeout(() => { // wait for any textarea updates
                    compositionHelper.compositionend();
                    setTimeout(() => { // wait for any textarea updates
                      assert.equal(handledText, '앙앙');
                      done();
                    }, 0);
                  }, 0);
                }, 0);
              }, 0);
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert complex characters that change with following character', (done) => {
      // First character '아'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'ㅇ' });
      textarea.value = 'ㅇ';
      setTimeout(() => { // wait for any textarea updates
        compositionHelper.compositionupdate({ data: '아' });
        textarea.value = '아';
        setTimeout(() => { // wait for any textarea updates
          // Start second character '아' in first character
          compositionHelper.compositionupdate({ data: '앙' });
          textarea.value = '앙';
          setTimeout(() => { // wait for any textarea updates
            compositionHelper.compositionend();
            compositionHelper.compositionstart();
            compositionHelper.compositionupdate({ data: '아' });
            textarea.value = '아아';
            setTimeout(() => { // wait for any textarea updates
              compositionHelper.compositionend();
              setTimeout(() => { // wait for any textarea updates
                assert.equal(handledText, '아아');
                done();
              }, 0);
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert multi-characters compositions', (done) => {
      // First character 'だ'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'd' });
      textarea.value = 'd';
      setTimeout(() => { // wait for any textarea updates
        compositionHelper.compositionupdate({ data: 'だ' });
        textarea.value = 'だ';
        setTimeout(() => { // wait for any textarea updates
          // Second character 'あ'
          compositionHelper.compositionupdate({ data: 'だあ' });
          textarea.value = 'だあ';
          setTimeout(() => { // wait for any textarea updates
            compositionHelper.compositionend();
            setTimeout(() => { // wait for any textarea updates
              assert.equal(handledText, 'だあ');
              done();
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert multi-character compositions that are converted to other characters with the same length', (done) => {
      // First character 'だ'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'd' });
      textarea.value = 'd';
      setTimeout(() => { // wait for any textarea updates
        compositionHelper.compositionupdate({ data: 'だ' });
        textarea.value = 'だ';
        setTimeout(() => { // wait for any textarea updates
          // Second character 'ー'
          compositionHelper.compositionupdate({ data: 'だー' });
          textarea.value = 'だー';
          setTimeout(() => { // wait for any textarea updates
            // Convert to katakana 'ダー'
            compositionHelper.compositionupdate({ data: 'ダー' });
            textarea.value = 'ダー';
            setTimeout(() => { // wait for any textarea updates
              compositionHelper.compositionend();
              setTimeout(() => { // wait for any textarea updates
                assert.equal(handledText, 'ダー');
                done();
              }, 0);
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert multi-character compositions that are converted to other characters with different lengths', (done) => {
      // First character 'い'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'い' });
      textarea.value = 'い';
      setTimeout(() => { // wait for any textarea updates
        // Second character 'ま'
        compositionHelper.compositionupdate({ data: 'いm' });
        textarea.value = 'いm';
        setTimeout(() => { // wait for any textarea updates
          compositionHelper.compositionupdate({ data: 'いま' });
          textarea.value = 'いま';
          setTimeout(() => { // wait for any textarea updates
            // Convert to kanji '今'
            compositionHelper.compositionupdate({ data: '今' });
            textarea.value = '今';
            setTimeout(() => { // wait for any textarea updates
              compositionHelper.compositionend();
              setTimeout(() => { // wait for any textarea updates
                assert.equal(handledText, '今');
                done();
              }, 0);
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert non-composition characters input immediately after composition characters', (done) => {
      // First character 'ㅇ'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'ㅇ' });
      textarea.value = 'ㅇ';
      setTimeout(() => { // wait for any textarea updates
        compositionHelper.compositionend();
        // Second character '1' (a non-composition character)
        textarea.value = 'ㅇ1';
        setTimeout(() => { // wait for any textarea updates
          assert.equal(handledText, 'ㅇ1');
          done();
        }, 0);
      }, 0);
    });

    it('Should insert middle composition and subsequent input without appending existing trailing text', (done) => {
      textarea.value = '一二';
      // screenReaderMode keeps textarea content/selection for assistive technologies (eg. screen
      // readers), so the caret can be moved within the textarea (eg. via arrow keys) before
      // starting composition.
      textarea.selectionStart = 1;
      textarea.selectionEnd = 1;

      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: '一' });
      textarea.value = '一一二';
      // After the composed text is inserted, the caret typically moves to after it.
      textarea.selectionStart = 2;
      textarea.selectionEnd = 2;

      setTimeout(() => { // wait for any textarea updates
        compositionHelper.compositionend();
        // Second character '1' (a non-composition character)
        textarea.value = '一一1二';
        setTimeout(() => { // wait for any textarea updates
          assert.equal(handledText, '一1');
          done();
        }, 0);
      }, 0);
    });

    it('Should handle keyCode 229 on keyup when key matches', () => {
      textarea.value = '';
      assert.equal(keydown229('。'), false);
      textarea.value = '。';

      keyup229('。');

      assert.equal(handledText, '。');
    });

    it('Should allow keyup with a different key value and still emit from keydown path', (done) => {
      textarea.value = '';
      assert.equal(keydown229('。'), false);
      textarea.value = '。';

      keyup229('x');

      nextTick(() => {
        assert.equal(handledText, '。');
        done();
      });
    });

    it('Should emit precise DEL+insert on keyup for equal-length replacements in pending keyCode 229 path', (done) => {
      applyPending229Change('ab', 'ac');

      assert.equal(handledText, `${C0.DEL}c`);
      nextTick(() => {
        done();
      });
    });

    it('Should emit precise DEL+insert on timer for equal-length replacements in pending keyCode 229 path', (done) => {
      startPending229('ab');
      textarea.value = 'ac';

      nextTick(() => {
        assert.equal(handledText, `${C0.DEL}c`);
        done();
      });
    });

    it('Should emit prefix-based DEL+insert for mid-string replacement', () => {
      applyPending229Change('abcde', 'abXYde');

      assert.equal(handledText, `${C0.DEL.repeat(3)}XYde`);
    });

    it('Should emit only inserted text for append-only changes', () => {
      applyPending229Change('ab', 'abXYZ');

      assert.equal(handledText, 'XYZ');
    });

    it('Should emit single DEL and cache new value on shrink', () => {
      applyPending229Change('abc', 'a');

      assert.equal(handledText, `${C0.DEL}`);
      assert.equal((compositionHelper as any)._dataAlreadySent, 'a');
    });

    it('Should not emit when baseline and textarea value are unchanged', (done) => {
      applyPending229Change('same', 'same');
      assert.equal(handledText, '');
      nextTick(() => {
        assert.equal(handledText, '');
        done();
      });
    });

    it('Should emit pending keyCode 229 data from earliest baseline', (done) => {
      textarea.value = 'x';
      assert.equal(keydown229('。'), false);
      textarea.value = 'xy';
      assert.equal(keydown229('，'), false);
      textarea.value = 'xy，';

      keyup229('，');

      nextTick(() => {
        assert.equal(handledText, 'y，');
        done();
      });
    });

    it('Should create only one timer for repeated keyCode 229 keydown', () => {
      const originalSetTimeout = globalThis.setTimeout;
      let scheduled = 0;
      (globalThis as any).setTimeout = () => {
        scheduled++;
        return 1;
      };
      try {
        textarea.value = '';
        assert.equal(keydown229('。'), false);
        assert.equal(keydown229('，'), false);
        assert.equal(keydown229('！'), false);
        assert.equal(scheduled, 1);
      } finally {
        (globalThis as any).setTimeout = originalSetTimeout;
      }
    });

    it('Should start a timer when keyCode 229 baseline exists but timer is missing', (done) => {
      textarea.value = 'x';
      assert.equal(keydown229('。'), false);

      nextTick(() => {
        assert.equal((compositionHelper as any)._pending229Baseline, 'x');
        assert.equal((compositionHelper as any)._textareaChangeTimer, undefined);
        assert.equal((compositionHelper as any)._pending229TimerFired, true);

        assert.equal(keydown229('，'), false);
        assert.notEqual((compositionHelper as any)._textareaChangeTimer, undefined);
        assert.equal((compositionHelper as any)._pending229TimerFired, false);

        keyup229('，');
        nextTick(() => {
          assert.equal((compositionHelper as any)._pending229Baseline, undefined);
          done();
        });
      });
    });

    it('Should clear pending baseline after timer and keyup fire without data', (done) => {
      textarea.value = 'x';
      assert.equal(keydown229('。'), false);

      nextTick(() => {
        keyup229('。');
        textarea.value = 'xyz';
        assert.equal(keydown229('，'), false);
        textarea.value = 'xyz，';
        keyup229('，');

        assert.equal(handledText, '，');
        done();
      });
    });

    it('Should allow keyup fallback when keydown 229 key is non-printable', (done) => {
      textarea.value = '';
      assert.equal(keydown229('Process'), false);

      nextTick(() => {
        textarea.value = '。';
        keyup229('Unidentified');
        assert.equal(handledText, '。');
        done();
      });
    });

    it('Should not emit pending keyCode 229 data after compositionstart', (done) => {
      textarea.value = '';
      assert.equal(keydown229('。'), false);
      textarea.value = '。';

      compositionHelper.compositionstart();

      nextTick(() => {
        assert.equal(handledText, '');
        done();
      });
    });

    it('Should cancel pending keyCode 229 keydown send on compositionend finalize after composition data is sent', (done) => {
      textarea.value = '';
      assert.equal(keydown229('。'), false);
      nextTick(() => {
        compositionHelper.compositionstart();
        compositionHelper.compositionupdate({ data: 'x' });
        textarea.value = 'x';
        compositionHelper.compositionend();

        nextTick(() => {
          assert.equal(handledText, 'x');
          assert.equal((compositionHelper as any)._pending229Baseline, undefined);
          keyup229('。');
          assert.equal(handledText, 'x');
          done();
        });
      });
    });

    it('Should keep pending keyCode 229 keydown send on compositionend finalize when no composition data is sent', (done) => {
      textarea.value = '';
      assert.equal(keydown229('。'), false);
      nextTick(() => {
        compositionHelper.compositionstart();
        compositionHelper.compositionupdate({ data: 'x' });
        compositionHelper.compositionend();

        nextTick(() => {
          assert.equal(handledText, '');
          assert.equal((compositionHelper as any)._pending229Baseline, '');
          textarea.value = '。';
          keyup229('。');
          assert.equal(handledText, '。');
          done();
        });
      });
    });
  });
});
