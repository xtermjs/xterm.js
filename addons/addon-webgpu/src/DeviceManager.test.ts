/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { acquireDevice } from './DeviceManager';

function createDevice() {
  let lose!: (info: GPUDeviceLostInfo) => void;
  let destroyed = 0;
  const listeners = new Set<(event: GPUUncapturedErrorEvent) => void>();
  const device = {
    lost: new Promise<GPUDeviceLostInfo>(resolve => lose = resolve),
    destroy: () => destroyed++,
    addEventListener: (_type: string, listener: (event: GPUUncapturedErrorEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: GPUUncapturedErrorEvent) => void) => listeners.delete(listener)
  } as unknown as GPUDevice;
  return { device, lose, listeners, get destroyed() { return destroyed; } };
}

function createGpu(requestDevice: () => Promise<GPUDevice>) {
  let requests = 0;
  const gpu = {
    requestAdapter: async () => {
      requests++;
      return { requestDevice } as GPUAdapter;
    }
  } as GPU;
  return { gpu, get requests() { return requests; } };
}

describe('WebGPU DeviceManager', () => {
  it('coalesces pending acquisitions and destroys the device only after the last release', async () => {
    const fake = createDevice();
    let resolve!: (device: GPUDevice) => void;
    let deviceRequests = 0;
    const source = createGpu(() => {
      deviceRequests++;
      return new Promise<GPUDevice>(r => resolve = r);
    });
    const first = acquireDevice(source.gpu);
    const second = acquireDevice(source.gpu);
    await Promise.resolve();
    resolve(fake.device);
    const [a, b] = await Promise.all([first, second]);
    assert.strictEqual(a.value, b.value);
    assert.equal(source.requests, 1);
    assert.equal(deviceRequests, 1);
    assert.equal(fake.listeners.size, 1);
    a.dispose();
    a.dispose();
    assert.equal(fake.destroyed, 0);
    b.dispose();
    assert.equal(fake.destroyed, 1);
    assert.equal(fake.listeners.size, 0);
  });

  it('reserves a reference for an acquisition whose caller has not resumed yet', async () => {
    const fake = createDevice();
    const source = createGpu(async () => fake.device);
    const first = await acquireDevice(source.gpu);
    const pending = acquireDevice(source.gpu);
    first.dispose();
    assert.equal(fake.destroyed, 0);
    const second = await pending;
    assert.strictEqual(second.value.device, fake.device);
    second.dispose();
    assert.equal(fake.destroyed, 1);
  });

  it('acquires a fresh device after the last release', async () => {
    const first = createDevice();
    const second = createDevice();
    const source = createGpu(async () => source.requests === 1 ? first.device : second.device);
    const a = await acquireDevice(source.gpu);
    a.dispose();
    const b = await acquireDevice(source.gpu);
    assert.strictEqual(b.value.device, second.device);
    assert.equal(source.requests, 2);
    b.dispose();
  });

  it('does not share devices across different GPU entry points', async () => {
    const first = createDevice();
    const second = createDevice();
    const a = await acquireDevice(createGpu(async () => first.device).gpu);
    const b = await acquireDevice(createGpu(async () => second.device).gpu);
    assert.notStrictEqual(a.value, b.value);
    a.dispose();
    assert.equal(second.destroyed, 0);
    b.dispose();
  });

  it('evicts failed acquisitions so later callers can retry', async () => {
    const fake = createDevice();
    let fail = true;
    const source = createGpu(async () => {
      if (fail) {
        throw new Error('device request failed');
      }
      return fake.device;
    });
    const results = await Promise.allSettled([acquireDevice(source.gpu), acquireDevice(source.gpu)]);
    assert.deepEqual(results.map(r => r.status), ['rejected', 'rejected']);
    assert.equal(source.requests, 1);
    fail = false;
    const reference = await acquireDevice(source.gpu);
    assert.equal(source.requests, 2);
    reference.dispose();
  });

  it('evicts a null adapter so later callers can retry', async () => {
    const fake = createDevice();
    let requests = 0;
    const gpu = {
      requestAdapter: async () => ++requests === 1 ? null : { requestDevice: async () => fake.device }
    } as GPU;
    const result = await Promise.allSettled([acquireDevice(gpu)]);
    assert.equal(result[0].status, 'rejected');
    const reference = await acquireDevice(gpu);
    assert.equal(requests, 2);
    reference.dispose();
  });

  for (const reason of ['unknown', 'destroyed'] as const) {
    it(`broadcasts ${reason} device loss and preserves a replacement when old references release`, async () => {
      const first = createDevice();
      const second = createDevice();
      const source = createGpu(async () => source.requests === 1 ? first.device : second.device);
      const a = await acquireDevice(source.gpu);
      const b = await acquireDevice(source.gpu);
      let notifications = 0;
      let replacement: ReturnType<typeof acquireDevice> | undefined;
      a.value.onDeviceLoss(info => {
        assert.equal(info.reason, reason);
        notifications++;
        replacement = acquireDevice(source.gpu);
        a.dispose();
      });
      b.value.onDeviceLoss(() => {
        notifications++;
        b.dispose();
      });
      first.lose({ reason, message: 'test loss' } as GPUDeviceLostInfo);
      await Promise.resolve();
      const c = await replacement!;
      assert.equal(notifications, 2);
      assert.strictEqual(c.value.device, second.device);
      const d = await acquireDevice(source.gpu);
      assert.strictEqual(c.value, d.value);
      assert.equal(source.requests, 2);
      c.dispose();
      d.dispose();
    });
  }

  it('rejects a device already lost during acquisition', async () => {
    const fake = createDevice();
    fake.lose({ reason: 'unknown', message: 'already lost' } as GPUDeviceLostInfo);
    const result = await Promise.allSettled([acquireDevice(createGpu(async () => fake.device).gpu)]);
    assert.equal(result[0].status, 'rejected');
    assert.equal(fake.destroyed, 1);
  });

  it('does not report intentional destruction after the last release', async () => {
    const fake = createDevice();
    const reference = await acquireDevice(createGpu(async () => fake.device).gpu);
    let notified = false;
    reference.value.onDeviceLoss(() => notified = true);
    reference.dispose();
    fake.lose({ reason: 'destroyed', message: '' } as GPUDeviceLostInfo);
    await Promise.resolve();
    assert.isFalse(notified);
  });

  it('shares compatible resources and broadcasts uncaptured errors', async () => {
    const fake = createDevice();
    const source = createGpu(async () => fake.device);
    const a = await acquireDevice(source.gpu);
    const b = await acquireDevice(source.gpu);
    const pipeline = a.value.getResources('glyph:bgra8unorm:16', () => ({}));
    assert.strictEqual(b.value.getResources('glyph:bgra8unorm:16', () => assert.fail('must reuse pipeline')), pipeline);
    assert.notStrictEqual(b.value.getResources('glyph:rgba8unorm:16', () => ({})), pipeline);
    assert.notStrictEqual(b.value.getResources('glyph:bgra8unorm:8', () => ({})), pipeline);
    const messages: string[] = [];
    a.value.onUncapturedError(error => messages.push(error.message));
    b.value.onUncapturedError(error => messages.push(error.message));
    for (const listener of fake.listeners) {
      listener({ error: { message: 'validation failed' } } as GPUUncapturedErrorEvent);
    }
    assert.deepEqual(messages, ['validation failed', 'validation failed']);
    a.dispose();
    b.dispose();
  });
});
