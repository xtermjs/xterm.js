(function (linkify) {
    if (typeof define == 'function') {
        /*
         * Require.js is available
         */
        define(['../../src/xterm'], linkify);
    } else {
        /*
         * Plain browser environment
         */ 
        linkify(this.Xterm);
    }
})(function (Xterm) {
	'use strict';
    /**
     * This module provides methods for convertings valid URL substrings 
     * into HTML anchor elements (links), inside a terminal view.
     *
     * @module xterm/addons/linkify/linkify
     */
    var exports = {};


    /**
     * Converts all valid URLs found in the given terminal line into
     * hyperlinks. The terminal line can be either the HTML element itself
     * or the index of the termina line in the children of the terminal
     * rows container.
     *
     * @param {Xterm} terminal - The terminal that owns the given line.
     * @param {number|HTMLDivElement} line - The terminal line that should get
     *								  		 "linkified".
     * @emits linkify
     * @emits linkify:line
     */
    exports.linkifyTerminalLine = function (terminal, line) {
        if (typeof line == 'number') {
            line = terminal.rowContainer.children[line];
        } else if (! (line instanceof HTMLDivElement)) {
            var message = 'The "line" argument should be either a number';
            message += ' or an HTMLDivElement';

            throw new TypeError(message);
        }

        var buffer = document.createElement('span'),
            nodes = line.childNodes;

        for (var j=0; j<nodes.length; j++) {
            var node = nodes[j];

            if (node.nodeType == 3) {
                var urlRegex = /(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?/,
                    match = node.data.match(urlRegex);

                if (match) {
                    var url = match[0],
                        link = '<a href="http://' +  url + '" >' + url + '</a>',
                        newData = node.data.replace(url, link);

                    buffer.textContent = node.data;
                    line.innerHTML = line.innerHTML.replace(buffer.innerHTML, newData);
                }
            }
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
     * @emits linkify
     * @emits linkify:line
     */
    exports.linkify = function (terminal) {
        var rows = terminal.rowContainer.children;

        for (var i=0; i<rows.length; i++) {
            var line = rows[i];

			exports.linkifyTerminalLine(terminal, line);
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

    /*
     * Extend Xterm prototype.
     */

   /**
     * Converts all valid URLs found in the current terminal linte into
     * hyperlinks.
     *
     * @memberof Xterm
     * @param {number|HTMLDivElement} line - The terminal line that should get
     *								  		 "linkified".
     */   
    Xterm.prototype.linkifyTerminalLine = function (line) {
        return exports.linkifyTerminalLine(this, line);
    };

   /**
     * Converts all valid URLs found in the current terminal into hyperlinks.
     *
     * @memberof Xterm
     */   
    Xterm.prototype.linkify = function () {
        return exports.linkify(this);
    };

    return exports;
});