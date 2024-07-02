/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CharCode } from 'vs/base/common/charCode';
import { Constants } from 'vs/base/common/uint';

export function isFalsyOrWhitespace(str: string | undefined): boolean {
	if (!str || typeof str !== 'string') {
		return true;
	}
	return str.trim().length === 0;
}

const _formatRegexp = /{(\d+)}/g;

/**
 * Helper to produce a string with a variable number of arguments. Insert variable segments
 * into the string using the {n} notation where N is the index of the argument following the string.
 * @param value string to which formatting is applied
 * @param args replacements for {n}-entries
 */
export function format(value: string, ...args: any[]): string {
	if (args.length === 0) {
		return value;
	}
	return value.replace(_formatRegexp, function (match, group) {
		const idx = parseInt(group, 10);
		return isNaN(idx) || idx < 0 || idx >= args.length ?
			match :
			args[idx];
	});
}

const _format2Regexp = /{([^}]+)}/g;

/**
 * Helper to create a string from a template and a string record.
 * Similar to `format` but with objects instead of positional arguments.
 */
export function format2(template: string, values: Record<string, unknown>): string {
	if (Object.keys(values).length === 0) {
		return template;
	}
	return template.replace(_format2Regexp, (match, group) => (values[group] ?? match) as string);
}

/**
 * Encodes the given value so that it can be used as literal value in html attributes.
 *
 * In other words, computes `$val`, such that `attr` in `<div attr="$val" />` has the runtime value `value`.
 * This prevents XSS injection.
 */
export function htmlAttributeEncodeValue(value: string): string {
	return value.replace(/[<>"'&]/g, ch => {
		switch (ch) {
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '"': return '&quot;';
			case '\'': return '&apos;';
			case '&': return '&amp;';
		}
		return ch;
	});
}

/**
 * Converts HTML characters inside the string to use entities instead. Makes the string safe from
 * being used e.g. in HTMLElement.innerHTML.
 */
export function escape(html: string): string {
	return html.replace(/[<>&]/g, function (match) {
		switch (match) {
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '&': return '&amp;';
			default: return match;
		}
	});
}

/**
 * Escapes regular expression characters in a given string
 */
export function escapeRegExpCharacters(value: string): string {
	return value.replace(/[\\\{\}\*\+\?\|\^\$\.\[\]\(\)]/g, '\\$&');
}

/**
 * Counts how often `substr` occurs inside `value`.
 */
export function count(value: string, substr: string): number {
	let result = 0;
	let index = value.indexOf(substr);
	while (index !== -1) {
		result++;
		index = value.indexOf(substr, index + substr.length);
	}
	return result;
}

export function truncate(value: string, maxLength: number, suffix = '…'): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.substr(0, maxLength)}${suffix}`;
}

export function truncateMiddle(value: string, maxLength: number, suffix = '…'): string {
	if (value.length <= maxLength) {
		return value;
	}

	const prefixLength = Math.ceil(maxLength / 2) - suffix.length / 2;
	const suffixLength = Math.floor(maxLength / 2) - suffix.length / 2;

	return `${value.substr(0, prefixLength)}${suffix}${value.substr(value.length - suffixLength)}`;
}

/**
 * Removes all occurrences of needle from the beginning and end of haystack.
 * @param haystack string to trim
 * @param needle the thing to trim (default is a blank)
 */
export function trim(haystack: string, needle: string = ' '): string {
	const trimmed = ltrim(haystack, needle);
	return rtrim(trimmed, needle);
}

/**
 * Removes all occurrences of needle from the beginning of haystack.
 * @param haystack string to trim
 * @param needle the thing to trim
 */
export function ltrim(haystack: string, needle: string): string {
	if (!haystack || !needle) {
		return haystack;
	}

	const needleLen = needle.length;
	if (needleLen === 0 || haystack.length === 0) {
		return haystack;
	}

	let offset = 0;

	while (haystack.indexOf(needle, offset) === offset) {
		offset = offset + needleLen;
	}
	return haystack.substring(offset);
}

/**
 * Removes all occurrences of needle from the end of haystack.
 * @param haystack string to trim
 * @param needle the thing to trim
 */
export function rtrim(haystack: string, needle: string): string {
	if (!haystack || !needle) {
		return haystack;
	}

	const needleLen = needle.length,
		haystackLen = haystack.length;

	if (needleLen === 0 || haystackLen === 0) {
		return haystack;
	}

	let offset = haystackLen,
		idx = -1;

	while (true) {
		idx = haystack.lastIndexOf(needle, offset - 1);
		if (idx === -1 || idx + needleLen !== offset) {
			break;
		}
		if (idx === 0) {
			return '';
		}
		offset = idx;
	}

	return haystack.substring(0, offset);
}

export function convertSimple2RegExpPattern(pattern: string): string {
	return pattern.replace(/[\-\\\{\}\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, '\\$&').replace(/[\*]/g, '.*');
}

export function stripWildcards(pattern: string): string {
	return pattern.replace(/\*/g, '');
}

export interface RegExpOptions {
	matchCase?: boolean;
	wholeWord?: boolean;
	multiline?: boolean;
	global?: boolean;
	unicode?: boolean;
}

export function createRegExp(searchString: string, isRegex: boolean, options: RegExpOptions = {}): RegExp {
	if (!searchString) {
		throw new Error('Cannot create regex from empty string');
	}
	if (!isRegex) {
		searchString = escapeRegExpCharacters(searchString);
	}
	if (options.wholeWord) {
		if (!/\B/.test(searchString.charAt(0))) {
			searchString = '\\b' + searchString;
		}
		if (!/\B/.test(searchString.charAt(searchString.length - 1))) {
			searchString = searchString + '\\b';
		}
	}
	let modifiers = '';
	if (options.global) {
		modifiers += 'g';
	}
	if (!options.matchCase) {
		modifiers += 'i';
	}
	if (options.multiline) {
		modifiers += 'm';
	}
	if (options.unicode) {
		modifiers += 'u';
	}

	return new RegExp(searchString, modifiers);
}

export function regExpLeadsToEndlessLoop(regexp: RegExp): boolean {
	// Exit early if it's one of these special cases which are meant to match
	// against an empty string
	if (regexp.source === '^' || regexp.source === '^$' || regexp.source === '$' || regexp.source === '^\\s*$') {
		return false;
	}

	// We check against an empty string. If the regular expression doesn't advance
	// (e.g. ends in an endless loop) it will match an empty string.
	const match = regexp.exec('');
	return !!(match && regexp.lastIndex === 0);
}

export function splitLines(str: string): string[] {
	return str.split(/\r\n|\r|\n/);
}

export function splitLinesIncludeSeparators(str: string): string[] {
	const linesWithSeparators: string[] = [];
	const splitLinesAndSeparators = str.split(/(\r\n|\r|\n)/);
	for (let i = 0; i < Math.ceil(splitLinesAndSeparators.length / 2); i++) {
		linesWithSeparators.push(splitLinesAndSeparators[2 * i] + (splitLinesAndSeparators[2 * i + 1] ?? ''));
	}
	return linesWithSeparators;
}

/**
 * Returns first index of the string that is not whitespace.
 * If string is empty or contains only whitespaces, returns -1
 */
export function firstNonWhitespaceIndex(str: string): number {
	for (let i = 0, len = str.length; i < len; i++) {
		const chCode = str.charCodeAt(i);
		if (chCode !== CharCode.Space && chCode !== CharCode.Tab) {
			return i;
		}
	}
	return -1;
}

/**
 * Returns the leading whitespace of the string.
 * If the string contains only whitespaces, returns entire string
 */
export function getLeadingWhitespace(str: string, start: number = 0, end: number = str.length): string {
	for (let i = start; i < end; i++) {
		const chCode = str.charCodeAt(i);
		if (chCode !== CharCode.Space && chCode !== CharCode.Tab) {
			return str.substring(start, i);
		}
	}
	return str.substring(start, end);
}

/**
 * Returns last index of the string that is not whitespace.
 * If string is empty or contains only whitespaces, returns -1
 */
export function lastNonWhitespaceIndex(str: string, startIndex: number = str.length - 1): number {
	for (let i = startIndex; i >= 0; i--) {
		const chCode = str.charCodeAt(i);
		if (chCode !== CharCode.Space && chCode !== CharCode.Tab) {
			return i;
		}
	}
	return -1;
}

/**
 * Function that works identically to String.prototype.replace, except, the
 * replace function is allowed to be async and return a Promise.
 */
export function replaceAsync(str: string, search: RegExp, replacer: (match: string, ...args: any[]) => Promise<string>): Promise<string> {
	const parts: (string | Promise<string>)[] = [];

	let last = 0;
	for (const match of str.matchAll(search)) {
		parts.push(str.slice(last, match.index));
		if (match.index === undefined) {
			throw new Error('match.index should be defined');
		}

		last = match.index + match[0].length;
		parts.push(replacer(match[0], ...match.slice(1), match.index, str, match.groups));
	}

	parts.push(str.slice(last));

	return Promise.all(parts).then(p => p.join(''));
}

export function compare(a: string, b: string): number {
	if (a < b) {
		return -1;
	} else if (a > b) {
		return 1;
	} else {
		return 0;
	}
}

export function compareSubstring(a: string, b: string, aStart: number = 0, aEnd: number = a.length, bStart: number = 0, bEnd: number = b.length): number {
	for (; aStart < aEnd && bStart < bEnd; aStart++, bStart++) {
		const codeA = a.charCodeAt(aStart);
		const codeB = b.charCodeAt(bStart);
		if (codeA < codeB) {
			return -1;
		} else if (codeA > codeB) {
			return 1;
		}
	}
	const aLen = aEnd - aStart;
	const bLen = bEnd - bStart;
	if (aLen < bLen) {
		return -1;
	} else if (aLen > bLen) {
		return 1;
	}
	return 0;
}

export function compareIgnoreCase(a: string, b: string): number {
	return compareSubstringIgnoreCase(a, b, 0, a.length, 0, b.length);
}

export function compareSubstringIgnoreCase(a: string, b: string, aStart: number = 0, aEnd: number = a.length, bStart: number = 0, bEnd: number = b.length): number {

	for (; aStart < aEnd && bStart < bEnd; aStart++, bStart++) {

		let codeA = a.charCodeAt(aStart);
		let codeB = b.charCodeAt(bStart);

		if (codeA === codeB) {
			// equal
			continue;
		}

		if (codeA >= 128 || codeB >= 128) {
			// not ASCII letters -> fallback to lower-casing strings
			return compareSubstring(a.toLowerCase(), b.toLowerCase(), aStart, aEnd, bStart, bEnd);
		}

		// mapper lower-case ascii letter onto upper-case varinats
		// [97-122] (lower ascii) --> [65-90] (upper ascii)
		if (isLowerAsciiLetter(codeA)) {
			codeA -= 32;
		}
		if (isLowerAsciiLetter(codeB)) {
			codeB -= 32;
		}

		// compare both code points
		const diff = codeA - codeB;
		if (diff === 0) {
			continue;
		}

		return diff;
	}

	const aLen = aEnd - aStart;
	const bLen = bEnd - bStart;

	if (aLen < bLen) {
		return -1;
	} else if (aLen > bLen) {
		return 1;
	}

	return 0;
}

export function isAsciiDigit(code: number): boolean {
	return code >= CharCode.Digit0 && code <= CharCode.Digit9;
}

export function isLowerAsciiLetter(code: number): boolean {
	return code >= CharCode.a && code <= CharCode.z;
}

export function isUpperAsciiLetter(code: number): boolean {
	return code >= CharCode.A && code <= CharCode.Z;
}

export function equalsIgnoreCase(a: string, b: string): boolean {
	return a.length === b.length && compareSubstringIgnoreCase(a, b) === 0;
}

export function startsWithIgnoreCase(str: string, candidate: string): boolean {
	const candidateLength = candidate.length;
	if (candidate.length > str.length) {
		return false;
	}

	return compareSubstringIgnoreCase(str, candidate, 0, candidateLength) === 0;
}

/**
 * @returns the length of the common prefix of the two strings.
 */
export function commonPrefixLength(a: string, b: string): number {

	const len = Math.min(a.length, b.length);
	let i: number;

	for (i = 0; i < len; i++) {
		if (a.charCodeAt(i) !== b.charCodeAt(i)) {
			return i;
		}
	}

	return len;
}

/**
 * @returns the length of the common suffix of the two strings.
 */
export function commonSuffixLength(a: string, b: string): number {

	const len = Math.min(a.length, b.length);
	let i: number;

	const aLastIndex = a.length - 1;
	const bLastIndex = b.length - 1;

	for (i = 0; i < len; i++) {
		if (a.charCodeAt(aLastIndex - i) !== b.charCodeAt(bLastIndex - i)) {
			return i;
		}
	}

	return len;
}

/**
 * See http://en.wikipedia.org/wiki/Surrogate_pair
 */
export function isHighSurrogate(charCode: number): boolean {
	return (0xD800 <= charCode && charCode <= 0xDBFF);
}

/**
 * See http://en.wikipedia.org/wiki/Surrogate_pair
 */
export function isLowSurrogate(charCode: number): boolean {
	return (0xDC00 <= charCode && charCode <= 0xDFFF);
}

/**
 * See http://en.wikipedia.org/wiki/Surrogate_pair
 */
export function computeCodePoint(highSurrogate: number, lowSurrogate: number): number {
	return ((highSurrogate - 0xD800) << 10) + (lowSurrogate - 0xDC00) + 0x10000;
}

/**
 * get the code point that begins at offset `offset`
 */
export function getNextCodePoint(str: string, len: number, offset: number): number {
	const charCode = str.charCodeAt(offset);
	if (isHighSurrogate(charCode) && offset + 1 < len) {
		const nextCharCode = str.charCodeAt(offset + 1);
		if (isLowSurrogate(nextCharCode)) {
			return computeCodePoint(charCode, nextCharCode);
		}
	}
	return charCode;
}

/**
 * get the code point that ends right before offset `offset`
 */
function getPrevCodePoint(str: string, offset: number): number {
	const charCode = str.charCodeAt(offset - 1);
	if (isLowSurrogate(charCode) && offset > 1) {
		const prevCharCode = str.charCodeAt(offset - 2);
		if (isHighSurrogate(prevCharCode)) {
			return computeCodePoint(prevCharCode, charCode);
		}
	}
	return charCode;
}

export class CodePointIterator {

	private readonly _str: string;
	private readonly _len: number;
	private _offset: number;

	public get offset(): number {
		return this._offset;
	}

	constructor(str: string, offset: number = 0) {
		this._str = str;
		this._len = str.length;
		this._offset = offset;
	}

	public setOffset(offset: number): void {
		this._offset = offset;
	}

	public prevCodePoint(): number {
		const codePoint = getPrevCodePoint(this._str, this._offset);
		this._offset -= (codePoint >= Constants.UNICODE_SUPPLEMENTARY_PLANE_BEGIN ? 2 : 1);
		return codePoint;
	}

	public nextCodePoint(): number {
		const codePoint = getNextCodePoint(this._str, this._len, this._offset);
		this._offset += (codePoint >= Constants.UNICODE_SUPPLEMENTARY_PLANE_BEGIN ? 2 : 1);
		return codePoint;
	}

	public eol(): boolean {
		return (this._offset >= this._len);
	}
}

const IS_BASIC_ASCII = /^[\t\n\r\x20-\x7E]*$/;
/**
 * Returns true if `str` contains only basic ASCII characters in the range 32 - 126 (including 32 and 126) or \n, \r, \t
 */
export function isBasicASCII(str: string): boolean {
	return IS_BASIC_ASCII.test(str);
}

export const UNUSUAL_LINE_TERMINATORS = /[\u2028\u2029]/; // LINE SEPARATOR (LS) or PARAGRAPH SEPARATOR (PS)
/**
 * Returns true if `str` contains unusual line terminators, like LS or PS
 */
export function containsUnusualLineTerminators(str: string): boolean {
	return UNUSUAL_LINE_TERMINATORS.test(str);
}

export function isFullWidthCharacter(charCode: number): boolean {
	// Do a cheap trick to better support wrapping of wide characters, treat them as 2 columns
	// http://jrgraphix.net/research/unicode_blocks.php
	//          2E80 - 2EFF   CJK Radicals Supplement
	//          2F00 - 2FDF   Kangxi Radicals
	//          2FF0 - 2FFF   Ideographic Description Characters
	//          3000 - 303F   CJK Symbols and Punctuation
	//          3040 - 309F   Hiragana
	//          30A0 - 30FF   Katakana
	//          3100 - 312F   Bopomofo
	//          3130 - 318F   Hangul Compatibility Jamo
	//          3190 - 319F   Kanbun
	//          31A0 - 31BF   Bopomofo Extended
	//          31F0 - 31FF   Katakana Phonetic Extensions
	//          3200 - 32FF   Enclosed CJK Letters and Months
	//          3300 - 33FF   CJK Compatibility
	//          3400 - 4DBF   CJK Unified Ideographs Extension A
	//          4DC0 - 4DFF   Yijing Hexagram Symbols
	//          4E00 - 9FFF   CJK Unified Ideographs
	//          A000 - A48F   Yi Syllables
	//          A490 - A4CF   Yi Radicals
	//          AC00 - D7AF   Hangul Syllables
	// [IGNORE] D800 - DB7F   High Surrogates
	// [IGNORE] DB80 - DBFF   High Private Use Surrogates
	// [IGNORE] DC00 - DFFF   Low Surrogates
	// [IGNORE] E000 - F8FF   Private Use Area
	//          F900 - FAFF   CJK Compatibility Ideographs
	// [IGNORE] FB00 - FB4F   Alphabetic Presentation Forms
	// [IGNORE] FB50 - FDFF   Arabic Presentation Forms-A
	// [IGNORE] FE00 - FE0F   Variation Selectors
	// [IGNORE] FE20 - FE2F   Combining Half Marks
	// [IGNORE] FE30 - FE4F   CJK Compatibility Forms
	// [IGNORE] FE50 - FE6F   Small Form Variants
	// [IGNORE] FE70 - FEFF   Arabic Presentation Forms-B
	//          FF00 - FFEF   Halfwidth and Fullwidth Forms
	//               [https://en.wikipedia.org/wiki/Halfwidth_and_fullwidth_forms]
	//               of which FF01 - FF5E fullwidth ASCII of 21 to 7E
	// [IGNORE]    and FF65 - FFDC halfwidth of Katakana and Hangul
	// [IGNORE] FFF0 - FFFF   Specials
	return (
		(charCode >= 0x2E80 && charCode <= 0xD7AF)
		|| (charCode >= 0xF900 && charCode <= 0xFAFF)
		|| (charCode >= 0xFF01 && charCode <= 0xFF5E)
	);
}

/**
 * A fast function (therefore imprecise) to check if code points are emojis.
 * Generated using https://github.com/alexdima/unicode-utils/blob/main/emoji-test.js
 */
export function isEmojiImprecise(x: number): boolean {
	return (
		(x >= 0x1F1E6 && x <= 0x1F1FF) || (x === 8986) || (x === 8987) || (x === 9200)
		|| (x === 9203) || (x >= 9728 && x <= 10175) || (x === 11088) || (x === 11093)
		|| (x >= 127744 && x <= 128591) || (x >= 128640 && x <= 128764)
		|| (x >= 128992 && x <= 129008) || (x >= 129280 && x <= 129535)
		|| (x >= 129648 && x <= 129782)
	);
}

/**
 * Given a string and a max length returns a shorted version. Shorting
 * happens at favorable positions - such as whitespace or punctuation characters.
 * The return value can be longer than the given value of `n`. Leading whitespace is always trimmed.
 */
export function lcut(text: string, n: number, prefix = '') {
	const trimmed = text.trimStart();

	if (trimmed.length < n) {
		return trimmed;
	}

	const re = /\b/g;
	let i = 0;
	while (re.test(trimmed)) {
		if (trimmed.length - re.lastIndex < n) {
			break;
		}

		i = re.lastIndex;
		re.lastIndex += 1;
	}

	if (i === 0) {
		return trimmed;
	}

	return prefix + trimmed.substring(i).trimStart();
}

// Escape codes, compiled from https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Functions-using-CSI-_-ordered-by-the-final-character_s_
// Plus additional markers for custom `\x1b]...\x07` instructions.
const CSI_SEQUENCE = /(?:(?:\x1b\[|\x9B)[=?>!]?[\d;:]*["$#'* ]?[a-zA-Z@^`{}|~])|(:?\x1b\].*?\x07)/g;

/** Iterates over parts of a string with CSI sequences */
export function* forAnsiStringParts(str: string) {
	let last = 0;
	for (const match of str.matchAll(CSI_SEQUENCE)) {
		if (last !== match.index) {
			yield { isCode: false, str: str.substring(last, match.index) };
		}

		yield { isCode: true, str: match[0] };
		last = match.index + match[0].length;
	}

	if (last !== str.length) {
		yield { isCode: false, str: str.substring(last) };
	}
}

/**
 * Strips ANSI escape sequences from a string.
 * @param str The dastringa stringo strip the ANSI escape sequences from.
 *
 * @example
 * removeAnsiEscapeCodes('\u001b[31mHello, World!\u001b[0m');
 * // 'Hello, World!'
 */
export function removeAnsiEscapeCodes(str: string): string {
	if (str) {
		str = str.replace(CSI_SEQUENCE, '');
	}

	return str;
}

const PROMPT_NON_PRINTABLE = /\\\[.*?\\\]/g;

/**
 * Strips ANSI escape sequences from a UNIX-style prompt string (eg. `$PS1`).
 * @param str The string to strip the ANSI escape sequences from.
 *
 * @example
 * removeAnsiEscapeCodesFromPrompt('\n\\[\u001b[01;34m\\]\\w\\[\u001b[00m\\]\n\\[\u001b[1;32m\\]> \\[\u001b[0m\\]');
 * // '\n\\w\n> '
 */
export function removeAnsiEscapeCodesFromPrompt(str: string): string {
	return removeAnsiEscapeCodes(str).replace(PROMPT_NON_PRINTABLE, '');
}


// -- UTF-8 BOM

export const UTF8_BOM_CHARACTER = String.fromCharCode(CharCode.UTF8_BOM);

export function startsWithUTF8BOM(str: string): boolean {
	return !!(str && str.length > 0 && str.charCodeAt(0) === CharCode.UTF8_BOM);
}

export function stripUTF8BOM(str: string): string {
	return startsWithUTF8BOM(str) ? str.substr(1) : str;
}

/**
 * Checks if the characters of the provided query string are included in the
 * target string. The characters do not have to be contiguous within the string.
 */
export function fuzzyContains(target: string, query: string): boolean {
	if (!target || !query) {
		return false; // return early if target or query are undefined
	}

	if (target.length < query.length) {
		return false; // impossible for query to be contained in target
	}

	const queryLen = query.length;
	const targetLower = target.toLowerCase();

	let index = 0;
	let lastIndexOf = -1;
	while (index < queryLen) {
		const indexOf = targetLower.indexOf(query[index], lastIndexOf + 1);
		if (indexOf < 0) {
			return false;
		}

		lastIndexOf = indexOf;

		index++;
	}

	return true;
}

export function containsUppercaseCharacter(target: string, ignoreEscapedChars = false): boolean {
	if (!target) {
		return false;
	}

	if (ignoreEscapedChars) {
		target = target.replace(/\\./g, '');
	}

	return target.toLowerCase() !== target;
}

export function uppercaseFirstLetter(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getNLines(str: string, n = 1): string {
	if (n === 0) {
		return '';
	}

	let idx = -1;
	do {
		idx = str.indexOf('\n', idx + 1);
		n--;
	} while (n > 0 && idx >= 0);

	if (idx === -1) {
		return str;
	}

	if (str[idx - 1] === '\r') {
		idx--;
	}

	return str.substr(0, idx);
}

/**
 * Produces 'a'-'z', followed by 'A'-'Z'... followed by 'a'-'z', etc.
 */
export function singleLetterHash(n: number): string {
	const LETTERS_CNT = (CharCode.Z - CharCode.A + 1);

	n = n % (2 * LETTERS_CNT);

	if (n < LETTERS_CNT) {
		return String.fromCharCode(CharCode.a + n);
	}

	return String.fromCharCode(CharCode.A + n - LETTERS_CNT);
}

/**
 * Computes the offset after performing a left delete on the given string,
 * while considering unicode grapheme/emoji rules.
*/
export function getLeftDeleteOffset(offset: number, str: string): number {
	if (offset === 0) {
		return 0;
	}

	// Try to delete emoji part.
	const emojiOffset = getOffsetBeforeLastEmojiComponent(offset, str);
	if (emojiOffset !== undefined) {
		return emojiOffset;
	}

	// Otherwise, just skip a single code point.
	const iterator = new CodePointIterator(str, offset);
	iterator.prevCodePoint();
	return iterator.offset;
}

function getOffsetBeforeLastEmojiComponent(initialOffset: number, str: string): number | undefined {
	// See https://www.unicode.org/reports/tr51/tr51-14.html#EBNF_and_Regex for the
	// structure of emojis.
	const iterator = new CodePointIterator(str, initialOffset);
	let codePoint = iterator.prevCodePoint();

	// Skip modifiers
	while ((isEmojiModifier(codePoint) || codePoint === CodePoint.emojiVariantSelector || codePoint === CodePoint.enclosingKeyCap)) {
		if (iterator.offset === 0) {
			// Cannot skip modifier, no preceding emoji base.
			return undefined;
		}
		codePoint = iterator.prevCodePoint();
	}

	// Expect base emoji
	if (!isEmojiImprecise(codePoint)) {
		// Unexpected code point, not a valid emoji.
		return undefined;
	}

	let resultOffset = iterator.offset;

	if (resultOffset > 0) {
		// Skip optional ZWJ code points that combine multiple emojis.
		// In theory, we should check if that ZWJ actually combines multiple emojis
		// to prevent deleting ZWJs in situations we didn't account for.
		const optionalZwjCodePoint = iterator.prevCodePoint();
		if (optionalZwjCodePoint === CodePoint.zwj) {
			resultOffset = iterator.offset;
		}
	}

	return resultOffset;
}

function isEmojiModifier(codePoint: number): boolean {
	return 0x1F3FB <= codePoint && codePoint <= 0x1F3FF;
}

const enum CodePoint {
	zwj = 0x200D,

	/**
	 * Variation Selector-16 (VS16)
	*/
	emojiVariantSelector = 0xFE0F,

	/**
	 * Combining Enclosing Keycap
	 */
	enclosingKeyCap = 0x20E3,
}

export const noBreakWhitespace = '\xa0';
