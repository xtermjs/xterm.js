import { ITerminal, ITheme } from '../Interfaces';
import { IColorSet } from '../renderer/Interfaces';

interface ICharAtlasConfig {
  fontSize: number;
  fontFamily: string;
  scaledCharWidth: number;
  scaledCharHeight: number;
  colors: IColorSet;
}

interface ICharAtlasCacheEntry {
  bitmap: Promise<ImageBitmap>;
  config: ICharAtlasConfig;
  ownedBy: ITerminal[];
}

let charAtlasCache: ICharAtlasCacheEntry[] = [];

export function acquireCharAtlas(terminal: ITerminal, colors: IColorSet): Promise<ImageBitmap> {
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
    background: colors.background,
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
      a.colors.foreground === b.colors.foreground &&
      a.colors.background === b.colors.background;
}

class CharAtlasGenerator {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;

  constructor() {
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  public generate(scaledCharWidth: number, scaledCharHeight: number, fontSize: number, fontFamily: string, foreground: string, ansiColors: string[]): Promise<ImageBitmap> {
    this._canvas.width = 255 * scaledCharWidth;
    this._canvas.height = (/*default*/1 + /*0-15*/16) * scaledCharHeight;

    this._ctx.save();
    this._ctx.fillStyle = foreground;
    this._ctx.font = `${fontSize * window.devicePixelRatio}px ${fontFamily}`;
    this._ctx.textBaseline = 'top';

    // Default color
    for (let i = 0; i < 256; i++) {
      this._ctx.fillText(String.fromCharCode(i), i * scaledCharWidth, 0);
    }

    // Colors 0-15
    for (let colorIndex = 0; colorIndex < 16; colorIndex++) {
      // colors 8-15 are bold
      if (colorIndex === 8) {
        this._ctx.font = `bold ${this._ctx.font}`;
      }
      const y = (colorIndex + 1) * scaledCharHeight;
      // Clear rectangle as some fonts seem to draw over the bottom boundary
      this._ctx.clearRect(0, y, this._canvas.width, scaledCharHeight);
      // Draw ascii characters
      for (let i = 0; i < 256; i++) {
        this._ctx.fillStyle = ansiColors[colorIndex];
        this._ctx.fillText(String.fromCharCode(i), i * scaledCharWidth, y);
      }
    }
    this._ctx.restore();

    const charAtlasImageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
    const promise = window.createImageBitmap(charAtlasImageData);
    // Clear the rect while the promise is in progress
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    return promise;
  }
}

const generator = new CharAtlasGenerator();
