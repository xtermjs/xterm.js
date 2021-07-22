"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Terminal = void 0;
var BufferNamespaceApi_1 = require("common/public/BufferNamespaceApi");
var ParserApi_1 = require("common/public/ParserApi");
var UnicodeApi_1 = require("common/public/UnicodeApi");
var Terminal_1 = require("headless/Terminal");
var Terminal = (function () {
    function Terminal(options) {
        this._core = new Terminal_1.Terminal(options);
    }
    Terminal.prototype._checkProposedApi = function () {
        if (!this._core.optionsService.options.allowProposedApi) {
            throw new Error('You must set the allowProposedApi option to true to use proposed API');
        }
    };
    Object.defineProperty(Terminal.prototype, "onCursorMove", {
        get: function () { return this._core.onCursorMove; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onLineFeed", {
        get: function () { return this._core.onLineFeed; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onData", {
        get: function () { return this._core.onData; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onBinary", {
        get: function () { return this._core.onBinary; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onTitleChange", {
        get: function () { return this._core.onTitleChange; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "onResize", {
        get: function () { return this._core.onResize; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "parser", {
        get: function () {
            this._checkProposedApi();
            if (!this._parser) {
                this._parser = new ParserApi_1.ParserApi(this._core);
            }
            return this._parser;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "unicode", {
        get: function () {
            this._checkProposedApi();
            return new UnicodeApi_1.UnicodeApi(this._core);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "rows", {
        get: function () { return this._core.rows; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "cols", {
        get: function () { return this._core.cols; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "buffer", {
        get: function () {
            this._checkProposedApi();
            if (!this._buffer) {
                this._buffer = new BufferNamespaceApi_1.BufferNamespaceApi(this._core);
            }
            return this._buffer;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Terminal.prototype, "markers", {
        get: function () {
            this._checkProposedApi();
            return this._core.markers;
        },
        enumerable: false,
        configurable: true
    });
    Terminal.prototype.resize = function (columns, rows) {
        this._verifyIntegers(columns, rows);
        this._core.resize(columns, rows);
    };
    Terminal.prototype.registerMarker = function (cursorYOffset) {
        this._checkProposedApi();
        this._verifyIntegers(cursorYOffset);
        return this._core.addMarker(cursorYOffset);
    };
    Terminal.prototype.addMarker = function (cursorYOffset) {
        return this.registerMarker(cursorYOffset);
    };
    Terminal.prototype.dispose = function () {
        this._core.dispose();
    };
    Terminal.prototype.clear = function () {
        this._core.clear();
    };
    Terminal.prototype.write = function (data, callback) {
        this._core.write(data, callback);
    };
    Terminal.prototype.writeUtf8 = function (data, callback) {
        this._core.write(data, callback);
    };
    Terminal.prototype.writeln = function (data, callback) {
        this._core.write(data);
        this._core.write('\r\n', callback);
    };
    Terminal.prototype.getOption = function (key) {
        return this._core.optionsService.getOption(key);
    };
    Terminal.prototype.setOption = function (key, value) {
        this._core.optionsService.setOption(key, value);
    };
    Terminal.prototype.reset = function () {
        this._core.reset();
    };
    Terminal.prototype._verifyIntegers = function () {
        var values = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            values[_i] = arguments[_i];
        }
        for (var _a = 0, values_1 = values; _a < values_1.length; _a++) {
            var value = values_1[_a];
            if (value === Infinity || isNaN(value) || value % 1 !== 0) {
                throw new Error('This API only accepts integers');
            }
        }
    };
    return Terminal;
}());
exports.Terminal = Terminal;
//# sourceMappingURL=Terminal.js.map