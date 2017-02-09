/**
 * The time to wait after a row is changed before it is linkified. This prevents
 * the costly operation of searching every row multiple times, pntentially a
 * huge aount of times.
 */
const TIME_BEFORE_LINKIFY = 200;

const protocolClause = '(https?:\\/\\/)';
const domainCharacterSet = '[\\da-z\\.-]+';
const negatedDomainCharacterSet = '[^\\da-z\\.-]+';
const domainBodyClause = '(' + domainCharacterSet + ')';
const tldClause = '([a-z\\.]{2,6})';
const ipClause = '((\\d{1,3}\\.){3}\\d{1,3})';
const portClause = '(:\\d{1,5})';
const hostClause = '((' + domainBodyClause + '\\.' + tldClause + ')|' + ipClause + ')' + portClause + '?';
const pathClause = '(\\/[\\/\\w\\.-]*)*';
const negatedPathCharacterSet = '[^\\/\\w\\.-]+';
const bodyClause = hostClause + pathClause;
const start = '(?:^|' + negatedDomainCharacterSet + ')(';
const end = ')($|' + negatedPathCharacterSet + ')';
const strictUrlRegex = new RegExp(start + protocolClause + bodyClause + end);

export type LinkHandler = (uri: string) => void;

type LinkMatcher = {id: number, regex: RegExp, handler: LinkHandler};

const HYPERTEXT_LINK_MATCHER_ID = 0;

/**
 * The Linkifier applies links to rows shortly after they have been refreshed.
 */
export class Linkifier {
  private static _nextLinkMatcherId = HYPERTEXT_LINK_MATCHER_ID;

  private _rows: HTMLElement[];
  private _rowTimeoutIds: number[];
  private _linkMatchers: LinkMatcher[];

  constructor(rows: HTMLElement[]) {
    this._rows = rows;
    this._rowTimeoutIds = [];
    this._linkMatchers = [];
    this.registerLinkMatcher(strictUrlRegex, null);
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
    this._rowTimeoutIds[rowIndex] = setTimeout(this._linkifyRow.bind(this, rowIndex), TIME_BEFORE_LINKIFY);
  }

  /**
   * Attaches a handler for hypertext links, overriding default <a> behavior.
   * @param {LinkHandler} handler The handler to use, this can be cleared with
   * null.
   */
  public attachHypertextLinkHandler(handler: LinkHandler): void {
    this._linkMatchers[HYPERTEXT_LINK_MATCHER_ID].handler = handler;
  }

  /**
   * Registers a link matcher, allowing custom link patterns to be matched and
   * handled.
   * @param {RegExp} regex The regular expression the search for.
   * @param {LinkHandler} handler The callback when the link is called.
   * @return {number} The ID of the new matcher, this can be used to deregister.
   */
  public registerLinkMatcher(regex: RegExp, handler: LinkHandler): number {
    if (Linkifier._nextLinkMatcherId !== HYPERTEXT_LINK_MATCHER_ID && !handler) {
      throw new Error('handler cannot be falsy');
    }
    const matcher: LinkMatcher = {
      id: Linkifier._nextLinkMatcherId++,
      regex,
      handler
    };
    this._linkMatchers.push(matcher);
    return matcher.id;
  }

  /**
   * Deregisters a link matcher if it has been registered.
   * @param {number} matcherId The link matcher's ID (returned after register)
   */
  public deregisterLinkMatcher(matcherId: number): void {
    // ID 0 is the hypertext link matcher which cannot be deregistered
    for (let i = 1; i < this._linkMatchers.length; i++) {
      if (this._linkMatchers[i].id === matcherId) {
        this._linkMatchers.splice(i, 1);
      }
    }
  }

  /**
   * Linkifies a row.
   * @param {number} rowIndex The index of the row to linkify.
   */
  private _linkifyRow(rowIndex: number): void {
    const rowHtml = this._rows[rowIndex].innerHTML;
    for (let i = 0; i < this._linkMatchers.length; i++) {
      const matcher = this._linkMatchers[i];
      const uri = this._findLinkMatch(rowHtml, matcher.regex);
      if (uri) {
        this._doLinkifyRow(rowIndex, uri, matcher.handler);
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
   */
  private _doLinkifyRow(rowIndex: number, uri: string, handler?: LinkHandler): void {
    // Iterate over nodes as we want to consider text nodes
    const nodes = this._rows[rowIndex].childNodes;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const searchIndex = node.textContent.indexOf(uri);
      if (searchIndex >= 0) {
        if (node.childNodes.length > 0) {
          // This row has already been linkified
          return;
        }

        const linkElement = this._createAnchorElement(uri, handler);
        // TODO: Check if childNodes check is needed
        if (node.textContent.trim().length === uri.length) {
          // Matches entire string
          if (node.nodeType === Node.TEXT_NODE) {
            this._replaceNode(node, linkElement);
          } else {
            const element = (<HTMLElement>node);
            element.innerHTML = '';
            element.appendChild(linkElement);
          }
        } else {
          // Matches part of string
          this._replaceNodeSubstringWithNode(node, linkElement, uri, searchIndex);
        }
      }
    }
  }

  /**
   * Finds a link match in a piece of HTML.
   * @param {string} html The HTML to search.
   * @return {string} The matching URI or null if not found.
   */
  private _findLinkMatch(html: string, regex: RegExp): string {
    const match = html.match(regex);
    if (!match || match.length === 0) {
      return null;
    }
    return match[1];
  }

  /**
   * Creates a link anchor element.
   * @param {string} uri The uri of the link.
   * @return {HTMLAnchorElement} The link.
   */
  private _createAnchorElement(uri: string, handler: LinkHandler): HTMLAnchorElement {
    const element = document.createElement('a');
    element.textContent = uri;
    if (handler) {
      element.addEventListener('click', () => handler(uri));
    } else {
      element.href = uri;
      // Force link on another tab so work is not lost
      element.target = '_blank';
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
    if (node.nodeType !== Node.TEXT_NODE) {
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
      const rightTextNode = document.createTextNode(rightText);
      this._replaceNode(node, newNode, rightTextNode);
    } else if (substringIndex === targetNode.textContent.length - substring.length) {
      // Replace with <textnode><newNode>
      const leftText = fullText.substring(0, substringIndex);
      const leftTextNode = document.createTextNode(leftText);
      this._replaceNode(node, leftTextNode, newNode);
    } else {
      // Replace with <textnode><newNode><textnode>
      const leftText = fullText.substring(0, substringIndex);
      const leftTextNode = document.createTextNode(leftText);
      const rightText = fullText.substring(substringIndex + substring.length);
      const rightTextNode = document.createTextNode(rightText);
      this._replaceNode(node, leftTextNode, newNode, rightTextNode);
    }
  }
}
