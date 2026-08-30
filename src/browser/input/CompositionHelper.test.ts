/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { CompositionHelper } from './CompositionHelper';
import { MockRenderService } from '../TestUtils.test';
import { MockCoreService, MockBufferService, MockOptionsService } from '../../common/TestUtils.test';

describe('CompositionHelper', () => {
  let compositionHelper: CompositionHelper;
  let compositionView: HTMLElement;
  let textarea: HTMLTextAreaElement;
  let handledText: string;

  function nextEventLoop(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  async function beginComposition(data: string, value: string = textarea.value + data): Promise<void> {
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;
    compositionHelper.compositionstart();
    compositionHelper.compositionupdate({ data });
    textarea.value = value;
    textarea.selectionStart = value.length;
    textarea.selectionEnd = value.length;
    await nextEventLoop();
  }

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

    it('should send a propagated composition commit exactly once', async () => {
      await beginComposition('한');

      compositionHelper.compositionend();
      assert.isTrue(compositionHelper.input('한'));
      await nextEventLoop();

      assert.equal(handledText, '한');
    });

    it('should send an unpropagated composition commit exactly once', async () => {
      await beginComposition('한');

      compositionHelper.compositionend();
      await nextEventLoop();

      assert.equal(handledText, '한');
    });

    it('should send a pending commit before a following key', async () => {
      await beginComposition('한');
      compositionHelper.compositionend();
      compositionHelper.input('한');
      textarea.value = '';

      assert.isTrue(compositionHelper.keydown({ keyCode: 65 } as KeyboardEvent));
      assert.equal(handledText, '한');
      await nextEventLoop();
      assert.equal(handledText, '한');
    });

    it('should preserve Hangul, ASCII, Hangul input order', async () => {
      await beginComposition('한');
      compositionHelper.compositionend();
      compositionHelper.input('한');
      compositionHelper.keypress('a');
      compositionHelper.input('a');
      textarea.value = '한a';

      await beginComposition('글');
      compositionHelper.compositionend();
      compositionHelper.input('글');
      await nextEventLoop();

      assert.equal(handledText, '한a글');
    });

    it('should preserve following input when the composition has no insertText event', async () => {
      await beginComposition('日');
      compositionHelper.compositionend();
      compositionHelper.keypress('a');
      compositionHelper.input('a');
      textarea.value = '日a';
      await nextEventLoop();

      assert.equal(handledText, '日a');
    });

    it('should preserve fast consecutive Hangul syllables', async () => {
      await beginComposition('한');
      compositionHelper.compositionend();
      compositionHelper.input('한');

      await beginComposition('글');
      compositionHelper.compositionend();
      compositionHelper.input('글');
      await nextEventLoop();

      assert.equal(handledText, '한글');
    });

    it('should leave a transferred final consonant for the next Hangul composition', async () => {
      await beginComposition('텟');
      compositionHelper.compositionend();
      compositionHelper.input('테');
      compositionHelper.keypress('t');
      textarea.value = '테';

      await beginComposition('스');
      compositionHelper.compositionend();
      compositionHelper.input('스');
      await nextEventLoop();

      assert.equal(handledText, '테스');
    });

    it('should send a composition once when Enter finalizes it before compositionend', async () => {
      await beginComposition('한');

      assert.isTrue(compositionHelper.keydown({ keyCode: 13 } as KeyboardEvent));
      compositionHelper.compositionend();
      compositionHelper.input('한');
      await nextEventLoop();

      assert.equal(handledText, '한');
    });

    it('should send a cleared pending commit before Enter', async () => {
      await beginComposition('한');
      compositionHelper.compositionend();
      compositionHelper.input('한');
      textarea.value = '';

      assert.isTrue(compositionHelper.keydown({ keyCode: 13 } as KeyboardEvent));
      await nextEventLoop();

      assert.equal(handledText, '한');
    });

    it('should not repeat a keydown-finalized Japanese commit', async () => {
      await beginComposition('日本');

      assert.isTrue(compositionHelper.keydown({ keyCode: 65 } as KeyboardEvent));
      compositionHelper.compositionend();
      compositionHelper.input('日本');
      await nextEventLoop();

      assert.equal(handledText, '日本');
    });

    it('should reconcile duplicate keypress and input observations', async () => {
      await beginComposition('한');
      compositionHelper.compositionend();
      compositionHelper.keypress('한');
      compositionHelper.input('한');
      await nextEventLoop();

      assert.equal(handledText, '한');
    });

    it('should preserve repeated identical commits from separate compositions', async () => {
      await beginComposition('한');
      compositionHelper.compositionend();
      compositionHelper.input('한');
      await nextEventLoop();

      await beginComposition('한');
      compositionHelper.compositionend();
      compositionHelper.input('한');
      await nextEventLoop();

      assert.equal(handledText, '한한');
    });

    it('should reconcile generic multi-character IME commits', async () => {
      await beginComposition('日本');
      compositionHelper.compositionend();
      compositionHelper.keypress('日本');
      compositionHelper.input('日本');
      await nextEventLoop();

      assert.equal(handledText, '日本');
    });
  });
});
