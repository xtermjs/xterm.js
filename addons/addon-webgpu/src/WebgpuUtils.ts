/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/** Grow a Float32Array without exceeding the requested maximum. */
export function expandFloat32Array(source: Float32Array, max: number): Float32Array {
  const newLength = Math.min(Math.max(source.length * 2, 1), max);
  const newArray = new Float32Array(newLength);
  newArray.set(source);
  return newArray;
}

/** GPU buffers must have a non-zero size aligned to four bytes. */
export function alignBufferSize(size: number): number {
  return Math.max(4, Math.ceil(size / 4) * 4);
}

// TypeScript's built-in WebGPU declarations currently omit these runtime
// constants. Keep the small subset used by the renderer local to the addon so
// consumers do not need a second, conflicting set of ambient DOM declarations.
export const GPU_BUFFER_USAGE = {
  COPY_DST: 0x0008,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080
} as const;

export const GPU_TEXTURE_USAGE = {
  COPY_DST: 0x02,
  TEXTURE_BINDING: 0x04,
  RENDER_ATTACHMENT: 0x10
} as const;

export const GPU_SHADER_STAGE = {
  VERTEX: 0x1,
  FRAGMENT: 0x2
} as const;

export function createBufferWithData(device: GPUDevice, label: string, usage: GPUBufferUsageFlags, data: ArrayBufferView): GPUBuffer {
  const buffer = device.createBuffer({
    label,
    size: alignBufferSize(data.byteLength),
    usage: usage | GPU_BUFFER_USAGE.COPY_DST
  });
  if (data.byteLength > 0) {
    device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  }
  return buffer;
}

export function createBlendState(): GPUBlendState {
  return {
    color: {
      operation: 'add',
      srcFactor: 'src-alpha',
      dstFactor: 'one-minus-src-alpha'
    },
    alpha: {
      operation: 'add',
      srcFactor: 'one',
      dstFactor: 'one-minus-src-alpha'
    }
  };
}

export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
