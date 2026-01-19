/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { CompositionHelper } from 'browser/input/CompositionHelper';
import { MockRenderService } from 'browser/TestUtils.test';
import { MockCoreService, MockBufferService, MockOptionsService } from 'common/TestUtils.test';

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
        return { width: 0, height: 0 };
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
        top: 0,
        width: 0,
        height: 0,
        lineHeight: 0
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

  describe('updateCompositionElements', () => {
    it('should not overflow when cursor is at the last column', () => {
      const bufferService = (compositionHelper as any)._bufferService as MockBufferService;
      const renderService = (compositionHelper as any)._renderService as MockRenderService;

      // Set cursor to last column
      bufferService.buffer.x = bufferService.cols - 1;
      bufferService.buffer.y = 0;
      // Ensure cursor is in viewport
      bufferService.buffer.isCursorInViewport = true;

      // Set cell dimensions
      const cellWidth = 10;
      const cellHeight = 20;
      renderService.dimensions.css.cell.width = cellWidth;
      renderService.dimensions.css.cell.height = cellHeight;

      // Mock composition view with large width that would overflow
      const compositionWidth = 80;
      (compositionView as any).getBoundingClientRect = () => {
        return { width: compositionWidth, height: cellHeight } as any;
      };

      // Set composition state
      (compositionHelper as any)._isComposing = true;

      // Call update
      compositionHelper.updateCompositionElements(true);

      // Parse the left and top values (they are strings like "0px")
      const leftStr = (compositionView.style as any).left || '0px';
      const topStr = (compositionView.style as any).top || '0px';
      const left = parseFloat(leftStr.replace('px', ''));
      const top = parseFloat(topStr.replace('px', ''));

      // Calculate max right boundary
      const maxRight = bufferService.cols * cellWidth;
      const MARGIN = 20;
      const cursorLeft = bufferService.buffer.x * cellWidth;
      const wouldOverflow = (cursorLeft + compositionWidth) > (maxRight - MARGIN);

      // Verify that composition view does not overflow (with margin)
      assert.isAtMost(left + compositionWidth, maxRight - MARGIN, 'Composition view should not overflow terminal right edge');
      
      // If overflow was detected and fixed, top should be moved down one line
      if (wouldOverflow) {
        assert.equal(top, cellHeight, 'When overflow is fixed, composition view should be moved down one line');
        assert.isAtMost(left, maxRight - compositionWidth - MARGIN, 'Left position should be adjusted to prevent overflow');
      } else {
        assert.equal(top, 0, 'When no overflow, top should remain at cursor position');
      }
    });
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
  });
});
