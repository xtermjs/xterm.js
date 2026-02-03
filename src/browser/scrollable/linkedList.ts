/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

class Node<E> {

  public static readonly Undefined = new Node<any>(undefined);

  public element: E;
  public next: Node<E>;
  public prev: Node<E>;

  public constructor(element: E) {
    this.element = element;
    this.next = Node.Undefined;
    this.prev = Node.Undefined;
  }
}

export class LinkedList<E> {

  private _first: Node<E> = Node.Undefined;
  private _last: Node<E> = Node.Undefined;

  public push(element: E): () => void {
    return this._insert(element, true);
  }

  private _insert(element: E, atTheEnd: boolean): () => void {
    const newNode = new Node(element);
    if (this._first === Node.Undefined) {
      this._first = newNode;
      this._last = newNode;

    } else if (atTheEnd) {
      // push
      const oldLast = this._last;
      this._last = newNode;
      newNode.prev = oldLast;
      oldLast.next = newNode;

    } else {
      // unshift
      const oldFirst = this._first;
      this._first = newNode;
      newNode.next = oldFirst;
      oldFirst.prev = newNode;
    }
    let didRemove = false;
    return () => {
      if (!didRemove) {
        didRemove = true;
        this._remove(newNode);
      }
    };
  }

  private _remove(node: Node<E>): void {
    if (node.prev !== Node.Undefined && node.next !== Node.Undefined) {
      // middle
      const anchor = node.prev;
      anchor.next = node.next;
      node.next.prev = anchor;

    } else if (node.prev === Node.Undefined && node.next === Node.Undefined) {
      // only node
      this._first = Node.Undefined;
      this._last = Node.Undefined;

    } else if (node.next === Node.Undefined) {
      // last
      this._last = this._last.prev!;
      this._last.next = Node.Undefined;

    } else if (node.prev === Node.Undefined) {
      // first
      this._first = this._first.next!;
      this._first.prev = Node.Undefined;
    }

    // done
  }

  public *[Symbol.iterator](): Iterator<E> {
    let node = this._first;
    while (node !== Node.Undefined) {
      yield node.element;
      node = node.next;
    }
  }
}
