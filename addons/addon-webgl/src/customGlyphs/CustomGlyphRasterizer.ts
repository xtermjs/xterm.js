/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { throwIfFalsy } from 'browser/renderer/shared/RendererUtils';
import { customGlyphDefinitions } from './CustomGlyphDefinitions';
import { CustomGlyphDefinitionType, CustomGlyphVectorType, type CustomGlyphPathDrawFunctionDefinition, type CustomGlyphPatternDefinition, type CustomGlyphRegionDefinition, type ICustomGlyphSolidOctantBlockVector, type ICustomGlyphVectorShape } from './Types';

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
  fontSize: number,
  devicePixelRatio: number
): boolean {
  const unifiedCharDefinition = customGlyphDefinitions[c];
  if (unifiedCharDefinition) {
    switch (unifiedCharDefinition.type) {
      case CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR:
        drawBlockVectorChar(ctx, unifiedCharDefinition.data, xOffset, yOffset, deviceCellWidth, deviceCellHeight);
        return true;
      case CustomGlyphDefinitionType.BLOCK_PATTERN:
        drawPatternChar(ctx, unifiedCharDefinition.data, xOffset, yOffset, deviceCellWidth, deviceCellHeight);
        return true;
      case CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION:
        drawBlockPatternWithRegion(ctx, unifiedCharDefinition.data, xOffset, yOffset, deviceCellWidth, deviceCellHeight);
        return true;
      case CustomGlyphDefinitionType.BLOCK_PATTERN_WITH_REGION_AND_SOLID_OCTANT_BLOCK_VECTOR:
        drawBlockPatternWithRegion(ctx, unifiedCharDefinition.data.pattern, xOffset, yOffset, deviceCellWidth, deviceCellHeight);
        drawBlockVectorChar(ctx, unifiedCharDefinition.data.vectors, xOffset, yOffset, deviceCellWidth, deviceCellHeight);
        return true;
      case CustomGlyphDefinitionType.PATH_FUNCTION:
      case CustomGlyphDefinitionType.PATH:
        drawPathDefinitionCharacter(ctx, unifiedCharDefinition.data, xOffset, yOffset, deviceCellWidth, deviceCellHeight);
        return true;
      case CustomGlyphDefinitionType.VECTOR_SHAPE:
        drawVectorShape(ctx, unifiedCharDefinition.data, xOffset, yOffset, deviceCellWidth, deviceCellHeight, fontSize, devicePixelRatio);
        return true;
      case CustomGlyphDefinitionType.PATH_FUNCTION_WITH_WEIGHT:
        drawPathDefinitionCharacterWithWeight(ctx, unifiedCharDefinition.data, xOffset, yOffset, deviceCellWidth, deviceCellHeight, devicePixelRatio);
        return true;
    }
  }

  return false;
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

function drawPathDefinitionCharacter(
  ctx: CanvasRenderingContext2D,
  charDefinition: CustomGlyphPathDrawFunctionDefinition | string,
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number
): void {
  const instructions = typeof charDefinition === 'string' ? charDefinition : charDefinition(0, 0);
  ctx.beginPath();
  for (const instruction of instructions.split(' ')) {
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
  ctx.fill();
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

/**
 * Draws rectangular shade characters - medium shade pattern clipped to a region.
 * Uses a checkerboard pattern that shifts 1px each row (same as medium shade U+2592).
 */
function drawBlockPatternWithRegion(
  ctx: CanvasRenderingContext2D,
  definition: [pattern: CustomGlyphPatternDefinition, region: CustomGlyphRegionDefinition],
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number
): void {
  const [pattern, region] = definition;
  const [rx, ry, rw, rh] = region;
  const regionX = Math.round(xOffset + rx * deviceCellWidth);
  const regionY = Math.round(yOffset + ry * deviceCellHeight);
  const regionW = Math.round(rw * deviceCellWidth);
  const regionH = Math.round(rh * deviceCellHeight);

  // Save context state
  ctx.save();

  // Clip to the region
  ctx.beginPath();
  ctx.rect(regionX, regionY, regionW, regionH);
  ctx.clip();

  // Draw the pattern
  drawPatternChar(ctx, pattern, xOffset, yOffset, deviceCellWidth, deviceCellHeight);

  // Restore context state
  ctx.restore();
}

/**
 * Draws the following box drawing characters by mapping a subset of SVG d attribute instructions to
 * canvas draw calls.
 *
 * Box styles:       ┎┰┒┍┯┑╓╥╖╒╤╕ ┏┳┓┌┲┓┌┬┐┏┱┐
 * ┌─┬─┐ ┏━┳━┓ ╔═╦═╗ ┠╂┨┝┿┥╟╫╢╞╪╡ ┡╇┩├╊┫┢╈┪┣╉┤
 * │ │ │ ┃ ┃ ┃ ║ ║ ║ ┖┸┚┕┷┙╙╨╜╘╧╛ └┴┘└┺┛┗┻┛┗┹┘
 * ├─┼─┤ ┣━╋━┫ ╠═╬═╣ ┏┱┐┌┲┓┌┬┐┌┬┐ ┏┳┓┌┮┓┌┬┐┏┭┐
 * │ │ │ ┃ ┃ ┃ ║ ║ ║ ┡╃┤├╄┩├╆┪┢╅┤ ┞╀┦├┾┫┟╁┧┣┽┤
 * └─┴─┘ ┗━┻━┛ ╚═╩═╝ └┴┘└┴┘└┺┛┗┹┘ └┴┘└┶┛┗┻┛┗┵┘
 *
 * Other:
 * ╭─╮ ╲ ╱ ╷╻╎╏┆┇┊┋ ╺╾╴ ╌╌╌ ┄┄┄ ┈┈┈
 * │ │  ╳  ╽╿╎╏┆┇┊┋ ╶╼╸ ╍╍╍ ┅┅┅ ┉┉┉
 * ╰─╯ ╱ ╲ ╹╵╎╏┆┇┊┋
 *
 * All box drawing characters:
 * ─ ━ │ ┃ ┄ ┅ ┆ ┇ ┈ ┉ ┊ ┋ ┌ ┍ ┎ ┏
 * ┐ ┑ ┒ ┓ └ ┕ ┖ ┗ ┘ ┙ ┚ ┛ ├ ┝ ┞ ┟
 * ┠ ┡ ┢ ┣ ┤ ┥ ┦ ┧ ┨ ┩ ┪ ┫ ┬ ┭ ┮ ┯
 * ┰ ┱ ┲ ┳ ┴ ┵ ┶ ┷ ┸ ┹ ┺ ┻ ┼ ┽ ┾ ┿
 * ╀ ╁ ╂ ╃ ╄ ╅ ╆ ╇ ╈ ╉ ╊ ╋ ╌ ╍ ╎ ╏
 * ═ ║ ╒ ╓ ╔ ╕ ╖ ╗ ╘ ╙ ╚ ╛ ╜ ╝ ╞ ╟
 * ╠ ╡ ╢ ╣ ╤ ╥ ╦ ╧ ╨ ╩ ╪ ╫ ╬ ╭ ╮ ╯
 * ╰ ╱ ╲ ╳ ╴ ╵ ╶ ╷ ╸ ╹ ╺ ╻ ╼ ╽ ╾ ╿
 *
 * ---
 *
 * Box drawing alignment tests:                                          █
 *                                                                       ▉
 *   ╔══╦══╗  ┌──┬──┐  ╭──┬──╮  ╭──┬──╮  ┏━━┳━━┓  ┎┒┏┑   ╷  ╻ ┏┯┓ ┌┰┐    ▊ ╱╲╱╲╳╳╳
 *   ║┌─╨─┐║  │╔═╧═╗│  │╒═╪═╕│  │╓─╁─╖│  ┃┌─╂─┐┃  ┗╃╄┙  ╶┼╴╺╋╸┠┼┨ ┝╋┥    ▋ ╲╱╲╱╳╳╳
 *   ║│╲ ╱│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╿ │┃  ┍╅╆┓   ╵  ╹ ┗┷┛ └┸┘    ▌ ╱╲╱╲╳╳╳
 *   ╠╡ ╳ ╞╣  ├╢   ╟┤  ├┼─┼─┼┤  ├╫─╂─╫┤  ┣┿╾┼╼┿┫  ┕┛┖┚     ┌┄┄┐ ╎ ┏┅┅┓ ┋ ▍ ╲╱╲╱╳╳╳
 *   ║│╱ ╲│║  │║   ║│  ││ │ ││  │║ ┃ ║│  ┃│ ╽ │┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▎
 *   ║└─╥─┘║  │╚═╤═╝│  │╘═╪═╛│  │╙─╀─╜│  ┃└─╂─┘┃  ░░▒▒▓▓██ ┊  ┆ ╎ ╏  ┇ ┋ ▏
 *   ╚══╩══╝  └──┴──┘  ╰──┴──╯  ╰──┴──╯  ┗━━┻━━┛           └╌╌┘ ╎ ┗╍╍┛ ┋  ▁▂▃▄▅▆▇█
 *
 * Source: https://www.w3.org/2001/06/utf-8-test/UTF-8-demo.html
 */
function drawPathDefinitionCharacterWithWeight(
  ctx: CanvasRenderingContext2D,
  charDefinition: { [fontWeight: number]: string | ((xp: number, yp: number) => string) },
  xOffset: number,
  yOffset: number,
  deviceCellWidth: number,
  deviceCellHeight: number,
  devicePixelRatio: number
): void {
  ctx.strokeStyle = ctx.fillStyle;
  for (const [fontWeight, instructions] of Object.entries(charDefinition)) {
    ctx.beginPath();
    ctx.lineWidth = devicePixelRatio * Number.parseInt(fontWeight);
    let actualInstructions: string;
    if (typeof instructions === 'function') {
      const xp = .15;
      const yp = .15 / deviceCellHeight * deviceCellWidth;
      actualInstructions = instructions(xp, yp);
    } else {
      actualInstructions = instructions;
    }
    for (const instruction of actualInstructions.split(' ')) {
      const type = instruction[0];
      const f = svgToCanvasInstructionMap[type];
      if (!f) {
        console.error(`Could not find drawing instructions for "${type}"`);
        continue;
      }
      const args: string[] = instruction.substring(1).split(',');
      if (!args[0] || !args[1]) {
        continue;
      }
      f(ctx, translateArgs(args, deviceCellWidth, deviceCellHeight, xOffset, yOffset, true, devicePixelRatio));
    }
    ctx.stroke();
    ctx.closePath();
  }
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
  for (const instruction of charDefinition.d.split(' ')) {
    const type = instruction[0];
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
    ));
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

const svgToCanvasInstructionMap: { [index: string]: any } = {
  'C': (ctx: CanvasRenderingContext2D, args: number[]) => ctx.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]),
  'L': (ctx: CanvasRenderingContext2D, args: number[]) => ctx.lineTo(args[0], args[1]),
  'M': (ctx: CanvasRenderingContext2D, args: number[]) => ctx.moveTo(args[0], args[1])
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
