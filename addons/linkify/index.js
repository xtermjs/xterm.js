'use strict';

/**
 * This module provides methods for convertings valid URL substrings
 * into HTML anchor elements (links), inside a terminal view.
 *
 * @module xterm/addons/linkify/linkify
 */
var findLinkMatch  = require('./findLinkMatch');

var exports = {}
 
/**
 * Converts all valid URLs found in the given terminal line into
 * hyperlinks. The terminal line can be either the HTML element itself
 * or the index of the termina line in the children of the terminal
 * rows container.
 *
 * @param {Xterm} terminal - The terminal that owns the given line.
 * @param {number|HTMLDivElement} line - The terminal line that should get
 *								  		 "linkified".
 * @param {boolean} lenient - The regex type that will be used to identify links. If lenient is
 *                            false, the regex requires a protocol clause. Defaults to true.
 * @param {string} target -  Sets target="" attribute with value provided to links.
 *                           Default doesn't set target attribute
 * @emits linkify
 * @emits linkify:line
 */
exports.linkifyTerminalLine = function (terminal, line, lenient, target) {
  if (typeof line == 'number') {
    line = terminal.rowContainer.children[line];
  } else if (! (line instanceof HTMLDivElement)) {
    var message = 'The "line" argument should be either a number';
    message += ' or an HTMLDivElement';

    throw new TypeError(message);
  }

  if (typeof target === 'undefined') {
    target = '';
  } else {
    target = 'target="' + target + '"';
  }

  var buffer = document.createElement('span'),
      nodes = line.childNodes;

  for (var j=0; j<nodes.length; j++) {
    var node = nodes[j],
        match;

    /**
     * Since we cannot access the TextNode's HTML representation
     * from the instance itself, we assign its data as textContent
     * to a dummy buffer span, in order to retrieve the TextNode's
     * HTML representation from the buffer's innerHTML.
     */
    buffer.textContent = node.data;

    var nodeHTML = buffer.innerHTML;

    /**
     * Apply function only on TextNodes
     */
    if (node.nodeType != node.TEXT_NODE) {
      continue;
    }

    var url = exports.findLinkMatch(node.data, lenient);

    if (!url) {
      continue;
    }

    var startsWithProtocol = new RegExp('^(https?:\\/\\/)'),
        urlHasProtocol = url.match(startsWithProtocol),
        href = (urlHasProtocol) ? url : 'http://' + url,
        link = '<a href="' +  href + '" ' + target + '>' + url + '</a>',
        newHTML = nodeHTML.replace(url, link);

    line.innerHTML = line.innerHTML.replace(nodeHTML, newHTML);
  }

  /**
   * This event gets emitted when conversion of all URL susbtrings
   * to HTML anchor elements (links) has finished, for a specific
   * line of the current Xterm instance.
   *
   * @event linkify:line
   */
  terminal.emit('linkify:line', line);
};



/**
 * Converts all valid URLs found in the terminal view into hyperlinks.
 *
 * @param {Xterm} terminal - The terminal that should get "linkified".
 * @param {boolean} lenient - The regex type that will be used to identify links. If lenient is
 *                            false, the regex requires a protocol clause. Defaults to true.
 * @param {string} target -  Sets target="" attribute with value provided to links.
 *                           Default doesn't set target attribute
 * @emits linkify
 * @emits linkify:line
 */
exports.linkify = function (terminal, lenient, target) {
  var rows = terminal.rowContainer.children;

  lenient = (typeof lenient == "boolean") ? lenient : true;
  for (var i=0; i<rows.length; i++) {
    var line = rows[i];

    exports.linkifyTerminalLine(terminal, line, lenient, target);
  }

  /**
   * This event gets emitted when conversion of  all URL substrings to
   * HTML anchor elements (links) has finished for the current Xterm
   * instance's view.
   *
   * @event linkify
   */
  terminal.emit('linkify');
};


/**
 * Extend Xterm prototype.
 */
module.exports = function (Xterm) {
  /**
   * Converts all valid URLs found in the current terminal linte into
   * hyperlinks.
   *
   * @memberof Xterm
   * @param {number|HTMLDivElement} line - The terminal line that should get
   *								  		 "linkified".
   * @param {boolean} lenient - The regex type that will be used to identify links. If lenient is
   *                            false, the regex requires a protocol clause. Defaults to true.
   * @param {string} target -  Sets target="" attribute with value provided to links.
   *                           Default doesn't set target attribute
   */
  Xterm.prototype.linkifyTerminalLine = function (line, lenient, target) {
    return exports.linkifyTerminalLine(this, line, lenient, target);
  };

  /**
   * Converts all valid URLs found in the current terminal into hyperlinks.
   *
   * @memberof Xterm
   * @param {boolean} lenient - The regex type that will be used to identify links. If lenient is
   *                            false, the regex requires a protocol clause. Defaults to true.
   * @param {string} target -  Sets target="" attribute with value provided to links.
   *                           Default doesn't set target attribute
   */
  Xterm.prototype.linkify = function (lenient, target) {
    return exports.linkify(this, lenient, target);
  };

  return exports;
};
