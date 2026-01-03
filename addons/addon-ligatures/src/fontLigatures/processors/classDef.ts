import { ClassDefTable } from '../tables';

/**
 * Get the number of the class to which the glyph belongs, or null if it doesn't
 * belong to any of them.
 *
 * @param table JSON representation of the class def table
 * @param glyphId Index of the glyph to look for
 */
export default function getGlyphClass(table: ClassDefTable, glyphId: number | [number, number]): Map<number | [number, number], number | null> {
    switch (table.format) {
        // https://docs.microsoft.com/en-us/typography/opentype/spec/chapter2#class-definition-table-format-2
        case 2:
            if (Array.isArray(glyphId)) {
                return getRangeGlyphClass(table, glyphId);
            } else {
                return new Map([[
                    glyphId,
                    getIndividualGlyphClass(table, glyphId)
                ]]);
            }
        // https://docs.microsoft.com/en-us/typography/opentype/spec/chapter2#class-definition-table-format-1
        default:
            return new Map([[glyphId, null]]);
    }
}

function getRangeGlyphClass(table: ClassDefTable.Format2, glyphId: [number, number]): Map<number | [number, number], number | null> {
    let classStart: number = glyphId[0];
    let currentClass: number | null = getIndividualGlyphClass(table, classStart);
    let search: number = glyphId[0] + 1;

    const result = new Map<[number, number] | number, number | null>();

    while (search < glyphId[1]) {
        const clazz = getIndividualGlyphClass(table, search);
        if (clazz !== currentClass) {
            if (search - classStart <= 1) {
                result.set(classStart, currentClass);
            } else {
                result.set([classStart, search], currentClass);
            }
        }
        search++;
    }

    if (search - classStart <= 1) {
        result.set(classStart, currentClass);
    } else {
        result.set([classStart, search], currentClass);
    }

    return result;
}

function getIndividualGlyphClass(table: ClassDefTable.Format2, glyphId: number): number | null {
    for (const range of table.ranges) {
        if (range.start <= glyphId && range.end >= glyphId) {
            return range.classId;
        }
    }

    return null;
}

export function listClassGlyphs(table: ClassDefTable, index: number): (number | [number, number])[] {
    switch (table.format) {
        case 2:
            const results: (number | [number, number])[] = [];
            for (const range of table.ranges) {
                if (range.classId !== index) {
                    continue;
                }

                if (range.end === range.start) {
                    results.push(range.start);
                } else {
                    results.push([range.start, range.end + 1]);
                }
            }
            return results;
        default:
            return [];
    }
}
