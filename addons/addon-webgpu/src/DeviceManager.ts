/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Emitter } from 'common/Event';
import { Disposable, IDisposable, toDisposable } from 'common/Lifecycle';
import type { IWebgpuDeviceLostEvent } from './Types';

interface IDeviceEntry {
  promise: Promise<SharedDevice>;
  references: number;
}

export interface IDeviceReference extends IDisposable {
  readonly value: SharedDevice;
}

// Scope sharing to the navigator's GPU, so independent windows can acquire their own device.
const devices = new WeakMap<GPU, IDeviceEntry>();

export async function acquireDevice(gpu: GPU): Promise<IDeviceReference> {
  let entry = devices.get(gpu);
  if (!entry) {
    const newEntry: IDeviceEntry = {
      references: 0,
      promise: createDevice(gpu, () => {
        if (devices.get(gpu) === newEntry) {
          devices.delete(gpu);
        }
      })
    };
    devices.set(gpu, newEntry);
    entry = newEntry;
  }
  // Reserve pending acquisitions too: releasing an earlier caller must not destroy their device.
  entry.references++;
  const current = entry;
  let shared: SharedDevice;
  try {
    shared = await current.promise;
  } catch (error) {
    current.references--;
    if (devices.get(gpu) === current) {
      devices.delete(gpu);
    }
    throw error;
  }
  let released = false;
  const reference: IDeviceReference = {
    value: shared,
    dispose: () => {
      if (released) {
        return;
      }
      released = true;
      if (--current.references === 0) {
        if (devices.get(gpu) === current) {
          devices.delete(gpu);
        }
        shared.dispose();
      }
    }
  };
  if (shared.deviceLoss) {
    reference.dispose();
    throw new Error(`WebGPU device was lost during initialization: ${shared.deviceLoss.message}`);
  }
  return reference;
}

async function createDevice(gpu: GPU, invalidate: () => void): Promise<SharedDevice> {
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU did not provide a compatible GPU adapter');
  }
  return new SharedDevice(await adapter.requestDevice(), invalidate);
}

export class SharedDevice extends Disposable {
  private readonly _resources = new Map<string, unknown>();
  private readonly _onDeviceLoss = this._register(new Emitter<IWebgpuDeviceLostEvent>());
  public readonly onDeviceLoss = this._onDeviceLoss.event;
  private readonly _onUncapturedError = this._register(new Emitter<Error>());
  public readonly onUncapturedError = this._onUncapturedError.event;
  private _deviceLoss: IWebgpuDeviceLostEvent | undefined;

  constructor(public readonly device: GPUDevice, invalidate: () => void) {
    super();
    const listener = (event: GPUUncapturedErrorEvent): void => {
      this._onUncapturedError.fire(new Error(event.error.message));
    };
    device.addEventListener('uncapturederror', listener);
    this._register(toDisposable(() => device.removeEventListener('uncapturederror', listener)));
    void device.lost.then(info => {
      if (this._store.isDisposed) {
        return;
      }
      // Evict before notifying clients: a loss listener may immediately start a replacement.
      invalidate();
      this._resources.clear();
      this._deviceLoss = { reason: info.reason, message: info.message };
      this._onDeviceLoss.fire(this._deviceLoss);
    });
  }

  public get deviceLoss(): IWebgpuDeviceLostEvent | undefined {
    return this._deviceLoss;
  }

  /** Keys include the resource kind and all pipeline configuration (format, atlas page count). */
  public getResources<T>(key: string, create: () => T): T {
    if (!this._resources.has(key)) {
      this._resources.set(key, create());
    }
    return this._resources.get(key) as T;
  }

  public override dispose(): void {
    if (this._store.isDisposed) {
      return;
    }
    super.dispose();
    this._resources.clear();
    this.device.destroy();
  }
}
