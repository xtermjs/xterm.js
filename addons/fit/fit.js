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
        var parentElementStyle = window.getComputedStyle(this.element.parentElement),
            parentElementHeight = parseInt(parentElementStyle.getPropertyValue('height')),
            parentElementWidth = parseInt(parentElementStyle.getPropertyValue('width')),
            elementStyle = window.getComputedStyle(this.element),
            elementPaddingVer = parseInt(elementStyle.getPropertyValue('padding-top')) + parseInt(elementStyle.getPropertyValue('padding-bottom')),
            elementPaddingHor = parseInt(elementStyle.getPropertyValue('padding-right')) + parseInt(elementStyle.getPropertyValue('padding-left')),
            availableHeight = parentElementHeight - elementPaddingVer,
            availableWidth = parentElementWidth - elementPaddingHor,
            container = this.rowContainer,
            subjectRow = this.rowContainer.firstElementChild,
            contentBuffer = subjectRow.innerHTML,
            characterHeight,
            rows,
            characterWidth,
            cols,
            geometry;

        subjectRow.style.display = 'inline';
        subjectRow.innerHTML = 'W'; // Common character for measuring width, although on monospace
        characterWidth = subjectRow.getBoundingClientRect().width;
        subjectRow.style.display = ''; // Revert style before calculating height, since they differ.
        characterHeight = parseInt(subjectRow.offsetHeight);
        subjectRow.innerHTML = contentBuffer;

        rows = parseInt(availableHeight / characterHeight);
        cols = parseInt(availableWidth / characterWidth) - 1;

        geometry = {cols: cols, rows: rows};
        return geometry;
    };

    Xterm.prototype.fit = function () {
        var geometry = this.proposeGeometry();

        this.resize(geometry.cols, geometry.rows);
    };
});
