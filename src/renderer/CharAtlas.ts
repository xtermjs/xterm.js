import { ITerminal, ITheme } from '../Interfaces';
import { IColorSet } from '../renderer/Interfaces';

export const CHAR_ATLAS_CELL_SPACING = 1;

interface ICharAtlasConfig {
  fontSize: number;
  fontFamily: string;
  scaledCharWidth: number;
  scaledCharHeight: number;
  colors: IColorSet;
}

interface ICharAtlasCacheEntry {
  bitmap: HTMLCanvasElement | Promise<ImageBitmap>;
  config: ICharAtlasConfig;
  ownedBy: ITerminal[];
}

let charAtlasCache: ICharAtlasCacheEntry[] = [];

export function acquireCharAtlas(terminal: ITerminal, colors: IColorSet): HTMLCanvasElement | Promise<ImageBitmap> {
  const scaledCharWidth = terminal.charMeasure.width * window.devicePixelRatio;
  const scaledCharHeight = terminal.charMeasure.height * window.devicePixelRatio;
  const newConfig = generateConfig(scaledCharWidth, scaledCharHeight, terminal, colors);

  // Check to see if the terminal already owns this config
  for (let i = 0; i < charAtlasCache.length; i++) {
    const entry = charAtlasCache[i];
    const ownedByIndex = entry.ownedBy.indexOf(terminal);
    if (ownedByIndex >= 0) {
      if (configEquals(entry.config, newConfig)) {
        return entry.bitmap;
      } else {
        // The configs differ, release the terminal from the entry
        if (entry.ownedBy.length === 1) {
          charAtlasCache.splice(i, 1);
        } else {
          entry.ownedBy.splice(ownedByIndex, 1);
        }
        break;
      }
    }
  }

  // Try match a char atlas from the cache
  for (let i = 0; i < charAtlasCache.length; i++) {
    const entry = charAtlasCache[i];
    if (configEquals(entry.config, newConfig)) {
      // Add the terminal to the cache entry and return
      entry.ownedBy.push(terminal);
      return entry.bitmap;
    }
  }

  const newEntry: ICharAtlasCacheEntry = {
    bitmap: generator.generate(scaledCharWidth, scaledCharHeight, terminal.options.fontSize, terminal.options.fontFamily, colors.foreground, colors.ansi),
    config: newConfig,
    ownedBy: [terminal]
  };
  charAtlasCache.push(newEntry);
  return newEntry.bitmap;
}

function generateConfig(scaledCharWidth: number, scaledCharHeight: number, terminal: ITerminal, colors: IColorSet): ICharAtlasConfig {
  const clonedColors = {
    foreground: colors.foreground,
    background: null,
    cursor: null,
    ansi: colors.ansi.slice(0, 16)
  };
  return {
    scaledCharWidth,
    scaledCharHeight,
    fontFamily: terminal.options.fontFamily,
    fontSize: terminal.options.fontSize,
    colors: clonedColors
  };
}

function configEquals(a: ICharAtlasConfig, b: ICharAtlasConfig): boolean {
  for (let i = 0; i < a.colors.ansi.length; i++) {
    if (a.colors.ansi[i] !== b.colors.ansi[i]) {
      return false;
    }
  }
  return a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.scaledCharWidth === b.scaledCharWidth &&
      a.scaledCharHeight === b.scaledCharHeight &&
      a.colors.foreground === b.colors.foreground;
}

class CharAtlasGenerator {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;

  constructor() {
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  public generate(scaledCharWidth: number, scaledCharHeight: number, fontSize: number, fontFamily: string, foreground: string, ansiColors: string[]): HTMLCanvasElement | Promise<ImageBitmap> {
    const cellWidth = scaledCharWidth + CHAR_ATLAS_CELL_SPACING;
    const cellHeight = scaledCharHeight + CHAR_ATLAS_CELL_SPACING;
    this._canvas.width = 255 * cellWidth;
    this._canvas.height = (/*default+default bold*/2 + /*0-15*/16) * cellHeight;

    this._ctx.save();
    this._ctx.fillStyle = foreground;
    this._ctx.font = `${fontSize * window.devicePixelRatio}px ${fontFamily}`;
    this._ctx.textBaseline = 'top';

    // Default color
    for (let i = 0; i < 256; i++) {
      this._ctx.fillText(String.fromCharCode(i), i * cellWidth, 0);
    }
    // Default color bold
    this._ctx.save();
    this._ctx.font = `bold ${this._ctx.font}`;
    for (let i = 0; i < 256; i++) {
      this._ctx.fillText(String.fromCharCode(i), i * cellWidth, cellHeight);
    }
    this._ctx.restore();

    // Colors 0-15
    this._ctx.font = `${fontSize * window.devicePixelRatio}px ${fontFamily}`;
    for (let colorIndex = 0; colorIndex < 16; colorIndex++) {
      // colors 8-15 are bold
      if (colorIndex === 8) {
        this._ctx.font = `bold ${this._ctx.font}`;
      }
      const y = (colorIndex + 2) * cellHeight;
      // Draw ascii characters
      for (let i = 0; i < 256; i++) {
        this._ctx.fillStyle = ansiColors[colorIndex];
        this._ctx.fillText(String.fromCharCode(i), i * cellWidth, y);
      }
    }
    this._ctx.restore();

    const charAtlasImageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);

    // Support is patchy for createImageBitmap at the moment, pass a canvas back
    // if support is lacking as drawImage works there too.
    if (!('createImageBitmap' in window)) {
      // Regenerate canvas and context as they are now owned by the char atlas
      const result = this._canvas;
      this._canvas = document.createElement('canvas');
      this._ctx = this._canvas.getContext('2d');
      this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      return result;
    }

    const promise = window.createImageBitmap(charAtlasImageData);
    // Clear the rect while the promise is in progress
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    return promise;
  }
}

const generator = new CharAtlasGenerator();
