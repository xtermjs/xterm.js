/**
 * Merges the range defined by the provided start and end into the list of
 * existing ranges. The merge is done in place on the existing range for
 * performance and is also returned.
 *
 * @param ranges Existing range list
 * @param newRangeStart Start position of the range to merge, inclusive
 * @param newRangeEnd End position of range to merge, exclusive
 */
export default function mergeRange(ranges: [number, number][], newRangeStart: number, newRangeEnd: number): [number, number][] {
    let inRange = false;
    for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        if (!inRange) {
            if (newRangeEnd <= range[0]) {
                // Case 1: New range is before the search range
                ranges.splice(i, 0, [newRangeStart, newRangeEnd]);
                return ranges;
            } else if (newRangeEnd <= range[1]) {
                // Case 2: New range is either wholly contained within the
                // search range or overlaps with the front of it
                range[0] = Math.min(newRangeStart, range[0]);
                return ranges;
            } else if (newRangeStart < range[1]) {
                // Case 3: New range either wholly contains the search range
                // or overlaps with the end of it
                range[0] = Math.min(newRangeStart, range[0]);
                inRange = true;
            } else {
                // Case 4: New range starts after the search range
                continue;
            }
        } else {
            if (newRangeEnd <= range[0]) {
                // Case 5: New range extends from previous range but doesn't
                // reach the current one
                ranges[i - 1][1] = newRangeEnd;
                return ranges;
            } else if (newRangeEnd <= range[1]) {
                // Case 6: New range extends from prvious range into the
                // current range
                ranges[i - 1][1] = Math.max(newRangeEnd, range[1]);
                ranges.splice(i, 1);
                inRange = false;
                return ranges;
            } else {
                // Case 7: New range extends from previous range past the
                // end of the current range
                ranges.splice(i, 1);
                i--;
            }
        }
    }

    if (inRange) {
        // Case 8: New range extends past the last existing range
        ranges[ranges.length - 1][1] = newRangeEnd;
    } else {
        // Case 9: New range starts after the last existing range
        ranges.push([newRangeStart, newRangeEnd]);
    }

    return ranges;
}
