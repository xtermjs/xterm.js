/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { alignBufferSize, createBlendState, createBufferWithData, expandFloat32Array, GPU_BUFFER_USAGE, toError } from './WebgpuUtils';

describe('WebgpuUtils', () => {
  it('aligns non-empty GPU buffers to four bytes', () => {
    assert.equal(alignBufferSize(0), 4);
    assert.equal(alignBufferSize(1), 4);
    assert.equal(alignBufferSize(4), 4);
    assert.equal(alignBufferSize(5), 8);
  });

  it('grows Float32Arrays up to the requested maximum', () => {
    const source = new Float32Array([1, 2]);
    assert.deepEqual([...expandFloat32Array(source, 8)], [1, 2, 0, 0]);
    assert.deepEqual([...expandFloat32Array(source, 3)], [1, 2, 0]);
  });

  it('creates and uploads an initialized GPU buffer', () => {
    let descriptor: GPUBufferDescriptor | undefined;
    let upload: unknown[] | undefined;
    const expectedBuffer = {} as GPUBuffer;
    const device = {
      createBuffer: (value: GPUBufferDescriptor) => {
        descriptor = value;
        return expectedBuffer;
      },
      queue: {
        writeBuffer: (...args: unknown[]) => upload = args
      }
    } as unknown as GPUDevice;
    const data = new Float32Array([1, 2]);

    assert.equal(createBufferWithData(device, 'test', GPU_BUFFER_USAGE.VERTEX, data), expectedBuffer);
    assert.deepEqual(descriptor, {
      label: 'test',
      size: 8,
      usage: GPU_BUFFER_USAGE.VERTEX | GPU_BUFFER_USAGE.COPY_DST
    });
    assert.equal(upload?.[0], expectedBuffer);
    assert.equal(upload?.[1], 0);
    assert.equal(upload?.[2], data.buffer);
    assert.equal(upload?.[3], 0);
    assert.equal(upload?.[4], data.byteLength);
  });

  it('uses premultiplied-alpha blending', () => {
    assert.deepEqual(createBlendState(), {
      color: { operation: 'add', srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
      alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }
    });
  });

  it('normalizes unknown failures to Error objects', () => {
    const original = new Error('original');
    assert.equal(toError(original), original);
    assert.equal(toError('failed').message, 'failed');
  });
});
