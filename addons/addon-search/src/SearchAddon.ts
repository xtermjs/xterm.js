/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, IDisposable, ITerminalAddon } from '@xterm/xterm';
import type { SearchAddon as ISearchApi, ISearchOptions, ISearchAddonOptions, ISearchResultChangeEvent, ISearchDecorationOptions } from '@xterm/addon-search';
import { Emitter, type IEvent } from 'common/Event';
import { Disposable, MutableDisposable, toDisposable } from 'common/Lifecycle';

export class SearchAddon extends Disposable implements ITerminalAddon, ISearchApi {
}
