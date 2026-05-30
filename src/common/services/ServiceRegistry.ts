/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This was heavily inspired from microsoft/vscode's dependency injection system (MIT).
 */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IServiceIdentifier } from 'common/services/Services';

const enum Constants {
  DI_TARGET = 'di$target',
  DI_DEPENDENCIES = 'di$dependencies'
}

export const serviceRegistry: Map<string, IServiceIdentifier<any>> = new Map();

export function getServiceDependencies(ctor: any): { id: IServiceIdentifier<any>, index: number, optional: boolean }[] {
  return ctor[Constants.DI_DEPENDENCIES] || [];
}

export function createDecorator<T>(id: string): IServiceIdentifier<T> {
  if (serviceRegistry.has(id)) {
    return serviceRegistry.get(id)!;
  }

  const decorator: any = function (target: Function, key: string, index: number): any {
    if (arguments.length !== 3) {
      throw new Error('@IServiceName-decorator can only be used to decorate a parameter');
    }

    storeServiceDependency(decorator, target, index);
  };

  decorator._id = id;

  serviceRegistry.set(id, decorator);
  return decorator;
}

function storeServiceDependency(id: Function, target: Function, index: number): void {
  if ((target as any)[Constants.DI_TARGET] === target) {
    (target as any)[Constants.DI_DEPENDENCIES].push({ id, index });
  } else {
    (target as any)[Constants.DI_DEPENDENCIES] = [{ id, index }];
    (target as any)[Constants.DI_TARGET] = target;
  }
}
