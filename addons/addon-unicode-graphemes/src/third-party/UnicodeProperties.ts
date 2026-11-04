import UnicodeTrie from './unicode-trie';
const trieRaw = "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";

declare const Buffer: { from(s: string, encoding: string): Uint8Array } | undefined;
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
export const INCB_MASK = 0xC0;
export const INCB_SHIFT = 6;

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
export const GRAPHEME_BREAK_SAW_Regional_Pair = 32;

// Only used in the state returned from shouldJoin, to remember that an
// Extend or ZWJ was preceded by ExtPic Extend*, as rule GB11 requires.
// (Must be distinct from the GRAPHEME_BREAK_Xxx values above
// and fit in GRAPHEME_BREAK_MASK.)
export const GRAPHEME_BREAK_ExtPic_Extend = 12;
export const GRAPHEME_BREAK_ExtPic_ZWJ = 13;

// Only used in the state returned from shouldJoin/shouldJoinBackwards,
// for rule GB9c. GRAPHEME_BREAK_InCB_Linker is an InCB=Linker followed by
// zero or more InCB=Extend; GRAPHEME_BREAK_InCB_Consonant is an InCB=Consonant
// (which always has Grapheme_Cluster_Break=Other).
// (Must be distinct from the GRAPHEME_BREAK_Xxx values above
// and fit in GRAPHEME_BREAK_MASK.)
export const GRAPHEME_BREAK_InCB_Linker = 14;
export const GRAPHEME_BREAK_InCB_Consonant = 15;

// Values for the Indic_Conjunct_Break (InCB) property
export const INCB_None = 0;
export const INCB_Linker = 1;
export const INCB_Extend = 2;
export const INCB_Consonant = 3;

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
    let afterCode = infoToCode(afterInfo);
    let afterInCB = (afterInfo & INCB_MASK) >> INCB_SHIFT;
    if (_shouldJoin(beforeCode, afterCode)) {
        if (afterCode === GRAPHEME_BREAK_Regional_Indicator)
            return GRAPHEME_BREAK_SAW_Regional_Pair;
        if (beforeCode === GRAPHEME_BREAK_ExtPic
            || beforeCode === GRAPHEME_BREAK_ExtPic_Extend) {
            if (afterCode === GRAPHEME_BREAK_Extend)
                return GRAPHEME_BREAK_ExtPic_Extend + 16;
            if (afterCode === GRAPHEME_BREAK_ZWJ)
                return GRAPHEME_BREAK_ExtPic_ZWJ + 16;
        }
        if (afterInCB === INCB_Linker
            || (afterInCB === INCB_Extend
                && beforeCode === GRAPHEME_BREAK_InCB_Linker))
            return GRAPHEME_BREAK_InCB_Linker + 16;
        return afterCode + 16;
    } else if (afterInCB === INCB_Linker)
        return GRAPHEME_BREAK_InCB_Linker - 16;
    else
        return afterCode - 16;
}

export function shouldJoinBackwards(beforeInfo: number, afterState: number): number {
    let afterCode = (afterState & GRAPHEME_BREAK_MASK) >> GRAPHEME_BREAK_SHIFT;
    let beforeCode = infoToCode(beforeInfo);
    let beforeInCB = (beforeInfo & INCB_MASK) >> INCB_SHIFT;
    // Looking backwards we can't see what precedes a ZWJ,
    // so assume the ExtPic Extend* that GB11 requires.
    // Nor can we see if an InCB=Extend follows an InCB=Linker,
    // so GB9c only joins an InCB=Linker directly before an InCB=Consonant.
    if (_shouldJoin(beforeCode === GRAPHEME_BREAK_ZWJ ? GRAPHEME_BREAK_ExtPic_ZWJ
                    : beforeInCB === INCB_Linker ? GRAPHEME_BREAK_InCB_Linker
                    : beforeCode,
                    afterCode)) {
        if (beforeCode === GRAPHEME_BREAK_Regional_Indicator)
            return GRAPHEME_BREAK_SAW_Regional_Pair;
        else
            return beforeCode + 16;
    } else
        return beforeCode - 16;
}

// The GRAPHEME_BREAK_Xxx value of a code point, except that an
// InCB=Consonant is GRAPHEME_BREAK_InCB_Consonant (for rule GB9c).
function infoToCode(info: number): number {
    if ((info & INCB_MASK) >> INCB_SHIFT === INCB_Consonant)
        return GRAPHEME_BREAK_InCB_Consonant;
    return (info & GRAPHEME_BREAK_MASK) >> GRAPHEME_BREAK_SHIFT;
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
    if (beforeCode == GRAPHEME_BREAK_InCB_Linker // GB9c
        && afterCode == GRAPHEME_BREAK_InCB_Consonant)
        return true;
    if (beforeCode == GRAPHEME_BREAK_ExtPic_ZWJ // GB11
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
