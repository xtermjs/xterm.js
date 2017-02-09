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

/**
 * The Linkifier applies links to rows shortly after they have been refreshed.
 */
export class Linkifier {
  private _rows: HTMLElement[];
  private _rowTimeoutIds: number[];
  private _hypertextLinkHandler: LinkHandler;

  constructor(rows: HTMLElement[]) {
    this._rows = rows;
    this._rowTimeoutIds = [];
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

  // TODO: Support local links
  public attachHypertextLinkHandler(handler: LinkHandler): void {
    this._hypertextLinkHandler = handler;
  }

  /**
   * Linkifies a row.
   * @param {number} rowIndex The index of the row to linkify.
   */
  private _linkifyRow(rowIndex: number): void {
    const rowHtml = this._rows[rowIndex].innerHTML;
    const uri = this._findLinkMatch(rowHtml);
    if (!uri) {
      return;
    }

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

        const linkElement = this._createAnchorElement(uri);
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
  private _findLinkMatch(html: string): string {
    const match = html.match(strictUrlRegex);
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
  private _createAnchorElement(uri: string): HTMLAnchorElement {
    const element = document.createElement('a');
    element.textContent = uri;
    if (this._hypertextLinkHandler) {
      element.addEventListener('click', () => this._hypertextLinkHandler(uri));
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
