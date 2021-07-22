"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Terminal = void 0;
var BufferLine_1 = require("common/buffer/BufferLine");
var CoreTerminal_1 = require("common/CoreTerminal");
var EventEmitter_1 = require("common/EventEmitter");
var Terminal = (function (_super) {
    __extends(Terminal, _super);
    function Terminal(options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this, options) || this;
        _this._onBell = new EventEmitter_1.EventEmitter();
        _this._onCursorMove = new EventEmitter_1.EventEmitter();
        _this._onTitleChange = new EventEmitter_1.EventEmitter();
        _this._onA11yCharEmitter = new EventEmitter_1.EventEmitter();
        _this._onA11yTabEmitter = new EventEmitter_1.EventEmitter();
        _this._setup();
        _this.register(_this._inputHandler.onRequestBell(function () { return _this.bell(); }));
        _this.register(_this._inputHandler.onRequestReset(function () { return _this.reset(); }));
        _this.register(EventEmitter_1.forwardEvent(_this._inputHandler.onCursorMove, _this._onCursorMove));
        _this.register(EventEmitter_1.forwardEvent(_this._inputHandler.onTitleChange, _this._onTitleChange));
        _this.register(EventEmitter_1.forwardEvent(_this._inputHandler.onA11yChar, _this._onA11yCharEmitter));
        _this.register(EventEmitter_1.forwardEvent(_this._inputHandler.onA11yTab, _this._onA11yTabEmitter));
        return _this;
    }
    Object.defineProperty(Terminal.prototype, "options", {
        get: function () { return this.optionsService.options; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onBell", {
        get: function () { return this._onBell.event; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onCursorMove", {
        get: function () { return this._onCursorMove.event; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onTitleChange", {
        get: function () { return this._onTitleChange.event; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onA11yChar", {
        get: function () { return this._onA11yCharEmitter.event; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onA11yTab", {
        get: function () { return this._onA11yTabEmitter.event; },
        enumerable: false,
        configurable: true
    });
    Terminal.prototype.dispose = function () {
        if (this._isDisposed) {
            return;
        }
        _super.prototype.dispose.call(this);
        this.write = function () { };
    };
    Object.defineProperty(Terminal.prototype, "buffer", {
        get: function () {
            return this.buffers.active;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "markers", {
        get: function () {
            return this.buffer.markers;
        },
        enumerable: false,
        configurable: true
    });
    Terminal.prototype.addMarker = function (cursorYOffset) {
        if (this.buffer !== this.buffers.normal) {
            return;
        }
        return this.buffer.addMarker(this.buffer.ybase + this.buffer.y + cursorYOffset);
    };
    Terminal.prototype.bell = function () {
        this._onBell.fire();
    };
    Terminal.prototype.resize = function (x, y) {
        if (x === this.cols && y === this.rows) {
            return;
        }
        _super.prototype.resize.call(this, x, y);
    };
    Terminal.prototype.clear = function () {
        if (this.buffer.ybase === 0 && this.buffer.y === 0) {
            return;
        }
        this.buffer.lines.set(0, this.buffer.lines.get(this.buffer.ybase + this.buffer.y));
        this.buffer.lines.length = 1;
        this.buffer.ydisp = 0;
        this.buffer.ybase = 0;
        this.buffer.y = 0;
        for (var i = 1; i < this.rows; i++) {
            this.buffer.lines.push(this.buffer.getBlankLine(BufferLine_1.DEFAULT_ATTR_DATA));
        }
        this._onScroll.fire({ position: this.buffer.ydisp, source: 0 });
    };
    Terminal.prototype.reset = function () {
        this.options.rows = this.rows;
        this.options.cols = this.cols;
        this._setup();
        _super.prototype.reset.call(this);
    };
    return Terminal;
}(CoreTerminal_1.CoreTerminal));
exports.Terminal = Terminal;
//# sourceMappingURL=Terminal.js.map