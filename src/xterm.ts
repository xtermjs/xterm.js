/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, sourceLair Limited (www.sourcelair.com (MIT License)
 */

import {CompositionHelper} from './input/compositionHelper';
import {Viewport} from './viewport';
let terminalFactory = require('./terminal');

export var Terminal = terminalFactory(typeof window !== 'undefined' ? window : global, Viewport, CompositionHelper);
