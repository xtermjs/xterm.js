/**
 * @module xterm/utils/DomElementObjectPool
 * @license MIT
 */

/**
 * An object pool that manages acquisition and releasing of DOM elements for
 * when reuse is desirable.
 */
export class DomElementObjectPool {
  private static readonly OBJECT_ID_ATTRIBUTE = 'data-obj-id';

  private static _objectCount = 0;

  private _type: string;
  private _pool: HTMLElement[];
  private _inUse: {[key: string]: HTMLElement};

  /**
   * @param type The DOM element type (div, span, etc.).
   */
  constructor(private type: string) {
    this._type = type;
    this._pool = [];
    this._inUse = {};
  }

  public acquire(): HTMLElement {
    let element: HTMLElement;
    if (this._pool.length === 0) {
      element = this.createNew();
    } else {
      element = this._pool.pop();
    }
    this._inUse[element.getAttribute(DomElementObjectPool.OBJECT_ID_ATTRIBUTE)] = element;
    return element;
  }

  public release(element: HTMLElement) {
    if (!this._inUse[element.getAttribute(DomElementObjectPool.OBJECT_ID_ATTRIBUTE)]) {
      throw new Error('Could not release an element not yet acquired');
    }
    delete this._inUse[element.getAttribute(DomElementObjectPool.OBJECT_ID_ATTRIBUTE)];
    this._pool.push(element);
  }

  private createNew(): HTMLElement {
    const element = document.createElement(this._type);
    const id = DomElementObjectPool._objectCount++;
    element.setAttribute(DomElementObjectPool.OBJECT_ID_ATTRIBUTE, id.toString(10));
    return element;
  }
}
