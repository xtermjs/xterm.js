/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILinkifierEvent, ILinkMatcher, LinkMatcherHandler, ILinkMatcherOptions, ILinkifier, IMouseZoneManager, IMouseZone, IRegisteredLinkMatcher } from 'browser/Types';
import { IBufferStringIteratorResult } from 'common/buffer/Types';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { ILogService, IBufferService, IOptionsService, IUnicodeService } from 'common/services/Services';

/**
 * Limit of the unwrapping line expansion (overscan) at the top and bottom
 * of the actual viewport in ASCII characters.
 * A limit of 2000 should match most sane urls.
 */
const OVERSCAN_CHAR_LIMIT = 2000;

/**
 * The Linkifier applies links to rows shortly after they have been refreshed.
 */
export class Linkifier implements ILinkifier {
  /**
   * The time to wait after a row is changed before it is linkified. This prevents
   * the costly operation of searching every row multiple times, potentially a
   * huge amount of times.
   */
  protected static _timeBeforeLatency = 200;

  protected _linkMatchers: IRegisteredLinkMatcher[] = [];

  private _mouseZoneManager: IMouseZoneManager | undefined;
  private _element: HTMLElement | undefined;

  private _rowsTimeoutId: number | undefined;
  private _nextLinkMatcherId = 0;
  private _rowsToLinkify: { start: number | undefined, end: number | undefined };

  private _onLinkHover = new EventEmitter<ILinkifierEvent>();
  public get onLinkHover(): IEvent<ILinkifierEvent> { return this._onLinkHover.event; }
  private _onLinkLeave = new EventEmitter<ILinkifierEvent>();
  public get onLinkLeave(): IEvent<ILinkifierEvent> { return this._onLinkLeave.event; }
  private _onLinkTooltip = new EventEmitter<ILinkifierEvent>();
  public get onLinkTooltip(): IEvent<ILinkifierEvent> { return this._onLinkTooltip.event; }

  constructor(
    protected readonly _bufferService: IBufferService,
    private readonly _logService: ILogService,
    private readonly _optionsService: IOptionsService,
    private readonly _unicodeService: IUnicodeService
  ) {
    this._rowsToLinkify = {
      start: undefined,
      end: undefined
    };
  }

  /**
   * Attaches the linkifier to the DOM, enabling linkification.
   * @param mouseZoneManager The mouse zone manager to register link zones with.
   */
  public attachToDom(element: HTMLElement, mouseZoneManager: IMouseZoneManager): void {
    this._element = element;
    this._mouseZoneManager = mouseZoneManager;
  }

  /**
   * Queue linkification on a set of rows.
   * @param start The row to linkify from (inclusive).
   * @param end The row to linkify to (inclusive).
   */
  public linkifyRows(start: number, end: number): void {
    // Don't attempt linkify if not yet attached to DOM
    if (!this._mouseZoneManager) {
      return;
    }

    // Increase range to linkify
    if (this._rowsToLinkify.start === undefined || this._rowsToLinkify.end === undefined) {
      this._rowsToLinkify.start = start;
      this._rowsToLinkify.end = end;
    } else {
      this._rowsToLinkify.start = Math.min(this._rowsToLinkify.start, start);
      this._rowsToLinkify.end = Math.max(this._rowsToLinkify.end, end);
    }

    // Clear out any existing links on this row range
    this._mouseZoneManager.clearAll(start, end);

    // Restart timer
    if (this._rowsTimeoutId) {
      clearTimeout(this._rowsTimeoutId);
    }
    this._rowsTimeoutId = <number><any>setTimeout(() => this._linkifyRows(), Linkifier._timeBeforeLatency);
  }

  /**
   * Linkifies the rows requested.
   */
  private _linkifyRows(): void {
    this._rowsTimeoutId = undefined;
    const buffer = this._bufferService.buffer;

    if (this._rowsToLinkify.start === undefined || this._rowsToLinkify.end === undefined) {
      this._logService.debug('_rowToLinkify was unset before _linkifyRows was called');
      return;
    }

    // Ensure the start row exists
    const absoluteRowIndexStart = buffer.ydisp + this._rowsToLinkify.start;
    if (absoluteRowIndexStart >= buffer.lines.length) {
      return;
    }

    // Invalidate bad end row values (if a resize happened)
    const absoluteRowIndexEnd = buffer.ydisp + Math.min(this._rowsToLinkify.end, this._bufferService.rows) + 1;

    // Iterate over the range of unwrapped content strings within start..end
    // (excluding).
    // _doLinkifyRow gets full unwrapped lines with the start row as buffer offset
    // for every matcher.
    // The unwrapping is needed to also match content that got wrapped across
    // several buffer lines. To avoid a worst case scenario where the whole buffer
    // contains just a single unwrapped string we limit this line expansion beyond
    // the viewport to +OVERSCAN_CHAR_LIMIT chars (overscan) at top and bottom.
    // This comes with the tradeoff that matches longer than OVERSCAN_CHAR_LIMIT
    // chars will not match anymore at the viewport borders.
    const overscanLineLimit = Math.ceil(OVERSCAN_CHAR_LIMIT / this._bufferService.cols);
    const iterator = this._bufferService.buffer.iterator(
      false, absoluteRowIndexStart, absoluteRowIndexEnd, overscanLineLimit, overscanLineLimit);
    while (iterator.hasNext()) {
      const lineData: IBufferStringIteratorResult = iterator.next();
      for (let i = 0; i < this._linkMatchers.length; i++) {
        this._doLinkifyRow(lineData.range.first, lineData.content, this._linkMatchers[i]);
      }
    }

    this._rowsToLinkify.start = undefined;
    this._rowsToLinkify.end = undefined;
  }

  /**
   * Registers a link matcher, allowing custom link patterns to be matched and
   * handled.
   * @param regex The regular expression to search for. Specifically, this
   * searches the textContent of the rows. You will want to use \s to match a
   * space ' ' character for example.
   * @param handler The callback when the link is called.
   * @param options Options for the link matcher.
   * @return The ID of the new matcher, this can be used to deregister.
   */
  public registerLinkMatcher(regex: RegExp, handler: LinkMatcherHandler, options: ILinkMatcherOptions = {}): number {
    if (!handler) {
      throw new Error('handler must be defined');
    }
    const matcher: IRegisteredLinkMatcher = {
      id: this._nextLinkMatcherId++,
      regex,
      handler,
      matchIndex: options.matchIndex,
      validationCallback: options.validationCallback,
      hoverTooltipCallback: options.tooltipCallback,
      hoverLeaveCallback: options.leaveCallback,
      willLinkActivate: options.willLinkActivate,
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
  private _addLinkMatcherToList(matcher: IRegisteredLinkMatcher): void {
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
   * @param matcherId The link matcher's ID (returned after register)
   * @return Whether a link matcher was found and deregistered.
   */
  public deregisterLinkMatcher(matcherId: number): boolean {
    for (let i = 0; i < this._linkMatchers.length; i++) {
      if (this._linkMatchers[i].id === matcherId) {
        this._linkMatchers.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Linkifies a row given a specific handler.
   * @param rowIndex The row index to linkify (absolute index).
   * @param text string content of the unwrapped row.
   * @param matcher The link matcher for this line.
   */
  private _doLinkifyRow(rowIndex: number, text: string, matcher: ILinkMatcher): void {
    // clone regex to do a global search on text
    const rex = new RegExp(matcher.regex.source, (matcher.regex.flags || '') + 'g');
    let match;
    let stringIndex = -1;
    while ((match = rex.exec(text)) !== null) {
      const uri = match[typeof matcher.matchIndex !== 'number' ? 0 : matcher.matchIndex];
      if (!uri) {
        // something matched but does not comply with the given matchIndex
        // since this is most likely a bug the regex itself we simply do nothing here
        this._logService.debug('match found without corresponding matchIndex', match, matcher);
        break;
      }

      // Get index, match.index is for the outer match which includes negated chars
      // therefore we cannot use match.index directly, instead we search the position
      // of the match group in text again
      // also correct regex and string search offsets for the next loop run
      stringIndex = text.indexOf(uri, stringIndex + 1);
      rex.lastIndex = stringIndex + uri.length;
      if (stringIndex < 0) {
        // invalid stringIndex (should not have happened)
        break;
      }

      // get the buffer index as [absolute row, col] for the match
      const bufferIndex = this._bufferService.buffer.stringIndexToBufferIndex(rowIndex, stringIndex);
      if (bufferIndex[0] < 0) {
        // invalid bufferIndex (should not have happened)
        break;
      }

      const line = this._bufferService.buffer.lines.get(bufferIndex[0]);
      if (!line) {
        break;
      }

      const attr = line.getFg(bufferIndex[1]);
      const fg = attr ? (attr >> 9) & 0x1ff : undefined;

      if (matcher.validationCallback) {
        matcher.validationCallback(uri, isValid => {
          // Discard link if the line has already changed
          if (this._rowsTimeoutId) {
            return;
          }
          if (isValid) {
            this._addLink(bufferIndex[1], bufferIndex[0] - this._bufferService.buffer.ydisp, uri, matcher, fg);
          }
        });
      } else {
        this._addLink(bufferIndex[1], bufferIndex[0] - this._bufferService.buffer.ydisp, uri, matcher, fg);
      }
    }
  }

  /**
   * Registers a link to the mouse zone manager.
   * @param x The column the link starts.
   * @param y The row the link is on.
   * @param uri The URI of the link.
   * @param matcher The link matcher for the link.
   * @param fg The link color for hover event.
   */
  private _addLink(x: number, y: number, uri: string, matcher: ILinkMatcher, fg: number | undefined): void {
    if (!this._mouseZoneManager || !this._element) {
      return;
    }
    // FIXME: get cell length from buffer to avoid mismatch after Unicode version change
    const width = this._unicodeService.getStringCellWidth(uri);
    const x1 = x % this._bufferService.cols;
    const y1 = y + Math.floor(x / this._bufferService.cols);
    let x2 = (x1 + width) % this._bufferService.cols;
    let y2 = y1 + Math.floor((x1 + width) / this._bufferService.cols);
    if (x2 === 0) {
      x2 = this._bufferService.cols;
      y2--;
    }

    this._mouseZoneManager.add(new MouseZone(
      x1 + 1,
      y1 + 1,
      x2 + 1,
      y2 + 1,
      e => {
        if (matcher.handler) {
          return matcher.handler(e, uri);
        }
        const newWindow = window.open();
        if (newWindow) {
          newWindow.opener = null;
          newWindow.location.href = uri;
        } else {
          console.warn('Opening link blocked as opener could not be cleared');
        }
      },
      () => {
        this._onLinkHover.fire(this._createLinkHoverEvent(x1, y1, x2, y2, fg));
        this._element!.classList.add('xterm-cursor-pointer');
      },
      e => {
        this._onLinkTooltip.fire(this._createLinkHoverEvent(x1, y1, x2, y2, fg));
        if (matcher.hoverTooltipCallback) {
          // Note that IViewportRange use 1-based coordinates to align with escape sequences such
          // as CUP which use 1,1 as the default for row/col
          matcher.hoverTooltipCallback(e, uri, { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
        }
      },
      () => {
        this._onLinkLeave.fire(this._createLinkHoverEvent(x1, y1, x2, y2, fg));
        this._element!.classList.remove('xterm-cursor-pointer');
        if (matcher.hoverLeaveCallback) {
          matcher.hoverLeaveCallback();
        }
      },
      e => {
        if (matcher.willLinkActivate) {
          return matcher.willLinkActivate(e, uri);
        }
        return true;
      }
    ));
  }

  private _createLinkHoverEvent(x1: number, y1: number, x2: number, y2: number, fg: number | undefined): ILinkifierEvent {
    return { x1, y1, x2, y2, cols: this._bufferService.cols, fg };
  }
}

export class MouseZone implements IMouseZone {
  constructor(
    public x1: number,
    public y1: number,
    public x2: number,
    public y2: number,
    public clickCallback: (e: MouseEvent) => any,
    public hoverCallback: (e: MouseEvent) => any,
    public tooltipCallback: (e: MouseEvent) => any,
    public leaveCallback: () => void,
    public willLinkActivate: (e: MouseEvent) => boolean
  ) {
  }
}
