/**
 * @license MIT
 */

import { LinkMatcherOptions } from './Interfaces';
import { LinkMatcher, LinkMatcherHandler, LinkMatcherValidationCallback } from './Types';

const INVALID_LINK_CLASS = 'xterm-invalid-link';

const protocolClause = '(https?:\\/\\/)';
const domainCharacterSet = '[\\da-z\\.-]+';
const negatedDomainCharacterSet = '[^\\da-z\\.-]+';
const domainBodyClause = '(' + domainCharacterSet + ')';
const tldClause = '([a-z\\.]{2,6})';
const ipClause = '((\\d{1,3}\\.){3}\\d{1,3})';
const localHostClause = '(localhost)';
const portClause = '(:\\d{1,5})';
const hostClause = '((' + domainBodyClause + '\\.' + tldClause + ')|' + ipClause + '|' + localHostClause + ')' + portClause + '?';
const pathClause = '(\\/[\\/\\w\\.\\-%~]*)*';
const queryStringHashFragmentCharacterSet = '[0-9\\w\\[\\]\\(\\)\\/\\?\\!#@$%&\'*+,:;~\\=\\.\\-]*';
const queryStringClause = '(\\?' + queryStringHashFragmentCharacterSet + ')?';
const hashFragmentClause = '(#' + queryStringHashFragmentCharacterSet + ')?';
const negatedPathCharacterSet = '[^\\/\\w\\.\\-%]+';
const bodyClause = hostClause + pathClause + queryStringClause + hashFragmentClause;
const start = '(?:^|' + negatedDomainCharacterSet + ')(';
const end = ')($|' + negatedPathCharacterSet + ')';
const strictUrlRegex = new RegExp(start + protocolClause + bodyClause + end);

/**
 * The ID of the built in http(s) link matcher.
 */
const HYPERTEXT_LINK_MATCHER_ID = 0;

/**
 * The Linkifier applies links to rows shortly after they have been refreshed.
 */
export class Linkifier {
  /**
   * The time to wait after a row is changed before it is linkified. This prevents
   * the costly operation of searching every row multiple times, potentially a
   * huge amount of times.
   */
  protected static TIME_BEFORE_LINKIFY = 200;

  protected _linkMatchers: LinkMatcher[];

  private _document: Document;
  private _rows: HTMLElement[];
  private _rowTimeoutIds: number[];
  private _nextLinkMatcherId = HYPERTEXT_LINK_MATCHER_ID;

  constructor() {
    this._rowTimeoutIds = [];
    this._linkMatchers = [];
    this.registerLinkMatcher(strictUrlRegex, null, { matchIndex: 1 });
  }

  /**
   * Attaches the linkifier to the DOM, enabling linkification.
   * @param document The document object.
   * @param rows The array of rows to apply links to.
   */
  public attachToDom(document: Document, rows: HTMLElement[]) {
    this._document = document;
    this._rows = rows;
  }

  /**
   * Queues a row for linkification.
   * @param {number} rowIndex The index of the row to linkify.
   */
  public linkifyRow(rowIndex: number): void {
    // Don't attempt linkify if not yet attached to DOM
    if (!this._document) {
      return;
    }

    const timeoutId = this._rowTimeoutIds[rowIndex];
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    this._rowTimeoutIds[rowIndex] = setTimeout(this._linkifyRow.bind(this, rowIndex), Linkifier.TIME_BEFORE_LINKIFY);
  }

  /**
   * Attaches a handler for hypertext links, overriding default <a> behavior
   * for standard http(s) links.
   * @param {LinkHandler} handler The handler to use, this can be cleared with
   * null.
   */
  public setHypertextLinkHandler(handler: LinkMatcherHandler): void {
    this._linkMatchers[HYPERTEXT_LINK_MATCHER_ID].handler = handler;
  }

  /**
   * Attaches a validation callback for hypertext links.
   * @param {LinkMatcherValidationCallback} callback The callback to use, this
   * can be cleared with null.
   */
  public setHypertextValidationCallback(callback: LinkMatcherValidationCallback): void {
    this._linkMatchers[HYPERTEXT_LINK_MATCHER_ID].validationCallback = callback;
  }

  /**
   * Registers a link matcher, allowing custom link patterns to be matched and
   * handled.
   * @param {RegExp} regex The regular expression to search for, specifically
   * this searches the textContent of the rows. You will want to use \s to match
   * a space ' ' character for example.
   * @param {LinkHandler} handler The callback when the link is called.
   * @param {LinkMatcherOptions} [options] Options for the link matcher.
   * @return {number} The ID of the new matcher, this can be used to deregister.
   */
  public registerLinkMatcher(regex: RegExp, handler: LinkMatcherHandler, options: LinkMatcherOptions = {}): number {
    if (this._nextLinkMatcherId !== HYPERTEXT_LINK_MATCHER_ID && !handler) {
      throw new Error('handler must be defined');
    }
    const matcher: LinkMatcher = {
      id: this._nextLinkMatcherId++,
      regex,
      handler,
      matchIndex: options.matchIndex,
      validationCallback: options.validationCallback,
      priority: options.priority || 0
    };
    this._addLinkMatcherToList(matcher);
    return matcher.id;
  }

  /**
   * Inserts a link matcher to the list in the correct position based on the
   * priority of each link matcher. New link matchers of equal priority are
   * considered after older link matchers.
   * @param matcher The link matcher to be added.
   */
  private _addLinkMatcherToList(matcher: LinkMatcher): void {
    if (this._linkMatchers.length === 0) {
      this._linkMatchers.push(matcher);
      return;
    }

    for (let i = this._linkMatchers.length - 1; i >= 0; i--) {
      if (matcher.priority <= this._linkMatchers[i].priority) {
        this._linkMatchers.splice(i + 1, 0, matcher);
        return;
      }
    }

    this._linkMatchers.splice(0, 0, matcher);
  }

  /**
   * Deregisters a link matcher if it has been registered.
   * @param {number} matcherId The link matcher's ID (returned after register)
   * @return {boolean} Whether a link matcher was found and deregistered.
   */
  public deregisterLinkMatcher(matcherId: number): boolean {
    // ID 0 is the hypertext link matcher which cannot be deregistered
    for (let i = 1; i < this._linkMatchers.length; i++) {
      if (this._linkMatchers[i].id === matcherId) {
        this._linkMatchers.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Linkifies a row.
   * @param {number} rowIndex The index of the row to linkify.
   */
  private _linkifyRow(rowIndex: number): void {
    const row = this._rows[rowIndex];
    if (!row) {
      return;
    }
    const text = row.textContent;
    for (let i = 0; i < this._linkMatchers.length; i++) {
      const matcher = this._linkMatchers[i];
      const linkElements = this._doLinkifyRow(row, matcher);
        if (linkElements.length > 0) {
        // Fire validation callback
        if (matcher.validationCallback) {
          for (let j = 0; j < linkElements.length; j++) {
            const element = linkElements[j];
            matcher.validationCallback(element.textContent, element, isValid => {
              if (!isValid) {
                element.classList.add(INVALID_LINK_CLASS);
              }
            });
          }
        }
        // Only allow a single LinkMatcher to trigger on any given row.
        return;
      }
    }
  }

  /**
   * Linkifies a row given a specific handler.
   * @param {HTMLElement} row The row to linkify.
   * @param {LinkMatcher} matcher The link matcher for this line.
   * @return The link element if it was added, otherwise undefined.
   */
  private _doLinkifyRow(row: HTMLElement, matcher: LinkMatcher): HTMLElement[] {
    // Iterate over nodes as we want to consider text nodes
    let result = [];
    const isHttpLinkMatcher = matcher.id === HYPERTEXT_LINK_MATCHER_ID;
    const nodes = row.childNodes;

    // Find the first match
    let match = row.textContent.match(matcher.regex);
    if (!match || match.length === 0) {
      return result;
    }
    let uri = match[typeof matcher.matchIndex !== 'number' ? 0 : matcher.matchIndex];
    // Set the next searches start index
    let rowStartIndex = match.index + uri.length;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const searchIndex = node.textContent.indexOf(uri);
      if (searchIndex >= 0) {
        const linkElement = this._createAnchorElement(uri, matcher.handler, isHttpLinkMatcher);
        if (node.textContent.length === uri.length) {
          // Matches entire string
          if (node.nodeType === 3 /*Node.TEXT_NODE*/) {
            this._replaceNode(node, linkElement);
          } else {
            const element = (<HTMLElement>node);
            if (element.nodeName === 'A') {
              // This row has already been linkified
              return result;
            }
            element.innerHTML = '';
            element.appendChild(linkElement);
          }
        } else {
          // Matches part of string
          const nodesAdded = this._replaceNodeSubstringWithNode(node, linkElement, uri, searchIndex);
          // No need to consider the new nodes
          i += nodesAdded;
        }
        result.push(linkElement);

        // Find the next match
        match = row.textContent.substring(rowStartIndex).match(matcher.regex);
        if (!match || match.length === 0) {
          return result;
        }
        uri = match[typeof matcher.matchIndex !== 'number' ? 0 : matcher.matchIndex];
        rowStartIndex += match.index + uri.length;
      }
    }
    return result;
  }

  /**
   * Creates a link anchor element.
   * @param {string} uri The uri of the link.
   * @return {HTMLAnchorElement} The link.
   */
  private _createAnchorElement(uri: string, handler: LinkMatcherHandler, isHypertextLinkHandler: boolean): HTMLAnchorElement {
    const element = this._document.createElement('a');
    element.textContent = uri;
    element.draggable = false;
    if (isHypertextLinkHandler) {
      element.href = uri;
      // Force link on another tab so work is not lost
      element.target = '_blank';
      element.addEventListener('click', (event: MouseEvent) => {
        if (handler) {
          return handler(event, uri);
        }
      });
    } else {
      element.addEventListener('click', (event: MouseEvent) => {
        // Don't execute the handler if the link is flagged as invalid
        if (element.classList.contains(INVALID_LINK_CLASS)) {
          return;
        }
        return handler(event, uri);
      });
    }
    return element;
  }

  /**
   * Replace a node with 1 or more other nodes.
   * @param {Node} oldNode The node to replace.
   * @param {Node[]} newNodes The new nodes to insert in order.
   */
  private _replaceNode(oldNode: Node, ...newNodes: Node[]): void {
    const parent = oldNode.parentNode;
    for (let i = 0; i < newNodes.length; i++) {
      parent.insertBefore(newNodes[i], oldNode);
    }
    parent.removeChild(oldNode);
  }

  /**
   * Replace a substring within a node with a new node.
   * @param {Node} targetNode The target node; either a text node or a <span>
   * containing a single text node.
   * @param {Node} newNode The new node to insert.
   * @param {string} substring The substring to replace.
   * @param {number} substringIndex The index of the substring within the string.
   * @return The number of nodes to skip when searching for the next uri.
   */
  private _replaceNodeSubstringWithNode(targetNode: Node, newNode: Node, substring: string, substringIndex: number): number {
    let node = targetNode;
    if (node.nodeType !== 3/*Node.TEXT_NODE*/) {
      node = node.childNodes[0];
    }

    // The targetNode will be either a text node or a <span>. The text node
    // (targetNode or its only-child) needs to be replaced with newNode plus new
    // text nodes potentially on either side.
    if (node.childNodes.length === 0 && node.nodeType !== 3/*Node.TEXT_NODE*/) {
      throw new Error('targetNode must be a text node or only contain a single text node');
    }

    const fullText = node.textContent;

    if (substringIndex === 0) {
      // Replace with <newNode><textnode>
      const rightText = fullText.substring(substring.length);
      const rightTextNode = this._document.createTextNode(rightText);
      this._replaceNode(node, newNode, rightTextNode);
      return 0;
    }

    if (substringIndex === targetNode.textContent.length - substring.length) {
      // Replace with <textnode><newNode>
      const leftText = fullText.substring(0, substringIndex);
      const leftTextNode = this._document.createTextNode(leftText);
      this._replaceNode(node, leftTextNode, newNode);
      return 0;
    }

    // Replace with <textnode><newNode><textnode>
    const leftText = fullText.substring(0, substringIndex);
    const leftTextNode = this._document.createTextNode(leftText);
    const rightText = fullText.substring(substringIndex + substring.length);
    const rightTextNode = this._document.createTextNode(rightText);
    this._replaceNode(node, leftTextNode, newNode, rightTextNode);
    return 1;
  }
}
