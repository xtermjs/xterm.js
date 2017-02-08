/**
 * The time to wait after a row is changed before it is linkified. This prevents
 * the costly operation of searching every row multiple times, pntentially a
 * huge aount of times.
 */
const TIME_BEFORE_LINKIFY = 200;

const badUrlRegex = /https?:\/\/(\/[\/\\w\.-]*)*/;

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
const lenientUrlClause = start + protocolClause + '?' + bodyClause + end;
const strictUrlClause = start + protocolClause + bodyClause + end;
const lenientUrlRegex = new RegExp(lenientUrlClause);
const strictUrlRegex = new RegExp(strictUrlClause);

export type LinkHandler = (uri: string) => void;

export class Linkifier {
  private _rows: HTMLElement[];
  private _rowTimeoutIds: number[];
  private _webLinkHandler: LinkHandler;

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

  public attachWebLinkHandler(handler: LinkHandler): void {
    this._webLinkHandler = handler;
  }

  /**
   * Linkifies a row.
   * @param {number} rowIndex The index of the row to linkify.
   */
  private _linkifyRow(rowIndex: number): void {
    const rowHtml = this._rows[rowIndex].innerHTML;
    const uri = this._findLinkMatch(rowHtml);
    if (uri) {
      const link = '<a href="' + uri + '">' + uri + '</a>';
      const newHtml = rowHtml.replace(uri, link);
      this._rows[rowIndex].innerHTML = newHtml;
      console.log(this._rows[rowIndex].innerHTML);
    }
  }

  /**
   * Finds a link match in a piece of HTML.
   * @param {string} html The HTML to search.
   * @return The matching URI or null if not found.
   */
  private _findLinkMatch(html): string {
    const match = html.match(strictUrlRegex);
    if (!match || match.length === 0) {
      return null;
    }
    return match[1];
  }
}
