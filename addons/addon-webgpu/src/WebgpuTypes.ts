/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export type GPUTextureFormat = string;

export interface GPUTextureView {
}

export interface GPUTexture {
  createView(): GPUTextureView;
}

export interface GPUCanvasConfiguration {
  device: GPUDevice;
  format: GPUTextureFormat;
  alphaMode?: 'opaque' | 'premultiplied';
}

export interface GPUCanvasContext {
  configure(config: GPUCanvasConfiguration): void;
  getCurrentTexture(): GPUTexture;
}

export interface GPUQueue {
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

export interface GPURenderPassEncoder {
  end(): void;
}

export interface GPUCommandBuffer {
}

export interface GPURenderPassDescriptor {
  colorAttachments: Array<{
    view: GPUTextureView;
    clearValue?: { r: number; g: number; b: number; a: number };
    loadOp: 'load' | 'clear';
    storeOp: 'store' | 'discard';
  }>;
}

export interface GPUCommandEncoder {
  beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

export interface GPUDevice {
  queue: GPUQueue;
  lost: Promise<unknown>;
  createCommandEncoder(): GPUCommandEncoder;
  destroy?(): void;
}

export interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
}

export interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}
