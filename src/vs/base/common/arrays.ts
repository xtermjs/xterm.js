/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Returns the last element of an array.
 * @param array The array.
 * @param n Which element from the end (default is zero).
 */
export function tail<T>(array: ArrayLike<T>, n: number = 0): T | undefined {
	return array[array.length - (1 + n)];
}

/**
 * Inserts an element into an array. Returns a function which, when
 * called, will remove that element from the array.
 *
 * @deprecated In almost all cases, use a `Set<T>` instead.
 */
export function insert<T>(array: T[], element: T): () => void {
	array.push(element);

	return () => remove(array, element);
}

/**
 * Removes an element from an array if it can be found.
 *
 * @deprecated In almost all cases, use a `Set<T>` instead.
 */
export function remove<T>(array: T[], element: T): T | undefined {
	const index = array.indexOf(element);
	if (index > -1) {
		array.splice(index, 1);

		return element;
	}

	return undefined;
}

/**
 * Insert `insertArr` inside `target` at `insertIndex`.
 * Please don't touch unless you understand https://jsperf.com/inserting-an-array-within-an-array
 */
export function arrayInsert<T>(target: T[], insertIndex: number, insertArr: T[]): T[] {
	const before = target.slice(0, insertIndex);
	const after = target.slice(insertIndex);
	return before.concat(insertArr, after);
}

/**
 * Uses Fisher-Yates shuffle to shuffle the given array
 */
export function shuffle<T>(array: T[], _seed?: number): void {
	let rand: () => number;

	if (typeof _seed === 'number') {
		let seed = _seed;
		// Seeded random number generator in JS. Modified from:
		// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
		rand = () => {
			const x = Math.sin(seed++) * 179426549; // throw away most significant digits and reduce any potential bias
			return x - Math.floor(x);
		};
	} else {
		rand = Math.random;
	}

	for (let i = array.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rand() * (i + 1));
		const temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
}

/**
 * Pushes an element to the start of the array, if found.
 */
export function pushToStart<T>(arr: T[], value: T): void {
	const index = arr.indexOf(value);

	if (index > -1) {
		arr.splice(index, 1);
		arr.unshift(value);
	}
}

/**
 * Pushes an element to the end of the array, if found.
 */
export function pushToEnd<T>(arr: T[], value: T): void {
	const index = arr.indexOf(value);

	if (index > -1) {
		arr.splice(index, 1);
		arr.push(value);
	}
}

export function pushMany<T>(arr: T[], items: ReadonlyArray<T>): void {
	for (const item of items) {
		arr.push(item);
	}
}

export function mapArrayOrNot<T, U>(items: T | T[], fn: (_: T) => U): U | U[] {
	return Array.isArray(items) ?
		items.map(fn) :
		fn(items);
}

export function asArray<T>(x: T | T[]): T[];
export function asArray<T>(x: T | readonly T[]): readonly T[];
export function asArray<T>(x: T | T[]): T[] {
	return Array.isArray(x) ? x : [x];
}

export function getRandomElement<T>(arr: T[]): T | undefined {
	return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Insert the new items in the array.
 * @param array The original array.
 * @param start The zero-based location in the array from which to start inserting elements.
 * @param newItems The items to be inserted
 */
export function insertInto<T>(array: T[], start: number, newItems: T[]): void {
	const startIdx = getActualStartIndex(array, start);
	const originalLength = array.length;
	const newItemsLength = newItems.length;
	array.length = originalLength + newItemsLength;
	// Move the items after the start index, start from the end so that we don't overwrite any value.
	for (let i = originalLength - 1; i >= startIdx; i--) {
		array[i + newItemsLength] = array[i];
	}

	for (let i = 0; i < newItemsLength; i++) {
		array[i + startIdx] = newItems[i];
	}
}

/**
 * Removes elements from an array and inserts new elements in their place, returning the deleted elements. Alternative to the native Array.splice method, it
 * can only support limited number of items due to the maximum call stack size limit.
 * @param array The original array.
 * @param start The zero-based location in the array from which to start removing elements.
 * @param deleteCount The number of elements to remove.
 * @returns An array containing the elements that were deleted.
 */
export function splice<T>(array: T[], start: number, deleteCount: number, newItems: T[]): T[] {
	const index = getActualStartIndex(array, start);
	let result = array.splice(index, deleteCount);
	if (result === undefined) {
		// see https://bugs.webkit.org/show_bug.cgi?id=261140
		result = [];
	}
	insertInto(array, index, newItems);
	return result;
}

/**
 * Determine the actual start index (same logic as the native splice() or slice())
 * If greater than the length of the array, start will be set to the length of the array. In this case, no element will be deleted but the method will behave as an adding function, adding as many element as item[n*] provided.
 * If negative, it will begin that many elements from the end of the array. (In this case, the origin -1, meaning -n is the index of the nth last element, and is therefore equivalent to the index of array.length - n.) If array.length + start is less than 0, it will begin from index 0.
 * @param array The target array.
 * @param start The operation index.
 */
function getActualStartIndex<T>(array: T[], start: number): number {
	return start < 0 ? Math.max(start + array.length, 0) : Math.min(start, array.length);
}

/**
 * When comparing two values,
 * a negative number indicates that the first value is less than the second,
 * a positive number indicates that the first value is greater than the second,
 * and zero indicates that neither is the case.
*/
export type CompareResult = number;

export namespace CompareResult {
	export function isLessThan(result: CompareResult): boolean {
		return result < 0;
	}

	export function isLessThanOrEqual(result: CompareResult): boolean {
		return result <= 0;
	}

	export function isGreaterThan(result: CompareResult): boolean {
		return result > 0;
	}

	export function isNeitherLessOrGreaterThan(result: CompareResult): boolean {
		return result === 0;
	}

	export const greaterThan = 1;
	export const lessThan = -1;
	export const neitherLessOrGreaterThan = 0;
}

/**
 * A comparator `c` defines a total order `<=` on `T` as following:
 * `c(a, b) <= 0` iff `a` <= `b`.
 * We also have `c(a, b) == 0` iff `c(b, a) == 0`.
*/
export type Comparator<T> = (a: T, b: T) => CompareResult;

export function compareBy<TItem, TCompareBy>(selector: (item: TItem) => TCompareBy, comparator: Comparator<TCompareBy>): Comparator<TItem> {
	return (a, b) => comparator(selector(a), selector(b));
}

export function tieBreakComparators<TItem>(...comparators: Comparator<TItem>[]): Comparator<TItem> {
	return (item1, item2) => {
		for (const comparator of comparators) {
			const result = comparator(item1, item2);
			if (!CompareResult.isNeitherLessOrGreaterThan(result)) {
				return result;
			}
		}
		return CompareResult.neitherLessOrGreaterThan;
	};
}

/**
 * The natural order on numbers.
*/
export const numberComparator: Comparator<number> = (a, b) => a - b;

export const booleanComparator: Comparator<boolean> = (a, b) => numberComparator(a ? 1 : 0, b ? 1 : 0);

export function reverseOrder<TItem>(comparator: Comparator<TItem>): Comparator<TItem> {
	return (a, b) => -comparator(a, b);
}

export class ArrayQueue<T> {
	private firstIdx = 0;
	private lastIdx = this.items.length - 1;

	/**
	 * Constructs a queue that is backed by the given array. Runtime is O(1).
	*/
	constructor(private readonly items: readonly T[]) { }

	get length(): number {
		return this.lastIdx - this.firstIdx + 1;
	}

	/**
	 * Consumes elements from the beginning of the queue as long as the predicate returns true.
	 * If no elements were consumed, `null` is returned. Has a runtime of O(result.length).
	*/
	takeWhile(predicate: (value: T) => boolean): T[] | null {
		// P(k) := k <= this.lastIdx && predicate(this.items[k])
		// Find s := min { k | k >= this.firstIdx && !P(k) } and return this.data[this.firstIdx...s)

		let startIdx = this.firstIdx;
		while (startIdx < this.items.length && predicate(this.items[startIdx])) {
			startIdx++;
		}
		const result = startIdx === this.firstIdx ? null : this.items.slice(this.firstIdx, startIdx);
		this.firstIdx = startIdx;
		return result;
	}

	/**
	 * Consumes elements from the end of the queue as long as the predicate returns true.
	 * If no elements were consumed, `null` is returned.
	 * The result has the same order as the underlying array!
	*/
	takeFromEndWhile(predicate: (value: T) => boolean): T[] | null {
		// P(k) := this.firstIdx >= k && predicate(this.items[k])
		// Find s := max { k | k <= this.lastIdx && !P(k) } and return this.data(s...this.lastIdx]

		let endIdx = this.lastIdx;
		while (endIdx >= 0 && predicate(this.items[endIdx])) {
			endIdx--;
		}
		const result = endIdx === this.lastIdx ? null : this.items.slice(endIdx + 1, this.lastIdx + 1);
		this.lastIdx = endIdx;
		return result;
	}

	peek(): T | undefined {
		if (this.length === 0) {
			return undefined;
		}
		return this.items[this.firstIdx];
	}

	peekLast(): T | undefined {
		if (this.length === 0) {
			return undefined;
		}
		return this.items[this.lastIdx];
	}

	dequeue(): T | undefined {
		const result = this.items[this.firstIdx];
		this.firstIdx++;
		return result;
	}

	removeLast(): T | undefined {
		const result = this.items[this.lastIdx];
		this.lastIdx--;
		return result;
	}

	takeCount(count: number): T[] {
		const result = this.items.slice(this.firstIdx, this.firstIdx + count);
		this.firstIdx += count;
		return result;
	}
}

/**
 * This class is faster than an iterator and array for lazy computed data.
*/
export class CallbackIterable<T> {
	public static readonly empty = new CallbackIterable<never>(_callback => { });

	constructor(
		/**
		 * Calls the callback for every item.
		 * Stops when the callback returns false.
		*/
		public readonly iterate: (callback: (item: T) => boolean) => void
	) {
	}

	forEach(handler: (item: T) => void) {
		this.iterate(item => { handler(item); return true; });
	}

	toArray(): T[] {
		const result: T[] = [];
		this.iterate(item => { result.push(item); return true; });
		return result;
	}

	filter(predicate: (item: T) => boolean): CallbackIterable<T> {
		return new CallbackIterable(cb => this.iterate(item => predicate(item) ? cb(item) : true));
	}

	map<TResult>(mapFn: (item: T) => TResult): CallbackIterable<TResult> {
		return new CallbackIterable<TResult>(cb => this.iterate(item => cb(mapFn(item))));
	}

	some(predicate: (item: T) => boolean): boolean {
		let result = false;
		this.iterate(item => { result = predicate(item); return !result; });
		return result;
	}

	findFirst(predicate: (item: T) => boolean): T | undefined {
		let result: T | undefined;
		this.iterate(item => {
			if (predicate(item)) {
				result = item;
				return false;
			}
			return true;
		});
		return result;
	}

	findLast(predicate: (item: T) => boolean): T | undefined {
		let result: T | undefined;
		this.iterate(item => {
			if (predicate(item)) {
				result = item;
			}
			return true;
		});
		return result;
	}

	findLastMaxBy(comparator: Comparator<T>): T | undefined {
		let result: T | undefined;
		let first = true;
		this.iterate(item => {
			if (first || CompareResult.isGreaterThan(comparator(item, result!))) {
				first = false;
				result = item;
			}
			return true;
		});
		return result;
	}
}

/**
 * Represents a re-arrangement of items in an array.
 */
export class Permutation {
	constructor(private readonly _indexMap: readonly number[]) { }

	/**
	 * Returns a permutation that sorts the given array according to the given compare function.
	 */
	public static createSortPermutation<T>(arr: readonly T[], compareFn: (a: T, b: T) => number): Permutation {
		const sortIndices = Array.from(arr.keys()).sort((index1, index2) => compareFn(arr[index1], arr[index2]));
		return new Permutation(sortIndices);
	}

	/**
	 * Returns a new array with the elements of the given array re-arranged according to this permutation.
	 */
	apply<T>(arr: readonly T[]): T[] {
		return arr.map((_, index) => arr[this._indexMap[index]]);
	}

	/**
	 * Returns a new permutation that undoes the re-arrangement of this permutation.
	*/
	inverse(): Permutation {
		const inverseIndexMap = this._indexMap.slice();
		for (let i = 0; i < this._indexMap.length; i++) {
			inverseIndexMap[this._indexMap[i]] = i;
		}
		return new Permutation(inverseIndexMap);
	}
}
