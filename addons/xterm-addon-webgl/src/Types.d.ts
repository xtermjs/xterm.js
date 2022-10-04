/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ISelectionRenderModel } from 'browser/renderer/shared/Types';

export interface IRenderModel {
  cells: Uint32Array;
  lineLengths: Uint32Array;
  selection: ISelectionRenderModel;
}

export interface IWebGL2RenderingContext extends WebGLRenderingContext {
  vertexAttribDivisor(index: number, divisor: number): void;
  createVertexArray(): IWebGLVertexArrayObject;
  bindVertexArray(vao: IWebGLVertexArrayObject): void;
  drawElementsInstanced(mode: number, count: number, type: number, offset: number, instanceCount: number): void;
}

export interface IWebGLVertexArrayObject {
}
