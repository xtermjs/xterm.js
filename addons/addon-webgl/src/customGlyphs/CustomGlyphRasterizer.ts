/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { throwIfFalsy } from 'browser/renderer/shared/RendererUtils';
import { customGlyphDefinitions } from './CustomGlyphDefinitions';
import { CustomGlyphDefinitionType, CustomGlyphScaleType, CustomGlyphVectorType, type CustomGlyphDefinitionPart, type CustomGlyphPathDrawFunctionDefinition, type CustomGlyphPatternDefinition, type ICustomGlyphSolidOctantBlockVector, type ICustomGlyphVectorShape } from './Types';

/**
 * Try drawing a custom block element or box drawing character, returning whether it was
 * successfully drawn.
 */
export function tryDrawCustomGlyph(
  ctx: CanvasRenderingContext2D,
  c: string,
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number,
  deviceCharWidth: number,
  deviceCharHeight: number,
  fontSize: number,
  devicePixelRatio: number,
  backgroundColor?: string
): boolean {
  const unifiedCharDefinition = customGlyphDefinitions[c];
  if (unifiedCharDefinition) {
    // Normalize to array for uniform handling
    const parts = Array.isArray(unifiedCharDefinition) ? unifiedCharDefinition : [unifiedCharDefinition];
    for (const part of parts) {
      drawDefinitionPart(ctx, part, xOffset, yOffset, deviceCellWidth, deviceCellHeight, deviceCharWidth, deviceCharHeight, fontSize, devicePixelRatio, backgroundColor);
    }
    return true;
  }

  return false;
}

function drawDefinitionPart(
  ctx: CanvasRenderingContext2D,
  part: CustomGlyphDefinitionPart,
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number,
  deviceCharWidth: number,
  deviceCharHeight: number,
  fontSize: number,
  devicePixelRatio: number,
  backgroundColor?: string
): void {
  // Handle scaleType - adjust dimensions and offset when scaling to character area
  let drawWidth = deviceCellWidth;
  let drawHeight = deviceCellHeight;
  let drawXOffset = xOffset;
  let drawYOffset = yOffset;
  if (part.scaleType === CustomGlyphScaleType.CHAR) {
    drawWidth = deviceCharWidth;
    drawHeight = deviceCharHeight;
    // Center the character within the cell
    drawXOffset = xOffset + (deviceCellWidth - deviceCharWidth) / 2;
    drawYOffset = yOffset + (deviceCellHeight - deviceCharHeight) / 2;
  }

  // Handle clipPath generically for any definition type
  if (part.clipPath) {
    ctx.save();
    applyClipPath(ctx, part.clipPath, drawXOffset, drawYOffset, drawWidth, drawHeight);
  }

  switch (part.type) {
    case CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR:
      drawBlockVectorChar(ctx, part.data, drawXOffset, drawYOffset, drawWidth, drawHeight);
      break;
    case CustomGlyphDefinitionType.BLOCK_PATTERN:
      drawPatternChar(ctx, part.data, drawXOffset, drawYOffset, drawWidth, drawHeight);
      break;
    case CustomGlyphDefinitionType.PATH_FUNCTION:
      drawPathFunctionCharacter(ctx, part.data, drawXOffset, drawYOffset, drawWidth, drawHeight, devicePixelRatio, part.strokeWidth);
      break;
    case CustomGlyphDefinitionType.PATH:
      drawPathDefinitionCharacter(ctx, part.data, drawXOffset, drawYOffset, drawWidth, drawHeight, devicePixelRatio, part.strokeWidth);
      break;
    case CustomGlyphDefinitionType.PATH_NEGATIVE:
      drawPathNegativeDefinitionCharacter(ctx, part.data, drawXOffset, drawYOffset, drawWidth, drawHeight, devicePixelRatio, backgroundColor);
      break;
    case CustomGlyphDefinitionType.VECTOR_SHAPE:
      drawVectorShape(ctx, part.data, drawXOffset, drawYOffset, drawWidth, drawHeight, fontSize, devicePixelRatio);
      break;
    case CustomGlyphDefinitionType.BRAILLE:
      drawBrailleCharacter(ctx, part.data, drawXOffset, drawYOffset, drawWidth, drawHeight);
      break;
  }

  if (part.clipPath) {
    ctx.restore();
  }
}

function drawBlockVectorChar(
  ctx: CanvasRenderingContext2D,
  charDefinition: ICustomGlyphSolidOctantBlockVector[],
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number
): void {
  for (let i = 0; i < charDefinition.length; i++) {
    const box = charDefinition[i];
    const xEighth = deviceCellWidth / 8;
    const yEighth = deviceCellHeight / 8;
    ctx.fillRect(
      xOffset + box.x * xEighth,
      yOffset + box.y * yEighth,
      box.w * xEighth,
      box.h * yEighth
    );
  }
}

/**
 * Braille dot positions in octant coordinates (x, y for center of each dot area)
 * Columns: left=1-2, right=5-6 (leaving 0 and 7 as margins, 3-4 as gap)
 * Rows: 0-1, 2-3, 4-5, 6-7 for the 4 rows
 */
const brailleDotPositions = new Uint8Array([
  1, 0, // dot 1 - bit 0
  1, 2, // dot 2 - bit 1
  1, 4, // dot 3 - bit 2
  5, 0, // dot 4 - bit 3
  5, 2, // dot 5 - bit 4
  5, 4, // dot 6 - bit 5
  1, 6, // dot 7 - bit 6
  5, 6, // dot 8 - bit 7
]);

/**
 * Draws a braille pattern
 */
function drawBrailleCharacter(
  ctx: CanvasRenderingContext2D,
  pattern: number,
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number
): void {
  const xEighth = deviceCellWidth / 8;
  const paddingY = deviceCellHeight * 0.1;
  const usableHeight = deviceCellHeight * 0.8;
  const yEighth = usableHeight / 8;
  const radius = Math.min(xEighth, yEighth);

  for (let bit = 0; bit < 8; bit++) {
    if (pattern & (1 << bit)) {
      const x = brailleDotPositions[bit * 2];
      const y = brailleDotPositions[bit * 2 + 1];
      const cx = xOffset + (x + 1) * xEighth;
      const cy = yOffset + paddingY + (y + 1) * yEighth;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPathDefinitionCharacter(
  ctx: CanvasRenderingContext2D,
  charDefinition: CustomGlyphPathDrawFunctionDefinition | string,
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number,
  devicePixelRatio: number,
  strokeWidth?: number
): void {
  const instructions = typeof charDefinition === 'string' ? charDefinition : charDefinition(0, 0);
  ctx.beginPath();
  let currentX = 0;
  let currentY = 0;
  let lastControlX = 0;
  let lastControlY = 0;
  let lastCommand = '';
  for (const instruction of instructions.split(' ')) {
    const type = instruction[0];
    const args: string[] = instruction.substring(1).split(',');
    if (type === 'Z') {
      ctx.closePath();
      lastCommand = type;
      continue;
    }
    if (type === 'V') {
      const y = yOffset + parseFloat(args[0]) * deviceCellHeight;
      ctx.lineTo(currentX, y);
      currentY = y;
      lastControlX = currentX;
      lastControlY = currentY;
      lastCommand = type;
      continue;
    }
    if (type === 'H') {
      const x = xOffset + parseFloat(args[0]) * deviceCellWidth;
      ctx.lineTo(x, currentY);
      currentX = x;
      lastControlX = currentX;
      lastControlY = currentY;
      lastCommand = type;
      continue;
    }
    if (!args[0] || !args[1]) {
      continue;
    }
    if (type === 'A') {
      // SVG arc: A rx,ry,xAxisRotation,largeArcFlag,sweepFlag,x,y
      const rx = parseFloat(args[0]) * deviceCellWidth;
      const ry = parseFloat(args[1]) * deviceCellHeight;
      const xAxisRotation = parseFloat(args[2]) * Math.PI / 180;
      const largeArcFlag = parseInt(args[3]);
      const sweepFlag = parseInt(args[4]);
      const x = xOffset + parseFloat(args[5]) * deviceCellWidth;
      const y = yOffset + parseFloat(args[6]) * deviceCellHeight;
      drawSvgArc(ctx, currentX, currentY, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y);
      currentX = x;
      currentY = y;
      continue;
    }
    const translatedArgs = args.map((e, i) => {
      const val = parseFloat(e);
      return i % 2 === 0
        ? xOffset + val * deviceCellWidth
        : yOffset + val * deviceCellHeight;
    });
    if (type === 'M') {
      ctx.moveTo(translatedArgs[0], translatedArgs[1]);
      currentX = translatedArgs[0];
      currentY = translatedArgs[1];
      lastControlX = currentX;
      lastControlY = currentY;
    } else if (type === 'L') {
      ctx.lineTo(translatedArgs[0], translatedArgs[1]);
      currentX = translatedArgs[0];
      currentY = translatedArgs[1];
      lastControlX = currentX;
      lastControlY = currentY;
    } else if (type === 'Q') {
      ctx.quadraticCurveTo(translatedArgs[0], translatedArgs[1], translatedArgs[2], translatedArgs[3]);
      lastControlX = translatedArgs[0];
      lastControlY = translatedArgs[1];
      currentX = translatedArgs[2];
      currentY = translatedArgs[3];
    } else if (type === 'T') {
      // T uses reflection of last control point if previous command was Q or T
      let cpX: number;
      let cpY: number;
      if (lastCommand === 'Q' || lastCommand === 'T') {
        cpX = 2 * currentX - lastControlX;
        cpY = 2 * currentY - lastControlY;
      } else {
        cpX = currentX;
        cpY = currentY;
      }
      ctx.quadraticCurveTo(cpX, cpY, translatedArgs[0], translatedArgs[1]);
      lastControlX = cpX;
      lastControlY = cpY;
      currentX = translatedArgs[0];
      currentY = translatedArgs[1];
    } else if (type === 'C') {
      ctx.bezierCurveTo(translatedArgs[0], translatedArgs[1], translatedArgs[2], translatedArgs[3], translatedArgs[4], translatedArgs[5]);
      lastControlX = translatedArgs[2];
      lastControlY = translatedArgs[3];
      currentX = translatedArgs[4];
      currentY = translatedArgs[5];
    }
    lastCommand = type;
  }
  if (strokeWidth !== undefined) {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = devicePixelRatio * strokeWidth;
    ctx.stroke();
  } else {
    ctx.fill();
  }
}

/**
 * Converts SVG arc parameters to canvas arc/ellipse calls.
 * Based on the SVG spec's endpoint to center parameterization conversion.
 */
function drawSvgArc(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  rx: number, ry: number,
  phi: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number, y2: number
): void {
  // Handle degenerate cases
  if (rx === 0 || ry === 0) {
    ctx.lineTo(x2, y2);
    return;
  }

  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute (x1', y1')
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Step 2: Compute (cx', cy')
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  // Correct radii if necessary
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const lambdaSqrt = Math.sqrt(lambda);
    rx *= lambdaSqrt;
    ry *= lambdaSqrt;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  let sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq);
  if (sq < 0) sq = 0;
  const coef = (largeArcFlag === sweepFlag ? -1 : 1) * Math.sqrt(sq);
  const cxp = coef * (rx * y1p / ry);
  const cyp = coef * -(ry * x1p / rx);

  // Step 3: Compute (cx, cy) from (cx', cy')
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Step 4: Compute angles
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;

  const startAngle = Math.atan2(uy, ux);
  let dTheta = Math.atan2(vy, vx) - startAngle;

  if (sweepFlag === 0 && dTheta > 0) {
    dTheta -= 2 * Math.PI;
  } else if (sweepFlag === 1 && dTheta < 0) {
    dTheta += 2 * Math.PI;
  }

  const endAngle = startAngle + dTheta;

  ctx.ellipse(cx, cy, rx, ry, phi, startAngle, endAngle, sweepFlag === 0);
}

/**
 * Draws a "negative" path where the background color is used to draw the shape on top of a
 * foreground-filled cell. This creates the appearance of a cutout without using actual
 * transparency, which allows SPAA (subpixel anti-aliasing) to work correctly.
 *
 * @param ctx The canvas rendering context (fillStyle should be set to foreground color)
 * @param charDefinition The vector shape definition for the negative shape
 * @param xOffset The x offset to draw at
 * @param yOffset The y offset to draw at
 * @param deviceCellWidth The width of the cell in device pixels
 * @param deviceCellHeight The height of the cell in device pixels
 * @param devicePixelRatio The device pixel ratio
 * @param backgroundColor The background color to use for the "cutout" portion
 */
function drawPathNegativeDefinitionCharacter(
  ctx: CanvasRenderingContext2D,
  charDefinition: ICustomGlyphVectorShape,
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number,
  devicePixelRatio: number,
  backgroundColor?: string
): void {
  ctx.save();

  // First, fill the entire cell with foreground color
  ctx.fillRect(xOffset, yOffset, deviceCellWidth, deviceCellHeight);

  // Then draw the "negative" shape with the background color
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.strokeStyle = backgroundColor;
  }

  ctx.lineWidth = devicePixelRatio;
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (const instruction of charDefinition.d.split(' ')) {
    const type = instruction[0];
    const args: string[] = instruction.substring(1).split(',');
    if (!args[0] || !args[1]) {
      if (type === 'Z') {
        ctx.closePath();
      }
      continue;
    }
    const translatedArgs = args.map((e, i) => {
      const val = parseFloat(e);
      return i % 2 === 0
        ? xOffset + val * deviceCellWidth
        : yOffset + val * deviceCellHeight;
    });
    if (type === 'M') {
      ctx.moveTo(translatedArgs[0], translatedArgs[1]);
    } else if (type === 'L') {
      ctx.lineTo(translatedArgs[0], translatedArgs[1]);
    }
  }

  if (charDefinition.type === CustomGlyphVectorType.STROKE) {
    ctx.stroke();
  } else {
    ctx.fill();
  }

  ctx.restore();
}

const cachedPatterns: Map<CustomGlyphPatternDefinition, Map</* fillStyle */string, CanvasPattern>> = new Map();

function drawPatternChar(
  ctx: CanvasRenderingContext2D,
  charDefinition: number[][],
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number
): void {
  let patternSet = cachedPatterns.get(charDefinition);
  if (!patternSet) {
    patternSet = new Map();
    cachedPatterns.set(charDefinition, patternSet);
  }
  const fillStyle = ctx.fillStyle;
  if (typeof fillStyle !== 'string') {
    throw new Error(`Unexpected fillStyle type "${fillStyle}"`);
  }
  let pattern = patternSet.get(fillStyle);
  if (!pattern) {
    const width = charDefinition[0].length;
    const height = charDefinition.length;
    const tmpCanvas = ctx.canvas.ownerDocument.createElement('canvas');
    tmpCanvas.width = width;
    tmpCanvas.height = height;
    const tmpCtx = throwIfFalsy(tmpCanvas.getContext('2d'));
    const imageData = new ImageData(width, height);

    // Extract rgba from fillStyle
    let r: number;
    let g: number;
    let b: number;
    let a: number;
    if (fillStyle.startsWith('#')) {
      r = parseInt(fillStyle.slice(1, 3), 16);
      g = parseInt(fillStyle.slice(3, 5), 16);
      b = parseInt(fillStyle.slice(5, 7), 16);
      a = fillStyle.length > 7 && parseInt(fillStyle.slice(7, 9), 16) || 1;
    } else if (fillStyle.startsWith('rgba')) {
      ([r, g, b, a] = fillStyle.substring(5, fillStyle.length - 1).split(',').map(e => parseFloat(e)));
    } else {
      throw new Error(`Unexpected fillStyle color format "${fillStyle}" when drawing pattern glyph`);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        imageData.data[(y * width + x) * 4    ] = r;
        imageData.data[(y * width + x) * 4 + 1] = g;
        imageData.data[(y * width + x) * 4 + 2] = b;
        imageData.data[(y * width + x) * 4 + 3] = charDefinition[y][x] * (a * 255);
      }
    }
    tmpCtx.putImageData(imageData, 0, 0);
    pattern = throwIfFalsy(ctx.createPattern(tmpCanvas, null));
    patternSet.set(fillStyle, pattern);
  }
  ctx.fillStyle = pattern;
  ctx.fillRect(xOffset, yOffset, deviceCellWidth, deviceCellHeight);
}

function drawPathFunctionCharacter(
  ctx: CanvasRenderingContext2D,
  charDefinition: string | ((xp: number, yp: number) => string),
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number,
  devicePixelRatio: number,
  strokeWidth?: number
): void {
  ctx.beginPath();
  let actualInstructions: string;
  if (typeof charDefinition === 'function') {
    const xp = .15;
    const yp = .15 / deviceCellHeight * deviceCellWidth;
    actualInstructions = charDefinition(xp, yp);
  } else {
    actualInstructions = charDefinition;
  }
  const state: ISvgPathState = { currentX: 0, currentY: 0, lastControlX: 0, lastControlY: 0, lastCommand: '' };
  for (const instruction of actualInstructions.split(' ')) {
    const type = instruction[0];
    if (type === 'Z') {
      ctx.closePath();
      state.lastCommand = type;
      continue;
    }
    const f = svgToCanvasInstructionMap[type];
    if (!f) {
      console.error(`Could not find drawing instructions for "${type}"`);
      continue;
    }
    const args: string[] = instruction.substring(1).split(',');
    if (!args[0] || !args[1]) {
      continue;
    }
    f(ctx, translateArgs(args, deviceCellWidth, deviceCellHeight, xOffset, yOffset, true, devicePixelRatio), state);
    state.lastCommand = type;
  }
  if (strokeWidth !== undefined) {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = devicePixelRatio * strokeWidth;
    ctx.stroke();
  } else {
    ctx.fill();
  }
  ctx.closePath();
}

/**
 * Applies a clip path to the canvas context from SVG-like path instructions.
 */
function applyClipPath(
  ctx: CanvasRenderingContext2D,
  clipPath: string,
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number
): void {
  ctx.beginPath();
  for (const instruction of clipPath.split(' ')) {
    const type = instruction[0];
    if (type === 'Z') {
      ctx.closePath();
      continue;
    }
    const args: string[] = instruction.substring(1).split(',');
    if (!args[0] || !args[1]) {
      continue;
    }
    const x = xOffset + parseFloat(args[0]) * deviceCellWidth;
    const y = yOffset + parseFloat(args[1]) * deviceCellHeight;
    if (type === 'M') {
      ctx.moveTo(x, y);
    } else if (type === 'L') {
      ctx.lineTo(x, y);
    }
  }
  ctx.clip();
}

function drawVectorShape(
  ctx: CanvasRenderingContext2D,
  charDefinition: ICustomGlyphVectorShape,
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number,
  fontSize: number,
  devicePixelRatio: number
): void {
  // Clip the cell to make sure drawing doesn't occur beyond bounds
  const clipRegion = new Path2D();
  clipRegion.rect(xOffset, yOffset, deviceCellWidth, deviceCellHeight);
  ctx.clip(clipRegion);

  ctx.beginPath();
  // Scale the stroke with DPR and font size
  const cssLineWidth = fontSize / 12;
  ctx.lineWidth = devicePixelRatio * cssLineWidth;
  const state: ISvgPathState = { currentX: 0, currentY: 0, lastControlX: 0, lastControlY: 0, lastCommand: '' };
  for (const instruction of charDefinition.d.split(' ')) {
    const type = instruction[0];
    if (type === 'Z') {
      ctx.closePath();
      state.lastCommand = type;
      continue;
    }
    const f = svgToCanvasInstructionMap[type];
    if (!f) {
      console.error(`Could not find drawing instructions for "${type}"`);
      continue;
    }
    const args: string[] = instruction.substring(1).split(',');
    if (!args[0] || !args[1]) {
      continue;
    }
    f(ctx, translateArgs(
      args,
      deviceCellWidth,
      deviceCellHeight,
      xOffset,
      yOffset,
      false,
      devicePixelRatio,
      (charDefinition.leftPadding ?? 0) * (cssLineWidth / 2),
      (charDefinition.rightPadding ?? 0) * (cssLineWidth / 2)
    ), state);
    state.lastCommand = type;
  }
  if (charDefinition.type === CustomGlyphVectorType.STROKE) {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke();
  } else {
    ctx.fill();
  }
  ctx.closePath();
}

function clamp(value: number, max: number, min: number = 0): number {
  return Math.max(Math.min(value, max), min);
}

interface ISvgPathState {
  currentX: number;
  currentY: number;
  lastControlX: number;
  lastControlY: number;
  lastCommand: string;
}

const svgToCanvasInstructionMap: { [index: string]: (ctx: CanvasRenderingContext2D, args: number[], state: ISvgPathState) => void } = {
  'C': (ctx, args, state) => {
    ctx.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
    state.lastControlX = args[2];
    state.lastControlY = args[3];
    state.currentX = args[4];
    state.currentY = args[5];
  },
  'L': (ctx, args, state) => {
    ctx.lineTo(args[0], args[1]);
    state.lastControlX = state.currentX = args[0];
    state.lastControlY = state.currentY = args[1];
  },
  'M': (ctx, args, state) => {
    ctx.moveTo(args[0], args[1]);
    state.lastControlX = state.currentX = args[0];
    state.lastControlY = state.currentY = args[1];
  },
  'Q': (ctx, args, state) => {
    ctx.quadraticCurveTo(args[0], args[1], args[2], args[3]);
    state.lastControlX = args[0];
    state.lastControlY = args[1];
    state.currentX = args[2];
    state.currentY = args[3];
  },
  'T': (ctx, args, state) => {
    let cpX: number;
    let cpY: number;
    if (state.lastCommand === 'Q' || state.lastCommand === 'T') {
      cpX = 2 * state.currentX - state.lastControlX;
      cpY = 2 * state.currentY - state.lastControlY;
    } else {
      cpX = state.currentX;
      cpY = state.currentY;
    }
    ctx.quadraticCurveTo(cpX, cpY, args[0], args[1]);
    state.lastControlX = cpX;
    state.lastControlY = cpY;
    state.currentX = args[0];
    state.currentY = args[1];
  }
};

function translateArgs(args: string[], cellWidth: number, cellHeight: number, xOffset: number, yOffset: number, doClamp: boolean, devicePixelRatio: number, leftPadding: number = 0, rightPadding: number = 0): number[] {
  const result = args.map(e => parseFloat(e) || parseInt(e));

  if (result.length < 2) {
    throw new Error('Too few arguments for instruction');
  }

  for (let x = 0; x < result.length; x += 2) {
    // Translate from 0-1 to 0-cellWidth
    result[x] *= cellWidth - (leftPadding * devicePixelRatio) - (rightPadding * devicePixelRatio);
    // Ensure coordinate doesn't escape cell bounds and round to the nearest 0.5 to ensure a crisp
    // line at 100% devicePixelRatio
    if (doClamp && result[x] !== 0) {
      result[x] = clamp(Math.round(result[x] + 0.5) - 0.5, cellWidth, 0);
    }
    // Apply the cell's offset (ie. x*cellWidth)
    result[x] += xOffset + (leftPadding * devicePixelRatio);
  }

  for (let y = 1; y < result.length; y += 2) {
    // Translate from 0-1 to 0-cellHeight
    result[y] *= cellHeight;
    // Ensure coordinate doesn't escape cell bounds and round to the nearest 0.5 to ensure a crisp
    // line at 100% devicePixelRatio
    if (doClamp && result[y] !== 0) {
      result[y] = clamp(Math.round(result[y] + 0.5) - 0.5, cellHeight, 0);
    }
    // Apply the cell's offset (ie. x*cellHeight)
    result[y] += yOffset;
  }

  return result;
}
