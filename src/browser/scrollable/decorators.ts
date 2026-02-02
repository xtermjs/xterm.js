/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function memoize(_target: any, key: string, descriptor: PropertyDescriptor): void {
  let fnKey: string | null = null;
  let fn: Function | null = null;

  if (typeof descriptor.value === 'function') {
    fnKey = 'value';
    fn = descriptor.value;

    if (fn!.length !== 0) {
      console.warn('Memoize should only be used in functions with zero parameters');
    }
  } else if (typeof descriptor.get === 'function') {
    fnKey = 'get';
    fn = descriptor.get;
  }

  if (!fn) {
    throw new Error('not supported');
  }

  const memoizeKey = `$memoize$${key}`;
  const descriptorAny = descriptor as { [key: string]: any };
  descriptorAny[fnKey!] = function (...args: any[]) {
    if (!this.hasOwnProperty(memoizeKey)) {
      Object.defineProperty(this, memoizeKey, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: fn.apply(this, args)
      });
    }

    return (this as { [key: string]: any })[memoizeKey];
  };
}

