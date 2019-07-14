/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IServiceIdentifier } from 'common/services/Services';

const DI_TARGET = 'di$target';
const DI_DEPENDENCIES = 'di$dependencies';

export const serviceRegistry: Map<string, IServiceIdentifier<any>> = new Map();

export function getServiceDependencies(ctor: any): { id: IServiceIdentifier<any>, index: number, optional: boolean }[] {
  return ctor[DI_DEPENDENCIES] || [];
}

export function createDecorator<T>(id: string): IServiceIdentifier<T> {
  if (serviceRegistry.has(id)) {
    return serviceRegistry.get(id)!;
  }

  const decorator = <any>function (target: Function, key: string, index: number): any {
    if (arguments.length !== 3) {
      throw new Error('@IServiceName-decorator can only be used to decorate a parameter');
    }

    storeServiceDependency(decorator, target, index);
  };

  decorator.toString = () => id;

  serviceRegistry.set(id, decorator);
  return decorator;
}

function storeServiceDependency(id: Function, target: Function, index: number): void {
  if ((target as any)[DI_TARGET] === target) {
    (target as any)[DI_DEPENDENCIES].push({ id, index });
  } else {
    (target as any)[DI_DEPENDENCIES] = [{ id, index }];
    (target as any)[DI_TARGET] = target;
  }
}
