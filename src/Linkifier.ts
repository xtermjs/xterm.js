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
const pathClause = '(\\/[\\/\\w\\.\\-%]*)*';
const queryStringHashFragmentCharacterSet = '[0-9\\w\\[\\]\\(\\)\\/\\?\\!#@$%&\'*+,:;\\=\\.\\-]*';
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
   * the costly operation of searching every row multiple times, pntentially a
   * huge aount of times.
   */
  protected static TIME_BEFORE_LINKIFY = 200;

  protected _linkMatchers: LinkMatcher[];

  private _document: Document;
  private _rows: HTMLElement[];
  private _rowTimeoutIds: number[];
  private _nextLinkMatcherId = HYPERTEXT_LINK_MATCHER_ID;

  constructor(document: Document, rows: HTMLElement[]) {
    this._document = document;
    this._rows = rows;
    this._rowTimeoutIds = [];
    this._linkMatchers = [];
    this.registerLinkMatcher(strictUrlRegex, null, { matchIndex: 1 });
  }

  /**
   * Queues a row for linkification.
   * @param {number} rowIndex The index of the row to linkify.
   */
  public linkifyRow(rowIndex: number): void {
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
  public attachHypertextLinkHandler(handler: LinkMatcherHandler): void {
    this._linkMatchers[HYPERTEXT_LINK_MATCHER_ID].handler = handler;
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
      const uri = this._findLinkMatch(text, matcher.regex, matcher.matchIndex);
      if (uri) {
        const linkElement = this._doLinkifyRow(rowIndex, uri, matcher.handler, matcher.id === HYPERTEXT_LINK_MATCHER_ID);
        // Fire validation callback
        if (linkElement && matcher.validationCallback) {
          matcher.validationCallback(uri, isValid => {
            if (!isValid) {
              linkElement.classList.add(INVALID_LINK_CLASS);
            }
          });
        }
        // Only allow a single LinkMatcher to trigger on any given row.
        return;
      }
    }
  }

  /**
   * Linkifies a row given a specific handler.
   * @param {number} rowIndex The index of the row to linkify.
   * @param {string} uri The uri that has been found.
   * @param {handler} handler The handler to trigger when the link is triggered.
   * @return The link element if it was added, otherwise undefined.
   */
  private _doLinkifyRow(rowIndex: number, uri: string, handler: LinkMatcherHandler, isHttpLinkMatcher: boolean): HTMLElement {
    // Iterate over nodes as we want to consider text nodes
    const nodes = this._rows[rowIndex].childNodes;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const searchIndex = node.textContent.indexOf(uri);
      if (searchIndex >= 0) {
        const linkElement = this._createAnchorElement(uri, handler, isHttpLinkMatcher);
        if (node.textContent.length === uri.length) {
          // Matches entire string

          if (node.nodeType === 3 /*Node.TEXT_NODE*/) {
            this._replaceNode(node, linkElement);
          } else {
            const element = (<HTMLElement>node);
            if (element.nodeName === 'A') {
              // This row has already been linkified
              return;
            }
            element.innerHTML = '';
            element.appendChild(linkElement);
          }
        } else {
          // Matches part of string
          this._replaceNodeSubstringWithNode(node, linkElement, uri, searchIndex);
        }
        return linkElement;
      }
    }
  }

  /**
   * Finds a link match in a piece of text.
   * @param {string} text The text to search.
   * @param {number} matchIndex The regex match index of the link.
   * @return {string} The matching URI or null if not found.
   */
  private _findLinkMatch(text: string, regex: RegExp, matchIndex?: number): string {
    const match = text.match(regex);
    if (!match || match.length === 0) {
      return null;
    }
    return match[typeof matchIndex !== 'number' ? 0 : matchIndex];
  }

  /**
   * Creates a link anchor element.
   * @param {string} uri The uri of the link.
   * @return {HTMLAnchorElement} The link.
   */
  private _createAnchorElement(uri: string, handler: LinkMatcherHandler, isHypertextLinkHandler: boolean): HTMLAnchorElement {
    const element = this._document.createElement('a');
    element.textContent = uri;
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
   */
  private _replaceNodeSubstringWithNode(targetNode: Node, newNode: Node, substring: string, substringIndex: number): void {
    let node = targetNode;
    if (node.nodeType !== 3/*Node.TEXT_NODE*/) {
      node = node.childNodes[0];
    }

    // The targetNode will be either a text node or a <span>. The text node
    // (targetNode or its only-child) needs to be replaced with newNode plus new
    // text nodes potentially on either side.
    if (node.childNodes.length === 0 && node.nodeType !== Node.TEXT_NODE) {
      throw new Error('targetNode must be a text node or only contain a single text node');
    }

    const fullText = node.textContent;

    if (substringIndex === 0) {
      // Replace with <newNode><textnode>
      const rightText = fullText.substring(substring.length);
      const rightTextNode = this._document.createTextNode(rightText);
      this._replaceNode(node, newNode, rightTextNode);
    } else if (substringIndex === targetNode.textContent.length - substring.length) {
      // Replace with <textnode><newNode>
      const leftText = fullText.substring(0, substringIndex);
      const leftTextNode = this._document.createTextNode(leftText);
      this._replaceNode(node, leftTextNode, newNode);
    } else {
      // Replace with <textnode><newNode><textnode>
      const leftText = fullText.substring(0, substringIndex);
      const leftTextNode = this._document.createTextNode(leftText);
      const rightText = fullText.substring(substringIndex + substring.length);
      const rightTextNode = this._document.createTextNode(rightText);
      this._replaceNode(node, leftTextNode, newNode, rightTextNode);
    }
  }
}
