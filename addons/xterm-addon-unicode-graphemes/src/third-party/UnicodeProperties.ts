import UnicodeTrie from './unicode-trie';
const trieRaw = "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";

declare const Buffer: any;
function _dec(s: string): Uint8Array {
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64');
    const bs = atob(s);
    const r = new Uint8Array(bs.length);
    for (let i = 0; i < r.length; ++i) r[i] = bs.charCodeAt(i);
    return r;
}

const trieData = new UnicodeTrie(_dec(trieRaw));
export const GRAPHEME_BREAK_MASK = 0xF;
export const GRAPHEME_BREAK_SHIFT = 0;
export const CHARWIDTH_MASK = 0x30;
export const CHARWIDTH_SHIFT = 4;

// Values for the GRAPHEME_BREAK property
export const GRAPHEME_BREAK_Other = 0; // includes CR, LF, Control
export const GRAPHEME_BREAK_Prepend = 1;
export const GRAPHEME_BREAK_Extend = 2;
export const GRAPHEME_BREAK_Regional_Indicator = 3;
export const GRAPHEME_BREAK_SpacingMark = 4;
export const GRAPHEME_BREAK_Hangul_L = 5;
export const GRAPHEME_BREAK_Hangul_V = 6;
export const GRAPHEME_BREAK_Hangul_T = 7;
export const GRAPHEME_BREAK_Hangul_LV = 8;
export const GRAPHEME_BREAK_Hangul_LVT = 9;
export const GRAPHEME_BREAK_ZWJ = 10;
export const GRAPHEME_BREAK_ExtPic = 11;

// Only used as return value from shouldJoin/shouldJoinBackwards.
// (Must be positive; distinct from other values;
// and become GRAPHEME_BREAK_Other when masked with GRAPHEME_BREAK_MASK.)
const GRAPHEME_BREAK_SAW_Regional_Pair = 32;

export const CHARWIDTH_NORMAL = 0;
export const CHARWIDTH_FORCE_1COLUMN = 1;
export const CHARWIDTH_EA_AMBIGUOUS = 2;
export const CHARWIDTH_WIDE = 3;

// In the following 'info' is an encoded value from trie.get(codePoint)

// In the following 'info' is an encoded value from trie.get(codePoint)

export function infoToWidthInfo(info: number): number {
    return (info & CHARWIDTH_MASK) >> CHARWIDTH_SHIFT;
}

export function infoToWidth(info: number, ambiguousIsWide = false): 0 | 1 |2 {
    const v = infoToWidthInfo(info);
    return v < CHARWIDTH_EA_AMBIGUOUS ? 1
        : v >= CHARWIDTH_WIDE || ambiguousIsWide ? 2 : 1;
}

export function strWidth(str: string, preferWide: boolean): number {
    let width = 0;
    for (let i = 0; i < str.length;) {
        const codePoint = str.codePointAt(i) as number;
        width += infoToWidth(getInfo(codePoint), preferWide);
        i += (codePoint <= 0xffff) ? 1 : 2;
    }
    return width;
}

export function columnToIndexInContext(str: string, startIndex: number, column: number, preferWide: boolean): number {
    let rv = 0;
    for (let i = startIndex; ;) {
	if (i >= str.length)
	    return i;
	const codePoint = str.codePointAt(i) as number;
	const w = infoToWidth(getInfo(codePoint), preferWide);
	rv += w;
	if (rv > column)
	    return i;
	i += (codePoint <= 0xffff) ? 1 : 2;
    }
}


// Test if should break between beforeState and afterCode.
// Return <= 0 if should break; > 0 if should join.
// 'beforeState' is  the return value from the previous possible break;
// the value 0 is start of string.
// 'afterCode' is the GRAPHEME_BREAK_Xxx value for the following codepoint.
export function shouldJoin(beforeState: number, afterInfo: number): number {
    let beforeCode = (beforeState & GRAPHEME_BREAK_MASK) >> GRAPHEME_BREAK_SHIFT;
    let afterCode = (afterInfo & GRAPHEME_BREAK_MASK) >> GRAPHEME_BREAK_SHIFT;
    if (_shouldJoin(beforeCode, afterCode)) {
        if (afterCode === GRAPHEME_BREAK_Regional_Indicator)
            return GRAPHEME_BREAK_SAW_Regional_Pair;
        else
            return afterCode + 16;
    } else
        return afterCode - 16;
}

export function shouldJoinBackwards(beforeInfo: number, afterState: number): number {
    let afterCode = (afterState & GRAPHEME_BREAK_MASK) >> GRAPHEME_BREAK_SHIFT;
    let beforeCode = (beforeInfo & GRAPHEME_BREAK_MASK) >> GRAPHEME_BREAK_SHIFT;
    if (_shouldJoin(beforeCode, afterCode)) {
        if (beforeCode === GRAPHEME_BREAK_Regional_Indicator)
            return GRAPHEME_BREAK_SAW_Regional_Pair;
        else
            return beforeCode + 16;
    } else
        return beforeCode - 16;
}

/** Doesn't handle an odd number of RI characters. */
function _shouldJoin(beforeCode: number, afterCode: number): boolean {
    if (beforeCode >= GRAPHEME_BREAK_Hangul_L
        && beforeCode <= GRAPHEME_BREAK_Hangul_LVT) {
        if (beforeCode == GRAPHEME_BREAK_Hangul_L // GB6
            && (afterCode == GRAPHEME_BREAK_Hangul_L
                || afterCode == GRAPHEME_BREAK_Hangul_V
                || afterCode == GRAPHEME_BREAK_Hangul_LV
                || afterCode == GRAPHEME_BREAK_Hangul_LVT))
            return true;
        if ((beforeCode == GRAPHEME_BREAK_Hangul_LV // GB7
             || beforeCode == GRAPHEME_BREAK_Hangul_V)
            && (afterCode == GRAPHEME_BREAK_Hangul_V
                || afterCode == GRAPHEME_BREAK_Hangul_T))
            return true;
        if ((beforeCode == GRAPHEME_BREAK_Hangul_LVT // GB8
             || beforeCode == GRAPHEME_BREAK_Hangul_T)
            && afterCode == GRAPHEME_BREAK_Hangul_T)
            return true;
    }
    if (afterCode == GRAPHEME_BREAK_Extend // GB9
        || afterCode == GRAPHEME_BREAK_ZWJ
        || beforeCode == GRAPHEME_BREAK_Prepend // GB9a
        || afterCode == GRAPHEME_BREAK_SpacingMark) // GB9b
        return true;
    if (beforeCode == GRAPHEME_BREAK_ZWJ // GB11
        && afterCode == GRAPHEME_BREAK_ExtPic)
        return true;
    if (afterCode == GRAPHEME_BREAK_Regional_Indicator // GB12, GB13
        && beforeCode == GRAPHEME_BREAK_Regional_Indicator)
        return true;
    return false;
}

export function getInfo(codePoint: number): number {
    return trieData.get(codePoint);
}
