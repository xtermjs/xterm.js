"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceRegistry = void 0;
exports.getServiceDependencies = getServiceDependencies;
exports.createDecorator = createDecorator;
exports.serviceRegistry = new Map();
function getServiceDependencies(ctor) {
    return ctor["di$dependencies"] || [];
}
function createDecorator(id) {
    if (exports.serviceRegistry.has(id)) {
        return exports.serviceRegistry.get(id);
    }
    const decorator = function (target, key, index) {
        if (arguments.length !== 3) {
            throw new Error('@IServiceName-decorator can only be used to decorate a parameter');
        }
        storeServiceDependency(decorator, target, index);
    };
    decorator._id = id;
    exports.serviceRegistry.set(id, decorator);
    return decorator;
}
function storeServiceDependency(id, target, index) {
    if (target["di$target"] === target) {
        target["di$dependencies"].push({ id, index });
    }
    else {
        target["di$dependencies"] = [{ id, index }];
        target["di$target"] = target;
    }
}
//# sourceMappingURL=ServiceRegistry.js.map