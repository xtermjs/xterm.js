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
  var container = this.rowContainer,
      subjectRow = this.rowContainer.firstElementChild,
      rows = parseInt(container.offsetHeight / subjectRow.offsetHeight),
      contentBuffer,
      characterWidth,
      cols;
  
  subjectRow.style.display = 'inline';
  
  contentBuffer = subjectRow.textContent;

  subjectRow.textContent = ' ';
  characterWidth = parseInt(subjectRow.offsetWidth);

  subjectRow.style.display = '';
  
  cols = container.offsetWidth / characterWidth;
  cols = parseInt(cols);
      
  this.resize(cols, rows);
};