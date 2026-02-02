/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from './dom';
import { IKeyboardEvent, StandardKeyboardEvent } from './keyboardEvent';
import { IMouseEvent, StandardMouseEvent } from './mouseEvent';
import { Gesture } from './touch';
import { Disposable, IDisposable } from 'common/Lifecycle';

export abstract class Widget extends Disposable {

  protected _onclick(domNode: HTMLElement, listener: (e: IMouseEvent) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.CLICK, (e: MouseEvent) => listener(new StandardMouseEvent(dom.getWindow(domNode), e))));
  }

  protected _onmousedown(domNode: HTMLElement, listener: (e: IMouseEvent) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.MOUSE_DOWN, (e: MouseEvent) => listener(new StandardMouseEvent(dom.getWindow(domNode), e))));
  }

  protected _onmouseover(domNode: HTMLElement, listener: (e: IMouseEvent) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.MOUSE_OVER, (e: MouseEvent) => listener(new StandardMouseEvent(dom.getWindow(domNode), e))));
  }

  protected _onmouseleave(domNode: HTMLElement, listener: (e: IMouseEvent) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.MOUSE_LEAVE, (e: MouseEvent) => listener(new StandardMouseEvent(dom.getWindow(domNode), e))));
  }

  protected _onkeydown(domNode: HTMLElement, listener: (e: IKeyboardEvent) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => listener(new StandardKeyboardEvent(e))));
  }

  protected _onkeyup(domNode: HTMLElement, listener: (e: IKeyboardEvent) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.KEY_UP, (e: KeyboardEvent) => listener(new StandardKeyboardEvent(e))));
  }

  protected _oninput(domNode: HTMLElement, listener: (e: Event) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.INPUT, listener));
  }

  protected _onblur(domNode: HTMLElement, listener: (e: Event) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.BLUR, listener));
  }

  protected _onfocus(domNode: HTMLElement, listener: (e: Event) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.FOCUS, listener));
  }

  protected _onchange(domNode: HTMLElement, listener: (e: Event) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.EventType.CHANGE, listener));
  }

  protected _ignoreGesture(domNode: HTMLElement): IDisposable {
    return Gesture.ignoreTarget(domNode);
  }
}
