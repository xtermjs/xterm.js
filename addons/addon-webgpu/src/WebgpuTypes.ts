/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export type IGPUTextureFormat = string;

export interface IGPUTextureView {
}

export interface IGPUTexture {
  createView(): IGPUTextureView;
}

export interface IGPUCanvasConfiguration {
  device: IGPUDevice;
  format: IGPUTextureFormat;
  alphaMode?: 'opaque' | 'premultiplied';
}

export interface IGPUCanvasContext {
  configure(config: IGPUCanvasConfiguration): void;
  getCurrentTexture(): IGPUTexture;
}

export interface IGPUQueue {
  submit(commandBuffers: IGPUCommandBuffer[]): void;
}

export interface IGPURenderPassEncoder {
  end(): void;
}

export interface IGPUCommandBuffer {
}

export interface IGPURenderPassColorAttachment {
  view: IGPUTextureView;
  clearValue?: { r: number, g: number, b: number, a: number };
  loadOp: 'load' | 'clear';
  storeOp: 'store' | 'discard';
}

export interface IGPURenderPassDescriptor {
  colorAttachments: IGPURenderPassColorAttachment[];
}

export interface IGPUCommandEncoder {
  beginRenderPass(descriptor: IGPURenderPassDescriptor): IGPURenderPassEncoder;
  finish(): IGPUCommandBuffer;
}

export interface IGPUDevice {
  queue: IGPUQueue;
  lost: Promise<unknown>;
  createCommandEncoder(): IGPUCommandEncoder;
  destroy?(): void;
}

export interface IGPUAdapter {
  requestDevice(): Promise<IGPUDevice>;
}

export interface IGPU {
  requestAdapter(): Promise<IGPUAdapter | null>;
  getPreferredCanvasFormat(): IGPUTextureFormat;
}
