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
      selectionStart: 0,
      selectionEnd: 0,
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
    const keydown = () => compositionHelper.keydown({ keyCode: 229 } as KeyboardEvent);
    const waitForTextareaChange = () => new Promise<void>(resolve => setTimeout(resolve, 0));
    const withWindow = async (callback: () => Promise<void>): Promise<void> => {
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = globalThis;
      try {
        await callback();
      } finally {
        if (originalWindow === undefined) {
          delete (globalThis as any).window;
        } else {
          (globalThis as any).window = originalWindow;
        }
      }
    };

    it('Should delete a fully selected textarea value before inserting its replacement', async () => {
      await withWindow(async () => {
        keydown();
        textarea.value = 'action';
        await waitForTextareaChange();

        textarea.selectionStart = 0;
        textarea.selectionEnd = textarea.value.length;
        keydown();
        textarea.value = '';
        await waitForTextareaChange();

        keydown();
        textarea.value = 'Anton ';
        await waitForTextareaChange();

        assert.equal(handledText, `action${'\x7f'.repeat('action'.length)}Anton `);
      });
    });

    it('Should replace a selected tail when deletion and insertion share a 229 timer', async () => {
      await withWindow(async () => {
        keydown();
        textarea.value = 'activation';
        await waitForTextareaChange();

        textarea.selectionStart = 0;
        textarea.selectionEnd = textarea.value.length;
        keydown();
        textarea.value = '';
        keydown();
        textarea.value = 'Activision ';
        await waitForTextareaChange();

        assert.equal(handledText, `activation${'\x7f'.repeat('activation'.length)}Activision `);
      });
    });

    it('Should count removed Unicode code points when deleting a textarea suffix', async () => {
      await withWindow(async () => {
        keydown();
        textarea.value = 'a😀x';
        await waitForTextareaChange();

        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
        keydown();
        textarea.value = 'a';
        await waitForTextareaChange();

        assert.equal(handledText, `a😀x${'\x7f'.repeat(2)}`);
      });
    });

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
  });
});
