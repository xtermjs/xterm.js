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
      rows,
      contentBuffer,
      characterWidth,
      characterHeight,
      cols;

  subjectRow.style.display = 'inline';
  
  contentBuffer = subjectRow.textContent;

  subjectRow.innerHTML = '&nbsp;'; /* Arbitrary character to calculate its dimensions */
  characterWidth = parseInt(subjectRow.offsetWidth);
  characterHeight = parseInt(subjectRow.offsetHeight);

  subjectRow.style.display = '';
  
  cols = container.offsetWidth / characterWidth;
  cols = parseInt(cols);
  
  var parentElementStyle = window.getComputedStyle(this.element.parentElement),
      parentElementHeight = parseInt(parentElementStyle.getPropertyValue('height')),
      elementStyle = window.getComputedStyle(this.element),
      elementPadding = parseInt(elementStyle.getPropertyValue('padding-top')) + parseInt(elementStyle.getPropertyValue('padding-bottom')),
      availableHeight = parentElementHeight - elementPadding;
  
    rows = parseInt(availableHeight / characterHeight);
      
  this.resize(cols, rows);
};