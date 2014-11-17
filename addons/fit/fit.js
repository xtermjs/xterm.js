/*
 *  Fit terminal columns and rows to the dimensions of its
 *  DOM element.
 *
 *  Approach:
 *    - Rows: Truncate the division of the terminal parent element height
 *            by the terminal row height
 *
 *    - Columns: Truncate the division of the terminal parent element width by
 *               the terminal character width (apply display: inline at the
 *               terminal row and truncate its width with the current number
 *               of columns)
 */
(function (fit) {
    if (typeof define == 'function') {
        /*
         * Require.js is available
         */
        define(['../../src/xterm'], fit);
    } else {
        /*
         * Plain browser environment
         */ 
        fit(this.Xterm);
    }
})(function (Xterm) {
    Xterm.prototype.proposeGeometry = function () {
        var container = this.rowContainer,
            subjectRow = this.rowContainer.firstElementChild,
            cursor = this.element.querySelector('.terminal-cursor'),
            rows,
            characterWidth,
            cols;

        characterWidth = Math.ceil(cursor.offsetWidth);
        
        /*
         * The following hack takes place in order to get "fit" work properly
         * in Mozilla Firefox.
         * Most probably, because of a dimension calculation bug, Firefox
         * calculates the width to be 1px less than it is actually drawn on
         * screen.
         */
        if (navigator.userAgent.match(/Gecko/)) {
            characterWidth++;
        }

        cols = parseInt(container.offsetWidth / characterWidth);

        var parentElementStyle = window.getComputedStyle(this.element.parentElement),
            parentElementHeight = parseInt(parentElementStyle.getPropertyValue('height')),
            elementStyle = window.getComputedStyle(this.element),
            elementPadding = parseInt(elementStyle.getPropertyValue('padding-top')) + parseInt(elementStyle.getPropertyValue('padding-bottom')),
            availableHeight = parentElementHeight - elementPadding,
            rowHeight = this.rowContainer.firstElementChild.offsetHeight;

        rows = parseInt(availableHeight / rowHeight);
        
        var geometry = {
                'cols': cols,
                'rows': rows
            };

        return geometry;
    };

    Xterm.prototype.fit = function () {
        var geometry = this.proposeGeometry();

        this.resize(geometry.cols, geometry.rows);
    };
});