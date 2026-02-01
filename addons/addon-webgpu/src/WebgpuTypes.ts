/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export type IGPUTextureFormat = string;
export type IGPUBufferUsage = number;
export type IGPUTextureUsage = number;
export type IGPUShaderStage = number;
export type IGPUBufferSource = ArrayBuffer | ArrayBufferView | ArrayBufferLike;

export interface IGPUOrigin2D {
  x?: number;
  y?: number;
}

export interface IGPUOrigin3D {
  x?: number;
  y?: number;
  z?: number;
}

export interface IGPUExtent3D {
  width: number;
  height: number;
  depthOrArrayLayers?: number;
}

export interface IGPUTextureViewDescriptor {
  format?: IGPUTextureFormat;
  dimension?: '2d';
  baseMipLevel?: number;
  mipLevelCount?: number;
  baseArrayLayer?: number;
  arrayLayerCount?: number;
}

export interface IGPUTextureView {
}

export interface IGPUTexture {
  createView(descriptor?: IGPUTextureViewDescriptor): IGPUTextureView;
  destroy?(): void;
}

export interface IGPUBuffer {
  size: number;
  destroy?(): void;
}

export interface IGPUBufferDescriptor {
  size: number;
  usage: IGPUBufferUsage;
  mappedAtCreation?: boolean;
}

export interface IGPUTextureDescriptor {
  size: IGPUExtent3D;
  format: IGPUTextureFormat;
  usage: IGPUTextureUsage;
  dimension?: '2d';
  mipLevelCount?: number;
  sampleCount?: number;
}

export interface IGPUSamplerDescriptor {
  minFilter?: 'nearest' | 'linear';
  magFilter?: 'nearest' | 'linear';
  mipmapFilter?: 'nearest' | 'linear';
  addressModeU?: 'clamp-to-edge' | 'repeat' | 'mirror-repeat';
  addressModeV?: 'clamp-to-edge' | 'repeat' | 'mirror-repeat';
}

export interface IGPUShaderModuleDescriptor {
  code: string;
}

export interface IGPUVertexAttribute {
  format: string;
  offset: number;
  shaderLocation: number;
}

export interface IGPUVertexBufferLayout {
  arrayStride: number;
  stepMode?: 'vertex' | 'instance';
  attributes: IGPUVertexAttribute[];
}

export interface IGPUVertexState {
  module: IGPUShaderModule;
  entryPoint: string;
  buffers?: IGPUVertexBufferLayout[];
}

export interface IGPUColorTargetState {
  format: IGPUTextureFormat;
  blend?: {
    color?: { srcFactor: string; dstFactor: string; operation: string };
    alpha?: { srcFactor: string; dstFactor: string; operation: string };
  };
  writeMask?: number;
}

export interface IGPUFragmentState {
  module: IGPUShaderModule;
  entryPoint: string;
  targets: IGPUColorTargetState[];
}

export interface IGPUPrimitiveState {
  topology?: 'triangle-strip' | 'triangle-list';
  stripIndexFormat?: 'uint16' | 'uint32';
  cullMode?: 'none' | 'front' | 'back';
}

export interface IGPURenderPipelineDescriptor {
  layout?: IGPUPipelineLayout | 'auto';
  vertex: IGPUVertexState;
  fragment?: IGPUFragmentState;
  primitive?: IGPUPrimitiveState;
}

export interface IGPURenderPipeline {
}

export interface IGPUSampler {
}

export interface IGPUShaderModule {
}

export interface IGPUBindGroup {
}

export interface IGPUBindGroupLayout {
}

export interface IGPUPipelineLayout {
}

export interface IGPUBindGroupLayoutEntry {
  binding: number;
  visibility: IGPUShaderStage;
  buffer?: { type?: 'uniform' | 'storage' | 'read-only-storage'; hasDynamicOffset?: boolean; minBindingSize?: number };
  sampler?: { type?: 'filtering' | 'non-filtering' };
  texture?: { sampleType?: 'float' | 'unfilterable-float'; viewDimension?: '2d'; multisampled?: boolean };
  count?: number;
}

export interface IGPUBindGroupLayoutDescriptor {
  entries: IGPUBindGroupLayoutEntry[];
}

export interface IGPUBindGroupEntry {
  binding: number;
  resource: IGPUBufferBinding | IGPUSampler | IGPUTextureView | Array<IGPUTextureView>;
}

export interface IGPUBindGroupDescriptor {
  layout: IGPUBindGroupLayout;
  entries: IGPUBindGroupEntry[];
}

export interface IGPUBufferBinding {
  buffer: IGPUBuffer;
  offset?: number;
  size?: number;
}

export interface IGPUPipelineLayoutDescriptor {
  bindGroupLayouts: IGPUBindGroupLayout[];
}

export interface IGPUImageCopyExternalImage {
  source: CanvasImageSource;
  origin?: IGPUOrigin2D;
  flipY?: boolean;
}

export interface IGPUImageCopyTexture {
  texture: IGPUTexture;
  origin?: IGPUOrigin3D;
}

export interface IGPUTextureDataLayout {
  offset?: number;
  bytesPerRow: number;
  rowsPerImage?: number;
}

export interface IGPUCanvasConfiguration {
  device: IGPUDevice;
  format: IGPUTextureFormat;
  alphaMode?: 'opaque' | 'premultiplied';
  usage?: IGPUTextureUsage;
  viewFormats?: IGPUTextureFormat[];
}

export interface IGPUCanvasContext {
  configure(config: IGPUCanvasConfiguration): void;
  getCurrentTexture(): IGPUTexture;
}

export interface IGPUQueue {
  submit(commandBuffers: IGPUCommandBuffer[]): void;
  writeBuffer(buffer: IGPUBuffer, bufferOffset: number, data: IGPUBufferSource, dataOffset?: number, size?: number): void;
  writeTexture(destination: IGPUImageCopyTexture, data: IGPUBufferSource, dataLayout: IGPUTextureDataLayout, size: IGPUExtent3D): void;
  copyExternalImageToTexture(source: IGPUImageCopyExternalImage, destination: IGPUImageCopyTexture, copySize: IGPUExtent3D): void;
}

export interface IGPURenderPassEncoder {
  setPipeline(pipeline: IGPURenderPipeline): void;
  setBindGroup(index: number, bindGroup: IGPUBindGroup): void;
  setVertexBuffer(slot: number, buffer: IGPUBuffer): void;
  draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
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
  limits?: { maxSampledTexturesPerShaderStage?: number; maxTextureDimension2D?: number };
  createCommandEncoder(): IGPUCommandEncoder;
  createBuffer(descriptor: IGPUBufferDescriptor): IGPUBuffer;
  createTexture(descriptor: IGPUTextureDescriptor): IGPUTexture;
  createSampler(descriptor?: IGPUSamplerDescriptor): IGPUSampler;
  createShaderModule(descriptor: IGPUShaderModuleDescriptor): IGPUShaderModule;
  createRenderPipeline(descriptor: IGPURenderPipelineDescriptor): IGPURenderPipeline;
  createBindGroupLayout(descriptor: IGPUBindGroupLayoutDescriptor): IGPUBindGroupLayout;
  createPipelineLayout(descriptor: IGPUPipelineLayoutDescriptor): IGPUPipelineLayout;
  createBindGroup(descriptor: IGPUBindGroupDescriptor): IGPUBindGroup;
  destroy?(): void;
}

export interface IGPUAdapter {
  requestDevice(): Promise<IGPUDevice>;
}

export interface IGPU {
  requestAdapter(): Promise<IGPUAdapter | null>;
  getPreferredCanvasFormat(): IGPUTextureFormat;
}
