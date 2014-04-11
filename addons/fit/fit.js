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
Terminal.prototype.fit = function () {
  var container = this.element.parentElement,
      subjectRow = this.rowContainer.firstElementChild,
      rows = parseInt(container.offsetHeight / subjectRow.offsetHeight),
      characterWidth,
      cols;
  
  subjectRow.style.display = 'inline';
  characterWidth = parseInt(subjectRow.offsetWidth / this.cols);
  subjectRow.style.display = '';
  
  cols = parseInt(container.offsetWidth / characterWidth);
      
  this.resize(cols, rows);
}