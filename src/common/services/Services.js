"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDecorationService = exports.IUnicodeService = exports.IOscLinkService = exports.IOptionsService = exports.ILogService = exports.LogLevelEnum = exports.IInstantiationService = exports.ICharsetService = exports.ICoreService = exports.IMouseStateService = exports.IBufferService = void 0;
const ServiceRegistry_1 = require("common/services/ServiceRegistry");
exports.IBufferService = (0, ServiceRegistry_1.createDecorator)('BufferService');
exports.IMouseStateService = (0, ServiceRegistry_1.createDecorator)('MouseStateService');
exports.ICoreService = (0, ServiceRegistry_1.createDecorator)('CoreService');
exports.ICharsetService = (0, ServiceRegistry_1.createDecorator)('CharsetService');
exports.IInstantiationService = (0, ServiceRegistry_1.createDecorator)('InstantiationService');
var LogLevelEnum;
(function (LogLevelEnum) {
    LogLevelEnum[LogLevelEnum["TRACE"] = 0] = "TRACE";
    LogLevelEnum[LogLevelEnum["DEBUG"] = 1] = "DEBUG";
    LogLevelEnum[LogLevelEnum["INFO"] = 2] = "INFO";
    LogLevelEnum[LogLevelEnum["WARN"] = 3] = "WARN";
    LogLevelEnum[LogLevelEnum["ERROR"] = 4] = "ERROR";
    LogLevelEnum[LogLevelEnum["OFF"] = 5] = "OFF";
})(LogLevelEnum || (exports.LogLevelEnum = LogLevelEnum = {}));
exports.ILogService = (0, ServiceRegistry_1.createDecorator)('LogService');
exports.IOptionsService = (0, ServiceRegistry_1.createDecorator)('OptionsService');
exports.IOscLinkService = (0, ServiceRegistry_1.createDecorator)('OscLinkService');
exports.IUnicodeService = (0, ServiceRegistry_1.createDecorator)('UnicodeService');
exports.IDecorationService = (0, ServiceRegistry_1.createDecorator)('DecorationService');
//# sourceMappingURL=Services.js.map