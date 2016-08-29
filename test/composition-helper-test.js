var assert = require('chai').assert;
var Terminal = require('../src/xterm');

describe('CompositionHelper', function () {
  var terminal;
  var compositionHelper;
  var compositionView;
  var textarea;
  var handledText;

  beforeEach(function () {
    compositionView = {
      classList: {
        add: function () {},
        remove: function () {},
      },
      getBoundingClientRect: function () {
        return { width: 0 };
      },
      style: {
        left: 0,
        top: 0
      },
      textContent: ''
    };
    textarea = {
      value: '',
      style: {
        left: 0,
        top: 0
      }
    };
    terminal = {
      element: {
        querySelector: function () {
          return { offsetLeft: 0, offsetTop: 0 };
        }
      },
      handler: function (text) {
        handledText += text;
      }
    };
    handledText = '';
    compositionHelper = new Terminal.CompositionHelper(textarea, compositionView, terminal);
  });

  describe('Public API', function () {
    it('should define CompositionHelper.prototype.compositionstart', function () {
      assert.isDefined(Terminal.CompositionHelper.prototype.compositionstart);
    });
    it('should define CompositionHelper.prototype.compositionupdate', function () {
      assert.isDefined(Terminal.CompositionHelper.prototype.compositionupdate);
    });
    it('should define CompositionHelper.prototype.compositionend', function () {
      assert.isDefined(Terminal.CompositionHelper.prototype.compositionend);
    });
    it('should define CompositionHelper.prototype.finalizeComposition', function () {
      assert.isDefined(Terminal.CompositionHelper.prototype.finalizeComposition);
    });
    it('should define CompositionHelper.prototype.handleAnyTextareaChanges', function () {
      assert.isDefined(Terminal.CompositionHelper.prototype.handleAnyTextareaChanges);
    });
    it('should define CompositionHelper.prototype.updateCompositionElements', function () {
      assert.isDefined(Terminal.CompositionHelper.prototype.updateCompositionElements);
    });
    it('should define CompositionHelper.isComposing', function () {
      assert.isDefined(compositionHelper.isComposing);
    });
    it('should define CompositionHelper.isSendingComposition', function () {
      assert.isDefined(compositionHelper.isSendingComposition);
    });
  });

  describe('Input', function () {
    it('Should insert simple characters', function (done) {
      // First character 'ㅇ'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'ㅇ' });
      textarea.value = 'ㅇ';
      setTimeout(function() { // wait for any textarea updates
        compositionHelper.compositionend();
        setTimeout(function() { // wait for any textarea updates
          assert.equal(handledText, 'ㅇ');
          // Second character 'ㅇ'
          compositionHelper.compositionstart();
          compositionHelper.compositionupdate({ data: 'ㅇ' });
          textarea.value = 'ㅇㅇ';
          setTimeout(function() { // wait for any textarea updates
            compositionHelper.compositionend();
            setTimeout(function() { // wait for any textarea updates
              assert.equal(handledText, 'ㅇㅇ');
              done();
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert complex characters', function (done) {
      // First character '앙'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'ㅇ' });
      textarea.value = 'ㅇ';
      setTimeout(function() { // wait for any textarea updates
        compositionHelper.compositionupdate({ data: '아' });
        textarea.value = '아';
        setTimeout(function() { // wait for any textarea updates
          compositionHelper.compositionupdate({ data: '앙' });
          textarea.value = '앙';
          setTimeout(function() { // wait for any textarea updates
            compositionHelper.compositionend();
            setTimeout(function() { // wait for any textarea updates
              assert.equal(handledText, '앙');
              // Second character '앙'
              compositionHelper.compositionstart();
              compositionHelper.compositionupdate({ data: 'ㅇ' });
              textarea.value = '앙ㅇ';
              setTimeout(function() { // wait for any textarea updates
                compositionHelper.compositionupdate({ data: '아' });
                textarea.value = '앙아';
                setTimeout(function() { // wait for any textarea updates
                  compositionHelper.compositionupdate({ data: '앙' });
                  textarea.value = '앙앙';
                  setTimeout(function() { // wait for any textarea updates
                    compositionHelper.compositionend();
                    setTimeout(function() { // wait for any textarea updates
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

    it('Should insert complex characters that change with following character', function (done) {
      // First character '아'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'ㅇ' });
      textarea.value = 'ㅇ';
      setTimeout(function() { // wait for any textarea updates
        compositionHelper.compositionupdate({ data: '아' });
        textarea.value = '아';
        setTimeout(function() { // wait for any textarea updates
          // Start second character '아' in first character
          compositionHelper.compositionupdate({ data: '앙' });
          textarea.value = '앙';
          setTimeout(function() { // wait for any textarea updates
            compositionHelper.compositionend();
            compositionHelper.compositionstart();
            compositionHelper.compositionupdate({ data: '아' });
            textarea.value = '아아'
            setTimeout(function() { // wait for any textarea updates
              compositionHelper.compositionend();
              setTimeout(function() { // wait for any textarea updates
                assert.equal(handledText, '아아');
                done();
              }, 0);
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert multi-characters compositions', function (done) {
      // First character 'だ'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'd' });
      textarea.value = 'd';
      setTimeout(function() { // wait for any textarea updates
        compositionHelper.compositionupdate({ data: 'だ' });
        textarea.value = 'だ';
        setTimeout(function() { // wait for any textarea updates
          // Second character 'あ'
          compositionHelper.compositionupdate({ data: 'だあ' });
          textarea.value = 'だあ';
          setTimeout(function() { // wait for any textarea updates
            compositionHelper.compositionend();
            setTimeout(function() { // wait for any textarea updates
              assert.equal(handledText, 'だあ');
              done();
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert multi-character compositions that are converted to other characters with the same length', function (done) {
      // First character 'だ'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'd' });
      textarea.value = 'd';
      setTimeout(function() { // wait for any textarea updates
        compositionHelper.compositionupdate({ data: 'だ' });
        textarea.value = 'だ';
        setTimeout(function() { // wait for any textarea updates
          // Second character 'ー'
          compositionHelper.compositionupdate({ data: 'だー' });
          textarea.value = 'だー';
          setTimeout(function() { // wait for any textarea updates
            // Convert to katakana 'ダー'
            compositionHelper.compositionupdate({ data: 'ダー' });
            textarea.value = 'ダー';
            setTimeout(function() { // wait for any textarea updates
              compositionHelper.compositionend();
              setTimeout(function() { // wait for any textarea updates
                assert.equal(handledText, 'ダー');
                done();
              }, 0);
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    })

    it('Should insert multi-character compositions that are converted to other characters with different lengths', function (done) {
      // First character 'い'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'い' });
      textarea.value = 'い';
      setTimeout(function() { // wait for any textarea updates
        // Second character 'ま'
        compositionHelper.compositionupdate({ data: 'いm' });
        textarea.value = 'いm';
        setTimeout(function() { // wait for any textarea updates
          compositionHelper.compositionupdate({ data: 'いま' });
          textarea.value = 'いま';
          setTimeout(function() { // wait for any textarea updates
            // Convert to kanji '今'
            compositionHelper.compositionupdate({ data: '今' });
            textarea.value = '今';
            setTimeout(function() { // wait for any textarea updates
              compositionHelper.compositionend();
              setTimeout(function() { // wait for any textarea updates
                assert.equal(handledText, '今');
                done();
              }, 0);
            }, 0);
          }, 0);
        }, 0);
      }, 0);
    });

    it('Should insert non-composition characters input immediately after composition characters', function (done) {
      // First character 'ㅇ'
      compositionHelper.compositionstart();
      compositionHelper.compositionupdate({ data: 'ㅇ' });
      textarea.value = 'ㅇ';
      setTimeout(function() { // wait for any textarea updates
        compositionHelper.compositionend();
        // Second character '1' (a non-composition character)
        textarea.value = 'ㅇ1';
        setTimeout(function() { // wait for any textarea updates
          assert.equal(handledText, 'ㅇ1');
          done();
        }, 0);
      }, 0);
    });
  });
});
