"use strict";

var protocolClause = '(https?:\\/\\/)',
  domainCharacterSet = '[\\da-z\\.-]+',
  negatedDomainCharacterSet = '[^\\da-z\\.-]+',
  domainBodyClause = '(' + domainCharacterSet + ')',
  tldClause = '([a-z\\.]{2,6})',
  ipClause = '((\\d{1,3}\\.){3}\\d{1,3})',
  portClause = '(:\\d{1,5})',
  hostClause = '((' + domainBodyClause + '\\.' + tldClause + ')|' + ipClause + ')' + portClause + '?',
  pathClause = '(\\/[\\/\\w\\.-]*)*',
  negatedPathCharacterSet = '[^\\/\\w\\.-]+',
  bodyClause = hostClause + pathClause,
  start = '(?:^|' + negatedDomainCharacterSet + ')(',
  end = ')($|' + negatedPathCharacterSet + ')',
  lenientUrlClause = start + protocolClause + '?' + bodyClause + end,
  strictUrlClause = start + protocolClause + bodyClause + end,
  lenientUrlRegex = new RegExp(lenientUrlClause),
  strictUrlRegex = new RegExp(strictUrlClause);


/**
 * Finds a link within a block of text.
 *
 * @param {string} text - The text to search .
 * @param {boolean} lenient - Whether to use the lenient search.
 * @return {string} A URL.
 */
module.exports = function (text, lenient) {
  var match = text.match(lenient ? lenientUrlRegex : strictUrlRegex);
  if (!match || match.length === 0) {
    return null;
  }
  return match[1];
};


