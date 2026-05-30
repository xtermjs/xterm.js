"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDecorationService = exports.MockUnicodeService = exports.MockOscLinkService = exports.MockOptionsService = exports.MockLogService = exports.MockCoreService = exports.MockCharsetService = exports.MockMouseStateService = exports.MockBufferService = exports.NULL_CELL_DATA = void 0;
exports.createCellData = createCellData;
exports.extendedAttributes = extendedAttributes;
const Services_1 = require("common/services/Services");
const UnicodeService_1 = require("common/services/UnicodeService");
const OptionsService_1 = require("common/services/OptionsService");
const BufferSet_1 = require("common/buffer/BufferSet");
const UnicodeV6_1 = require("common/input/UnicodeV6");
const Event_1 = require("common/base/Event");
const CellData_1 = require("common/buffer/CellData");
const Constants_1 = require("common/buffer/Constants");
function createCellData(attr, char, width) {
    return CellData_1.CellData.fromCharData([attr, char, width, char.length === 0 ? 0 : char.charCodeAt(0)]);
}
function extendedAttributes(line, index) {
    const cell = new CellData_1.CellData();
    line.loadCell(index, cell);
    return cell.hasExtendedAttrs() !== 0 ? cell.extended : undefined;
}
exports.NULL_CELL_DATA = Object.freeze(createCellData(Constants_1.DEFAULT_ATTR, Constants_1.NULL_CELL_CHAR, Constants_1.NULL_CELL_WIDTH));
class MockBufferService {
    get buffer() { return this.buffers.active; }
    constructor(cols, rows, optionsService = new MockOptionsService()) {
        this.cols = cols;
        this.rows = rows;
        this.buffers = {};
        this.onResize = new Event_1.Emitter().event;
        this.onScroll = new Event_1.Emitter().event;
        this._onScroll = new Event_1.Emitter();
        this.isUserScrolling = false;
        this.buffers = new BufferSet_1.BufferSet(optionsService, this, new MockLogService());
        this.buffers.onBufferActivate(e => {
            this._onScroll.fire(e.activeBuffer.ydisp);
        });
    }
    scrollPages(pageCount) {
        throw new Error('Method not implemented.');
    }
    scrollToTop() {
        throw new Error('Method not implemented.');
    }
    scrollToLine(line) {
        throw new Error('Method not implemented.');
    }
    scroll(eraseAttr, isWrapped) {
        throw new Error('Method not implemented.');
    }
    scrollToBottom() {
        throw new Error('Method not implemented.');
    }
    scrollLines(disp, suppressScrollEvent) {
        throw new Error('Method not implemented.');
    }
    resize(cols, rows) {
        this.cols = cols;
        this.rows = rows;
    }
    reset() { }
}
exports.MockBufferService = MockBufferService;
class MockMouseStateService {
    constructor() {
        this.areMouseEventsActive = false;
        this.activeEncoding = '';
        this.activeProtocol = '';
        this.isDefaultEncoding = true;
        this.isPixelEncoding = false;
        this.onProtocolChange = new Event_1.Emitter().event;
    }
    addEncoding(name) { }
    addProtocol(name) { }
    reset() { }
    restrictMouseEvent(event) { return true; }
    encodeMouseEvent(event) { return ''; }
    setCustomWheelEventHandler(customWheelEventHandler) { }
    allowCustomWheelEvent(ev) { return true; }
}
exports.MockMouseStateService = MockMouseStateService;
class MockCharsetService {
    constructor() {
        this.glevel = 0;
        this.charsets = [];
    }
    reset() { }
    setgLevel(g) {
        this.glevel = g;
        this.charset = this.charsets[g];
    }
    setgCharset(g, charset) {
        this.charsets[g] = charset;
        if (this.glevel === g) {
            this.charset = charset;
        }
    }
}
exports.MockCharsetService = MockCharsetService;
class MockCoreService {
    constructor() {
        this.isCursorInitialized = true;
        this.isCursorHidden = false;
        this.isFocused = false;
        this.modes = {
            insertMode: false
        };
        this.decPrivateModes = {
            applicationCursorKeys: false,
            applicationKeypad: false,
            bracketedPasteMode: false,
            colorSchemeUpdates: false,
            cursorBlink: undefined,
            cursorStyle: undefined,
            origin: false,
            reverseWraparound: false,
            sendFocus: false,
            synchronizedOutput: false,
            win32InputMode: false,
            wraparound: true
        };
        this.kittyKeyboard = {
            flags: 0,
            mainFlags: 0,
            altFlags: 0,
            mainStack: [],
            altStack: []
        };
        this.onData = new Event_1.Emitter().event;
        this.onUserInput = new Event_1.Emitter().event;
        this.onBinary = new Event_1.Emitter().event;
        this.onRequestScrollToBottom = new Event_1.Emitter().event;
    }
    reset() { }
    triggerDataEvent(data, wasUserInput) { }
    triggerBinaryEvent(data) { }
}
exports.MockCoreService = MockCoreService;
class MockLogService {
    constructor() {
        this.logLevel = Services_1.LogLevelEnum.DEBUG;
    }
    trace(message, ...optionalParams) { }
    debug(message, ...optionalParams) { }
    info(message, ...optionalParams) { }
    warn(message, ...optionalParams) { }
    error(message, ...optionalParams) { }
}
exports.MockLogService = MockLogService;
class MockOptionsService {
    constructor(testOptions) {
        this.rawOptions = structuredClone(OptionsService_1.DEFAULT_OPTIONS);
        this.options = this.rawOptions;
        this.onOptionChange = new Event_1.Emitter().event;
        if (testOptions) {
            for (const key of Object.keys(testOptions)) {
                this.rawOptions[key] = testOptions[key];
            }
        }
    }
    onSpecificOptionChange(key, listener) {
        return this.onOptionChange(eventKey => {
            if (eventKey === key) {
                listener(this.rawOptions[key]);
            }
        });
    }
    onMultipleOptionChange(keys, listener) {
        return this.onOptionChange(eventKey => {
            if (keys.indexOf(eventKey) !== -1) {
                listener();
            }
        });
    }
    setOptions(options) {
        for (const key of Object.keys(options)) {
            this.options[key] = options[key];
        }
    }
}
exports.MockOptionsService = MockOptionsService;
class MockOscLinkService {
    registerLink(linkData) {
        return 1;
    }
    getLinkData(linkId) {
        return undefined;
    }
    addLineToLink(linkId, y) {
    }
}
exports.MockOscLinkService = MockOscLinkService;
class MockUnicodeService {
    constructor() {
        this._provider = new UnicodeV6_1.UnicodeV6();
        this.versions = [];
        this.activeVersion = '';
        this.onChange = new Event_1.Emitter().event;
        this.wcwidth = (codepoint) => this._provider.wcwidth(codepoint);
    }
    register(provider) {
        throw new Error('Method not implemented.');
    }
    charProperties(codepoint, preceding) {
        let width = this.wcwidth(codepoint);
        let shouldJoin = width === 0 && preceding !== 0;
        if (shouldJoin) {
            const oldWidth = UnicodeService_1.UnicodeService.extractWidth(preceding);
            if (oldWidth === 0) {
                shouldJoin = false;
            }
            else if (oldWidth > width) {
                width = oldWidth;
            }
        }
        return UnicodeService_1.UnicodeService.createPropertyValue(0, width, shouldJoin);
    }
    getStringCellWidth(s) {
        throw new Error('Method not implemented.');
    }
}
exports.MockUnicodeService = MockUnicodeService;
class MockDecorationService {
    constructor() {
        this.onDecorationRegistered = new Event_1.Emitter().event;
        this.onDecorationRemoved = new Event_1.Emitter().event;
    }
    get decorations() { return [].values(); }
    registerDecoration(decorationOptions) { return undefined; }
    reset() { }
    forEachDecorationAtCell(x, line, layer, callback) { }
    dispose() { }
}
exports.MockDecorationService = MockDecorationService;
//# sourceMappingURL=TestUtils.test.js.map