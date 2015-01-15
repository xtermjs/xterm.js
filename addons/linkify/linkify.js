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
    var exports = {},
        protocolClause = '(https?:\\/\\/)',
        domainCharacterSet = '[\\da-z\\.-]+',
        negatedDomainCharacterSet = '[^\\da-z\\.-]+',
        domainBodyClause = '(' + domainCharacterSet + ')',
        tldClause = '([a-z\\.]{2,6})',
        hostClause = domainBodyClause + '\\.' + tldClause,
        pathClause = '([\\/\\w\\.-]*)*\\/?',
        negatedPathCharacterSet = '[^\\/\\w\\.-]+',
        bodyClause = hostClause + pathClause,
        start = '(?:^|' + negatedDomainCharacterSet + ')(',
        end = ')($|' + negatedPathCharacterSet + ')',
        urlClause = start + protocolClause + '?' + bodyClause + end,
        urlRegex = new RegExp(urlClause);

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

            /*
             * Since we cannot access the TextNode's HTML representation
             * from the instance itself, we assign its data as textContent
             * to a dummy buffer span, in order to retrieve the TextNode's
             * HTML representation from the buffer's innerHTML.
             */
            buffer.textContent = node.data;

            var nodeHTML = buffer.innerHTML;

            /*
             * Apply function only on TextNodes
             */
            if (node.nodeType != node.TEXT_NODE) {
                continue;
            }

            
            var match = node.data.match(urlRegex);

            /*
             * If no URL was found in the current text, return.
             */
            if (!match) {
                continue;
            }

            var url = match[1],
                startsWithProtocol = new RegExp('^' + protocolClause),
                urlHasProtocol = url.match(startsWithProtocol),
                href = (urlHasProtocol) ? url : 'http://' + url,
                link = '<a href="' +  href + '" >' + url + '</a>',
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