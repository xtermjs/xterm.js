/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/// <reference path="../../../typings/xterm.d.ts"/>

import type { AddonCollection } from '../../types';
import type { IControlWindow } from '../controlBar';
import type { Terminal } from '@xterm/xterm';

export abstract class BaseWindow implements IControlWindow {
    protected get _terminal(): Terminal { return this.__terminal; }

    constructor(
        private __terminal: Terminal,
        protected readonly _addons: AddonCollection,
    ) {

    }

    setTerminal(terminal: Terminal): void {
        this.__terminal = terminal;
    }

    abstract id: string;
    abstract label: string;
    abstract build(container: HTMLElement): void;
}