/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface IKeyboardEvent {
  readonly browserEvent: KeyboardEvent;
  readonly keyCode: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly key: string;

  preventDefault(): void;
  stopPropagation(): void;
}

export class StandardKeyboardEvent implements IKeyboardEvent {
  public readonly browserEvent: KeyboardEvent;
  public readonly keyCode: number;
  public readonly ctrlKey: boolean;
  public readonly shiftKey: boolean;
  public readonly altKey: boolean;
  public readonly metaKey: boolean;
  public readonly key: string;

  constructor(e: KeyboardEvent) {
    this.browserEvent = e;
    this.keyCode = (e.keyCode || (e as any).which || 0) as number;
    this.ctrlKey = e.ctrlKey;
    this.shiftKey = e.shiftKey;
    this.altKey = e.altKey;
    this.metaKey = e.metaKey;
    this.key = e.key || '';
  }

  public preventDefault(): void {
    this.browserEvent.preventDefault();
  }

  public stopPropagation(): void {
    this.browserEvent.stopPropagation();
  }
}
