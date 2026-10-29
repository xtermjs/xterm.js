/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IProgramStatusRecord } from '@xterm/addon-program-status';

/**
 * A `state=clear` report. It removes the record at `id` and every record beneath it.
 */
export interface IProgramStatusClear {
  readonly state: 'clear';
  readonly id: string;
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * The spec's limits. All are UTF-8 byte counts except `PROGRESS`.
 */
const enum Limits {
  /**
   * The whole sequence may take 4096 bytes, and `ESC ] 7501 ;` and `ESC \` take 9 of them.
   */
  PAYLOAD = 4087,
  /**
   * The longest key, including keys the addon doesn't know.
   */
  KEY = 16,
  /**
   * The longest `msg` value as sent, in base64.
   */
  MSG_ENCODED = 2732,
  /**
   * The longest `msg` text once decoded from base64.
   */
  MSG_DECODED = 2048,
  /**
   * The longest `title` value as sent, in base64.
   */
  TITLE_ENCODED = 256,
  /**
   * The longest `title` text once decoded from base64.
   */
  TITLE_DECODED = 192,
  /**
   * The longest `app` value.
   */
  APP = 32,
  /**
   * The longest `id` value, including every `/` separated segment.
   */
  ID = 128,
  /**
   * The highest `progress` value, as a percentage.
   */
  PROGRESS = 100
}

const TEXT_LIMITS = {
  title: { encoded: Limits.TITLE_ENCODED, decoded: Limits.TITLE_DECODED },
  msg: { encoded: Limits.MSG_ENCODED, decoded: Limits.MSG_DECODED }
} as const;

// The spec's grammar for a value and for `app`.
const VALUE_REX = /^[A-Za-z0-9_.,+\/=-]*$/;
const APP_REX = /^[A-Za-z0-9_.+-]{1,32}$/;
// One to eight segments joined by `/`. Eight segments of 32 characters make 263, so the 128-byte
// limit on the whole id needs its own check.
const ID_REX = /^[A-Za-z0-9_.+-]{1,32}(?:\/[A-Za-z0-9_.+-]{1,32}){0,7}$/;
// Leading zeros, then one to three digits. The bound makes a long run of digits fail at once.
const PROGRESS_REX = /^0*([0-9]{1,3})$/;
const BASE64_REX = /^[A-Za-z0-9+\/]*={0,2}$/;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const CONTROL_REX = /\p{Control}/u;

/**
 * The last readable value of each key that the addon knows, with `title` and `msg` decoded.
 */
interface IReportValues {
  state?: string;
  id?: string;
  kind?: string;
  progress?: string;
  app?: string;
  title?: string;
  msg?: string;
}

/**
 * Parses the data of an OSC 7501 report.
 * @returns The record the report describes, a clear request, or undefined if the report is
 * discarded.
 */
export function parseProgramStatusReport(data: string): IProgramStatusRecord | IProgramStatusClear | undefined {
  // A UTF-16 code unit takes at least one byte in UTF-8, so a string this long is over the limit.
  if (data.length > Limits.PAYLOAD || utf8Length(data) > Limits.PAYLOAD) {
    return undefined;
  }
  const values = readValues(data);
  return values && createReport(values);
}

/**
 * Reads every pair, skipping malformed pairs and keys the addon doesn't know.
 * @returns The values, or undefined if a pair breaks a limit or has a malformed id or text that
 * doesn't decode.
 */
function readValues(data: string): IReportValues | undefined {
  const values: IReportValues = {};
  for (const pair of data.split(':')) {
    const equals = pair.indexOf('=');
    if (equals === -1) {
      continue;
    }
    const key = trim(pair.slice(0, equals));
    if (!isKnownKey(key)) {
      // Unknown and malformed keys are skipped before their values are read, but the key limit
      // still applies to them.
      if (utf8Length(key) > Limits.KEY) {
        return undefined;
      }
      continue;
    }
    const value = trim(pair.slice(equals + 1));
    switch (key) {
      case 'state':
      case 'kind':
      case 'progress':
        if (VALUE_REX.test(value)) {
          values[key] = value;
        }
        break;
      case 'id':
        // A report without an id updates the root record, so a malformed id discards the report
        // instead of being skipped. A valid id is ASCII, so its length is its size in bytes.
        if (value.length > Limits.ID || !ID_REX.test(value)) {
          return undefined;
        }
        values.id = value;
        break;
      case 'app': {
        const readable = VALUE_REX.test(value);
        if (isOverLimit(value, readable, Limits.APP)) {
          return undefined;
        }
        if (readable) {
          values.app = value;
        }
        break;
      }
      case 'title':
      case 'msg': {
        const limits = TEXT_LIMITS[key];
        const readable = VALUE_REX.test(value);
        if (isOverLimit(value, readable, limits.encoded)) {
          return undefined;
        }
        if (readable) {
          const text = decodeBase64Text(value, limits.decoded);
          if (text === undefined) {
            return undefined;
          }
          values[key] = text;
        }
        break;
      }
    }
  }
  return values;
}

function isKnownKey(key: string): key is keyof IReportValues {
  switch (key) {
    case 'state':
    case 'id':
    case 'kind':
    case 'progress':
    case 'app':
    case 'title':
    case 'msg':
      return true;
  }
  return false;
}

/**
 * Builds the report that the values describe.
 * @returns The frozen record, a clear request, or undefined if the state is missing or unknown.
 */
function createReport(values: IReportValues): IProgramStatusRecord | IProgramStatusClear | undefined {
  const { state, id = '' } = values;
  if (state === 'clear') {
    return { state, id };
  }
  if (!isState(state)) {
    return undefined;
  }
  const record: Mutable<IProgramStatusRecord> = { id, state };
  if (state === 'blocked' && isKind(values.kind)) {
    record.kind = values.kind;
  }
  if ((state === 'working' || state === 'blocked') && values.progress !== undefined) {
    const progress = parseProgress(values.progress);
    if (progress !== undefined) {
      record.progress = progress;
    }
  }
  if (values.app !== undefined && APP_REX.test(values.app)) {
    record.app = values.app;
  }
  if (values.title !== undefined) {
    record.title = values.title;
  }
  if (values.msg !== undefined) {
    record.message = values.msg;
  }
  return Object.freeze(record);
}

/**
 * Removes ASCII whitespace from both ends. `String.prototype.trim` also removes other Unicode
 * spaces, and a regex such as `/\s+$/` takes quadratic time on a long run of spaces. The loop reads
 * char codes because WebKit compares one-character strings several times slower.
 */
function trim(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && isAsciiWhitespace(text.charCodeAt(start))) {
    start++;
  }
  while (end > start && isAsciiWhitespace(text.charCodeAt(end - 1))) {
    end--;
  }
  return text.slice(start, end);
}

/**
 * Space, or a code from `\t` (0x09) to `\r` (0x0D).
 */
function isAsciiWhitespace(code: number): boolean {
  return code === 0x20 || (code <= 0x0D && code >= 0x09);
}

/**
 * Whether a value is over `limit` UTF-8 bytes. The value set is ASCII, so a readable value's
 * length is its size.
 */
function isOverLimit(value: string, readable: boolean, limit: number): boolean {
  return (readable ? value.length : utf8Length(value)) > limit;
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

interface IUint8ArrayFromBase64 extends Uint8Array {
  setFromBase64(text: string): { read: number, written: number };
}

let decodeBuffer: IUint8ArrayFromBase64 | undefined;
let utf8Decoder: TextDecoder | undefined;

/**
 * Decodes a `title` or `msg` value: standard base64, padding optional, of UTF-8 text without
 * control characters and of at most `maxBytes` bytes. Only the canonical encoding of the text is
 * accepted.
 */
function decodeBase64Text(value: string, maxBytes: number): string | undefined {
  // atob and setFromBase64 throw on any other shape, and a throw costs microseconds.
  if (value.length % 4 === 1 || (value.endsWith('=') && value.length % 4 !== 0) || !BASE64_REX.test(value)) {
    return undefined;
  }
  const contentLength = value.length - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
  // setFromBase64 stops without an error once the buffer is full, so the size check comes first.
  if ((contentLength * 3) >> 2 > maxBytes) {
    return undefined;
  }
  // The last character before any padding has leftover bits, 4 after 4n+2 characters and 2 after
  // 4n+3. atob and setFromBase64 ignore them, and only the canonical encoding has them all zero.
  // setFromBase64's strict mode checks them, but it also refuses input without padding.
  const leftoverMask = contentLength % 4 === 2 ? 0xF : contentLength % 4 === 3 ? 0x3 : 0;
  if (leftoverMask !== 0 && (BASE64_ALPHABET.indexOf(value[contentLength - 1]) & leftoverMask) !== 0) {
    return undefined;
  }
  let bytes: Uint8Array;
  if ((Uint8Array.prototype as IUint8ArrayFromBase64).setFromBase64 !== undefined) {
    // Reusing one buffer is cheaper than the new buffer that fromBase64 allocates for each value.
    decodeBuffer ??= new Uint8Array(Math.max(Limits.MSG_DECODED, Limits.TITLE_DECODED)) as IUint8ArrayFromBase64;
    bytes = decodeBuffer.subarray(0, decodeBuffer.setFromBase64(value).written);
  } else {
    const binary = atob(value);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  }
  let text: string;
  try {
    utf8Decoder ??= new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
    text = utf8Decoder.decode(bytes);
  } catch {
    return undefined;
  }
  return CONTROL_REX.test(text) ? undefined : text;
}

function isState(value: string | undefined): value is IProgramStatusRecord['state'] {
  return value === 'idle' || value === 'working' || value === 'done' || value === 'blocked' || value === 'error';
}

function isKind(value: string | undefined): value is NonNullable<IProgramStatusRecord['kind']> {
  return value === 'permission' || value === 'question' || value === 'auth';
}

/**
 * Reads a whole number from 0 to 100, leading zeros allowed. Anything else counts as absent.
 */
function parseProgress(value: string): number | undefined {
  const digits = PROGRESS_REX.exec(value)?.[1];
  if (digits === undefined) {
    return undefined;
  }
  const progress = Number(digits);
  return progress <= Limits.PROGRESS ? progress : undefined;
}
