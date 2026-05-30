"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionsService = exports.DEFAULT_OPTIONS = void 0;
const Lifecycle_1 = require("common/base/Lifecycle");
const Platform_1 = require("common/base/Platform");
const Event_1 = require("common/base/Event");
exports.DEFAULT_OPTIONS = {
    cols: 80,
    rows: 24,
    showCursorImmediately: false,
    cursorBlink: false,
    blinkIntervalDuration: 0,
    cursorStyle: 'block',
    cursorWidth: 1,
    cursorInactiveStyle: 'outline',
    drawBoldTextInBrightColors: true,
    documentOverride: null,
    fastScrollSensitivity: 5,
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: 'normal',
    fontWeightBold: 'bold',
    ignoreBracketedPasteMode: false,
    lineHeight: 1.0,
    letterSpacing: 0,
    linkHandler: null,
    logLevel: 'info',
    logger: null,
    scrollback: 1000,
    scrollbar: { showScrollbar: true },
    scrollOnEraseInDisplay: false,
    scrollOnUserInput: true,
    scrollSensitivity: 1,
    screenReaderMode: false,
    smoothScrollDuration: 0,
    macOptionIsMeta: false,
    macOptionClickForcesSelection: false,
    minimumContrastRatio: 1,
    mouseEventsRequireAlt: false,
    disableStdin: false,
    allowProposedApi: false,
    allowTransparency: false,
    tabStopWidth: 8,
    theme: {},
    reflowCursorLine: false,
    rescaleOverlappingGlyphs: false,
    rightClickSelectsWord: Platform_1.isMac,
    windowOptions: {},
    windowsPty: {},
    wordSeparator: ' ()[]{}\',"`',
    altClickMovesCursor: true,
    convertEol: false,
    termName: 'xterm',
    quirks: {},
    vtExtensions: {}
};
const FONT_WEIGHT_OPTIONS = ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
class OptionsService extends Lifecycle_1.Disposable {
    constructor(options) {
        super();
        this._onOptionChange = this._register(new Event_1.Emitter());
        this.onOptionChange = this._onOptionChange.event;
        const defaultOptions = { ...exports.DEFAULT_OPTIONS };
        for (const key in options) {
            if (key in defaultOptions) {
                try {
                    const newValue = options[key];
                    defaultOptions[key] = this._sanitizeAndValidateOption(key, newValue);
                }
                catch (e) {
                    console.error(e);
                }
            }
        }
        this.rawOptions = defaultOptions;
        this.options = { ...defaultOptions };
        this._setupOptions();
        this._register((0, Lifecycle_1.toDisposable)(() => {
            this.rawOptions.linkHandler = null;
            this.rawOptions.documentOverride = null;
        }));
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
    _setupOptions() {
        const getter = (propName) => {
            if (!(propName in exports.DEFAULT_OPTIONS)) {
                throw new Error(`No option with key "${propName}"`);
            }
            return this.rawOptions[propName];
        };
        const setter = (propName, value) => {
            if (!(propName in exports.DEFAULT_OPTIONS)) {
                throw new Error(`No option with key "${propName}"`);
            }
            value = this._sanitizeAndValidateOption(propName, value);
            if (this.rawOptions[propName] !== value) {
                this.rawOptions[propName] = value;
                this._onOptionChange.fire(propName);
            }
        };
        for (const propName in this.rawOptions) {
            const desc = {
                get: getter.bind(this, propName),
                set: setter.bind(this, propName)
            };
            Object.defineProperty(this.options, propName, desc);
        }
    }
    _sanitizeAndValidateOption(key, value) {
        switch (key) {
            case 'cursorStyle':
                if (!value) {
                    value = exports.DEFAULT_OPTIONS[key];
                }
                if (!isCursorStyle(value)) {
                    throw new Error(`"${value}" is not a valid value for ${key}`);
                }
                break;
            case 'wordSeparator':
                if (!value) {
                    value = exports.DEFAULT_OPTIONS[key];
                }
                break;
            case 'fontWeight':
            case 'fontWeightBold':
                if (typeof value === 'number' && 1 <= value && value <= 1000) {
                    break;
                }
                value = FONT_WEIGHT_OPTIONS.includes(value) ? value : exports.DEFAULT_OPTIONS[key];
                break;
            case 'blinkIntervalDuration':
                value = Math.floor(value);
                if (value < 0) {
                    throw new Error(`${key} cannot be less than 0, value: ${value}`);
                }
                break;
            case 'cursorWidth':
                value = Math.floor(value);
            case 'lineHeight':
            case 'tabStopWidth':
                if (value < 1) {
                    throw new Error(`${key} cannot be less than 1, value: ${value}`);
                }
                break;
            case 'minimumContrastRatio':
                value = Math.max(1, Math.min(21, Math.round(value * 10) / 10));
                break;
            case 'scrollback':
                value = Math.min(value, 4294967295);
                if (value < 0) {
                    throw new Error(`${key} cannot be less than 0, value: ${value}`);
                }
                break;
            case 'fastScrollSensitivity':
            case 'scrollSensitivity':
                if (value <= 0) {
                    throw new Error(`${key} cannot be less than or equal to 0, value: ${value}`);
                }
                break;
            case 'rows':
            case 'cols':
                if (!value && value !== 0) {
                    throw new Error(`${key} must be numeric, value: ${value}`);
                }
                break;
            case 'windowsPty':
                value = value ?? {};
                break;
        }
        return value;
    }
}
exports.OptionsService = OptionsService;
function isCursorStyle(value) {
    return value === 'block' || value === 'underline' || value === 'bar';
}
//# sourceMappingURL=OptionsService.js.map