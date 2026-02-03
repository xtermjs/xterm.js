/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class FastDomNode<T extends HTMLElement> {

  private _width: string = '';
  private _height: string = '';
  private _top: string = '';
  private _left: string = '';
  private _bottom: string = '';
  private _right: string = '';
  private _className: string = '';
  private _position: string = '';
  private _layerHint: boolean = false;
  private _contain: 'none' | 'strict' | 'content' | 'size' | 'layout' | 'style' | 'paint' = 'none';

  constructor(
    public readonly domNode: T
  ) { }

  public setWidth(_width: number | string): void {
    const width = numberAsPixels(_width);
    if (this._width === width) {
      return;
    }
    this._width = width;
    this.domNode.style.width = this._width;
  }

  public setHeight(_height: number | string): void {
    const height = numberAsPixels(_height);
    if (this._height === height) {
      return;
    }
    this._height = height;
    this.domNode.style.height = this._height;
  }

  public setTop(_top: number | string): void {
    const top = numberAsPixels(_top);
    if (this._top === top) {
      return;
    }
    this._top = top;
    this.domNode.style.top = this._top;
  }

  public setLeft(_left: number | string): void {
    const left = numberAsPixels(_left);
    if (this._left === left) {
      return;
    }
    this._left = left;
    this.domNode.style.left = this._left;
  }

  public setBottom(_bottom: number | string): void {
    const bottom = numberAsPixels(_bottom);
    if (this._bottom === bottom) {
      return;
    }
    this._bottom = bottom;
    this.domNode.style.bottom = this._bottom;
  }

  public setRight(_right: number | string): void {
    const right = numberAsPixels(_right);
    if (this._right === right) {
      return;
    }
    this._right = right;
    this.domNode.style.right = this._right;
  }

  public setClassName(className: string): void {
    if (this._className === className) {
      return;
    }
    this._className = className;
    this.domNode.className = this._className;
  }

  public toggleClassName(className: string, shouldHaveIt?: boolean): void {
    this.domNode.classList.toggle(className, shouldHaveIt);
    this._className = this.domNode.className;
  }

  public setPosition(position: string): void {
    if (this._position === position) {
      return;
    }
    this._position = position;
    this.domNode.style.position = this._position;
  }

  public setLayerHinting(layerHint: boolean): void {
    if (this._layerHint === layerHint) {
      return;
    }
    this._layerHint = layerHint;
    if (layerHint) {
      this.domNode.style.transform = 'translate3d(0px, 0px, 0px)';
    } else {
      this.domNode.style.transform = '';
    }
  }

  public setContain(contain: 'none' | 'strict' | 'content' | 'size' | 'layout' | 'style' | 'paint'): void {
    if (this._contain === contain) {
      return;
    }
    this._contain = contain;
    this.domNode.style.contain = this._contain;
  }

  public setAttribute(name: string, value: string): void {
    this.domNode.setAttribute(name, value);
  }

}

function numberAsPixels(value: number | string): string {
  return (typeof value === 'number' ? `${value}px` : value);
}
