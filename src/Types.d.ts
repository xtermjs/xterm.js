/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, IMarker, ISelectionPosition, ILinkProvider } from 'xterm';
import { IAttributeData, CharData, ITerminalOptions, ICoreTerminal } from 'common/Types';
import { IEvent } from 'common/EventEmitter';
import { ILinkifier, ILinkMatcherOptions, IViewport, ILinkifier2 } from 'browser/Types';
import { IOptionsService, IUnicodeService } from 'common/services/Services';
import { IBuffer, IBufferSet } from 'common/buffer/Types';
import { IParams, IFunctionIdentifier } from 'common/parser/Types';
import { Linkifier } from 'browser/Linkifier';
import { Linkifier2 } from 'browser/Linkifier2';

