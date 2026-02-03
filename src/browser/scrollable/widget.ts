/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../Dom';
import { IMouseEvent, StandardMouseEvent } from './mouseEvent';
import { Disposable } from 'common/Lifecycle';

export abstract class Widget extends Disposable {

  protected _onclick(domNode: HTMLElement, listener: (e: IMouseEvent) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.eventType.CLICK, (e: MouseEvent) => listener(new StandardMouseEvent(dom.getWindow(domNode), e))));
  }

  protected _onmouseover(domNode: HTMLElement, listener: (e: IMouseEvent) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.eventType.MOUSE_OVER, (e: MouseEvent) => listener(new StandardMouseEvent(dom.getWindow(domNode), e))));
  }

  protected _onmouseleave(domNode: HTMLElement, listener: (e: IMouseEvent) => void): void {
    this._register(dom.addDisposableListener(domNode, dom.eventType.MOUSE_LEAVE, (e: MouseEvent) => listener(new StandardMouseEvent(dom.getWindow(domNode), e))));
  }
}
