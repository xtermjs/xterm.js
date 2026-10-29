/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IProgramStatusRecord } from '@xterm/addon-program-status';

type ProgramStatusState = IProgramStatusRecord['state'];
type ProgramStatusKind = NonNullable<IProgramStatusRecord['kind']>;
type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * Byte limits are counted in UTF-8.
 */
const enum Limits {
  /**
   * The whole sequence may take 4096 bytes, of which `ESC ] 7501 ;` and `ESC \` take 9.
   */
  PAYLOAD = 4087,
  KEY = 16,
  MSG_ENCODED = 2732,
  MSG_DECODED = 2048,
  TITLE_ENCODED = 256,
  TITLE_DECODED = 192,
  APP = 32,
  ID = 128,
  ID_LEVELS = 8,
  SEGMENT = 32,
  RECORDS = 256,
  PROGRESS = 100
}

export type ProgramStatusReport =
  { readonly clear: true, readonly id: string } |
  { readonly clear: false, readonly record: IProgramStatusRecord };

interface IFields {
  app?: string;
  id?: string;
  kind?: string;
  msg?: string;
  progress?: string;
  state?: string;
  title?: string;
}

/**
 * Parses the payload of an OSC 7501 report. Returns undefined when the report
 * must be discarded whole.
 */
export function parseProgramStatusReport(data: string): ProgramStatusReport | undefined {
  // UTF-8 never takes fewer bytes than UTF-16 takes code units.
  if (data.length > Limits.PAYLOAD || utf8Length(data) > Limits.PAYLOAD) {
    return undefined;
  }
  const fields: IFields = {};
  for (const pair of data.split(':')) {
    const equal = pair.indexOf('=');
    if (equal === -1) {
      continue;
    }
    const key = trim(pair.slice(0, equal));
    const value = trim(pair.slice(equal + 1));
    if (utf8Length(key) > Limits.KEY) {
      return undefined;
    }
    if (!isKey(key)) {
      continue;
    }
    const encodedLimit = getEncodedLimit(key);
    if (encodedLimit !== undefined && utf8Length(value) > encodedLimit) {
      return undefined;
    }
    // A malformed id must never select the root record.
    if (key === 'id' && !isId(value)) {
      return undefined;
    }
    if (!isValue(value)) {
      continue;
    }
    switch (key) {
      case 'msg':
      case 'title': {
        const text = decodeText(value, key === 'msg' ? Limits.MSG_DECODED : Limits.TITLE_DECODED);
        if (text === undefined) {
          return undefined;
        }
        fields[key] = text;
        break;
      }
      case 'app':
      case 'id':
      case 'kind':
      case 'progress':
      case 'state':
        fields[key] = value;
        break;
    }
  }

  const id = fields.id ?? '';
  if (fields.state === 'clear') {
    return { clear: true, id };
  }
  const state = fields.state;
  if (!isState(state)) {
    return undefined;
  }
  const record: Mutable<IProgramStatusRecord> = { id, state };
  if (state === 'blocked' && isKind(fields.kind)) {
    record.kind = fields.kind;
  }
  if (state === 'working' || state === 'blocked') {
    const progress = parseProgress(fields.progress);
    if (progress !== undefined) {
      record.progress = progress;
    }
  }
  if (fields.app !== undefined && isSegment(fields.app)) {
    record.app = fields.app;
  }
  if (fields.title !== undefined) {
    record.title = fields.title;
  }
  if (fields.msg !== undefined) {
    record.message = fields.msg;
  }
  return { clear: false, record: Object.freeze(record) };
}

/**
 * The records of one terminal, keyed by id.
 */
export class ProgramStatusStore {
  // A Map iterates in insertion order, so the first key was updated least recently.
  private readonly _records = new Map<string, IProgramStatusRecord>();
  private _snapshot: ReadonlyArray<IProgramStatusRecord> | undefined;

  /**
   * The records from the oldest update to the newest, with `effectiveApp` filled in.
   */
  public get records(): ReadonlyArray<IProgramStatusRecord> {
    this._snapshot ??= Object.freeze(Array.from(this._records.values(), record => {
      const effectiveApp = this._getEffectiveApp(record.id);
      return effectiveApp === undefined ? record : Object.freeze({ ...record, effectiveApp });
    }));
    return this._snapshot;
  }

  public replace(record: IProgramStatusRecord): void {
    if (!this._records.delete(record.id) && this._records.size >= Limits.RECORDS) {
      const oldest = this._records.keys().next();
      if (!oldest.done) {
        this._records.delete(oldest.value);
      }
    }
    this._records.set(record.id, record);
    this._snapshot = undefined;
  }

  /**
   * Removes a record and its descendants. The empty id removes every record.
   * @returns Whether any record was removed.
   */
  public clear(id: string): boolean {
    const prefix = id + '/';
    return this._remove(record => id === '' || record.id === id || record.id.startsWith(prefix));
  }

  /**
   * Removes `working` and `blocked` records.
   * @returns Whether any record was removed.
   */
  public removeActiveRecords(): boolean {
    return this._remove(record => record.state === 'working' || record.state === 'blocked');
  }

  private _remove(predicate: (record: IProgramStatusRecord) => boolean): boolean {
    let removed = false;
    for (const [id, record] of this._records) {
      if (predicate(record)) {
        this._records.delete(id);
        removed = true;
      }
    }
    if (removed) {
      this._snapshot = undefined;
    }
    return removed;
  }

  private _getEffectiveApp(id: string): string | undefined {
    for (let ancestor: string | undefined = id; ancestor !== undefined; ancestor = getParentId(ancestor)) {
      const app = this._records.get(ancestor)?.app;
      if (app !== undefined) {
        return app;
      }
    }
    return undefined;
  }
}

function getParentId(id: string): string | undefined {
  if (id === '') {
    return undefined;
  }
  const slash = id.lastIndexOf('/');
  return slash === -1 ? '' : id.slice(0, slash);
}

function getEncodedLimit(key: string): number | undefined {
  switch (key) {
    case 'msg': return Limits.MSG_ENCODED;
    case 'title': return Limits.TITLE_ENCODED;
    case 'app': return Limits.APP;
    case 'id': return Limits.ID;
  }
  return undefined;
}

function isState(value: string | undefined): value is ProgramStatusState {
  return value === 'idle' || value === 'working' || value === 'done' || value === 'blocked' || value === 'error';
}

function isKind(value: string | undefined): value is ProgramStatusKind {
  return value === 'permission' || value === 'question' || value === 'auth';
}

/**
 * Digits only, leading zeros allowed. Anything else, or a number past 100, is treated as absent.
 */
function parseProgress(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  let progress = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x30 || code > 0x39) {
      return undefined;
    }
    progress = progress * 10 + code - 0x30;
    if (progress > Limits.PROGRESS) {
      return undefined;
    }
  }
  return progress;
}

function isWhitespace(code: number): boolean {
  return code === 0x20 || (code >= 0x09 && code <= 0x0D);
}

function trim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isWhitespace(value.charCodeAt(start))) {
    start++;
  }
  while (end > start && isWhitespace(value.charCodeAt(end - 1))) {
    end--;
  }
  return value.slice(start, end);
}

function isAlphanumeric(code: number): boolean {
  return (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A) || (code >= 0x30 && code <= 0x39);
}

/**
 * `[a-z]+`
 */
function isKey(key: string): boolean {
  if (!key) {
    return false;
  }
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (code < 0x61 || code > 0x7A) {
      return false;
    }
  }
  return true;
}

/**
 * `[A-Za-z0-9_.,+/=-]*`
 */
function isValue(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // _ . , + / = -
    if (!isAlphanumeric(code) && code !== 0x5F && code !== 0x2E && code !== 0x2C && code !== 0x2B && code !== 0x2F && code !== 0x3D && code !== 0x2D) {
      return false;
    }
  }
  return true;
}

/**
 * `[A-Za-z0-9_.+-]{1,32}`
 */
function isSegment(segment: string): boolean {
  if (segment.length < 1 || segment.length > Limits.SEGMENT) {
    return false;
  }
  for (let i = 0; i < segment.length; i++) {
    const code = segment.charCodeAt(i);
    // _ . + -
    if (!isAlphanumeric(code) && code !== 0x5F && code !== 0x2E && code !== 0x2B && code !== 0x2D) {
      return false;
    }
  }
  return true;
}

/**
 * Segments joined by `/`, at most 8 levels and 128 bytes.
 */
function isId(id: string): boolean {
  if (!id || utf8Length(id) > Limits.ID) {
    return false;
  }
  const segments = id.split('/');
  return segments.length <= Limits.ID_LEVELS && segments.every(isSegment);
}

function utf8Length(value: string): number {
  let length = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      length += 1;
    } else if (code < 0x800) {
      length += 2;
    } else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < value.length && (value.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
      length += 4;
      i++;
    } else {
      length += 3;
    }
  }
  return length;
}

function getBase64Value(code: number): number {
  if (code >= 0x41 && code <= 0x5A) return code - 0x41;
  if (code >= 0x61 && code <= 0x7A) return code - 0x61 + 26;
  if (code >= 0x30 && code <= 0x39) return code - 0x30 + 52;
  if (code === 0x2B) return 62;
  if (code === 0x2F) return 63;
  return -1;
}

let utf8Decoder: TextDecoder | undefined;

/**
 * Decodes standard base64 with optional padding into UTF-8 text without control characters.
 */
function decodeText(value: string, limit: number): string | undefined {
  let contentLength = value.indexOf('=');
  if (contentLength === -1) {
    contentLength = value.length;
  }
  const padding = value.length - contentLength;
  const remainder = contentLength % 4;
  if (remainder === 1 || padding > 2) {
    return undefined;
  }
  for (let i = contentLength; i < value.length; i++) {
    if (value.charCodeAt(i) !== 0x3D) {
      return undefined;
    }
  }
  if (padding !== 0 && (value.length % 4 !== 0 || padding !== 4 - remainder)) {
    return undefined;
  }

  const bytes = new Uint8Array(Math.floor(contentLength * 3 / 4));
  let length = 0;
  let bits = 0;
  let bitCount = 0;
  for (let i = 0; i < contentLength; i++) {
    const sextet = getBase64Value(value.charCodeAt(i));
    if (sextet === -1) {
      return undefined;
    }
    bits = (bits << 6) | sextet;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      if (length === limit) {
        return undefined;
      }
      bytes[length++] = (bits >> bitCount) & 0xFF;
      bits &= (1 << bitCount) - 1;
    }
  }
  if (bits !== 0) {
    return undefined;
  }

  let text: string;
  try {
    utf8Decoder ??= new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    text = utf8Decoder.decode(bytes.subarray(0, length));
  } catch {
    return undefined;
  }
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // C0, DEL and C1
    if (code <= 0x1F || (code >= 0x7F && code <= 0x9F)) {
      return undefined;
    }
  }
  return text;
}
