/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const enum Touch {
	None = 0,
	AsOld = 1,
	AsNew = 2
}

export class SetMap<K, V> {

	private map = new Map<K, Set<V>>();

	add(key: K, value: V): void {
		let values = this.map.get(key);

		if (!values) {
			values = new Set<V>();
			this.map.set(key, values);
		}

		values.add(value);
	}

	delete(key: K, value: V): void {
		const values = this.map.get(key);

		if (!values) {
			return;
		}

		values.delete(value);

		if (values.size === 0) {
			this.map.delete(key);
		}
	}

	forEach(key: K, fn: (value: V) => void): void {
		const values = this.map.get(key);

		if (!values) {
			return;
		}

		values.forEach(fn);
	}

	get(key: K): ReadonlySet<V> {
		const values = this.map.get(key);
		if (!values) {
			return new Set<V>();
		}
		return values;
	}
}
