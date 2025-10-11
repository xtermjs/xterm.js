/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { throwIfFalsy } from 'browser/renderer/shared/RendererUtils';

/**
 * A matrix that when multiplies will translate 0-1 coordinates (left to right,
 * top to bottom) to clip space.
 */
export const PROJECTION_MATRIX = new Float32Array([
  2, 0, 0, 0,
  0, -2, 0, 0,
  0, 0, 1, 0,
  -1, 1, 0, 1
]);

export function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | undefined {
  const program = throwIfFalsy(gl.createProgram());
  gl.attachShader(program, throwIfFalsy(createShader(gl, gl.VERTEX_SHADER, vertexSource)));
  gl.attachShader(program, throwIfFalsy(createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)));
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.error(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

export function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | undefined {
  const shader = throwIfFalsy(gl.createShader(type));
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.error(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

export function expandFloat32Array(source: Float32Array, max: number): Float32Array {
  const newLength = Math.min(source.length * 2, max);
  const newArray = new Float32Array(newLength);
  for (let i = 0; i < source.length; i++) {
    newArray[i] = source[i];
  }
  return newArray;
}

export class GLTexture {
  public texture: WebGLTexture;
  public version: number;

  constructor(texture: WebGLTexture) {
    this.texture = texture;
    this.version = -1;
  }
}
