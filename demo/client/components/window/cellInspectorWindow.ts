/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BaseWindow } from './baseWindow';
import type { IControlWindow } from '../controlBar';
import type { Terminal, IBufferCell } from '@xterm/xterm';
import type { AddonCollection } from '../../types';

// Underline style values from common/buffer/Constants.ts
const enum UnderlineStyle {
  NONE = 0,
  SINGLE = 1,
  DOUBLE = 2,
  CURLY = 3,
  DOTTED = 4,
  DASHED = 5
}

// Internal interface for accessing extended attribute data
interface IAttributeDataInternal {
  getUnderlineStyle(): number;
  getUnderlineColor(): number;
  isUnderlineColorDefault(): boolean;
  isUnderlineColorPalette(): boolean;
  isUnderlineColorRGB(): boolean;
}

export class CellInspectorWindow extends BaseWindow implements IControlWindow {
  public readonly id = 'cell-inspector';
  public readonly label = 'Cell Inspector';

  private _container: HTMLElement;
  private _positionEl: HTMLElement;
  private _charEl: HTMLElement;
  private _codeEl: HTMLElement;
  private _widthEl: HTMLElement;
  private _fgEl: HTMLElement;
  private _bgEl: HTMLElement;
  private _attrsEl: HTMLElement;

  constructor(
    terminal: Terminal,
    addons: AddonCollection,
  ) {
    super(terminal, addons);
  }

  public build(container: HTMLElement): void {
    this._container = container;

    const dl = document.createElement('dl');
    dl.style.fontFamily = 'monospace';
    dl.style.fontSize = '12px';

    this._positionEl = this._addRow(dl, 'Position');
    this._charEl = this._addRow(dl, 'Character');
    this._codeEl = this._addRow(dl, 'Codepoint');
    this._widthEl = this._addRow(dl, 'Width');
    this._fgEl = this._addRow(dl, 'Foreground');
    this._bgEl = this._addRow(dl, 'Background');
    this._attrsEl = this._addRow(dl, 'Attributes');

    container.appendChild(dl);

    // Add mouse move listener
    this._setupMouseListener();
  }

  private _addRow(dl: HTMLElement, label: string): HTMLElement {
    const dt = document.createElement('dt');
    dt.textContent = label;
    dt.style.fontWeight = 'bold';
    dt.style.marginTop = '4px';
    dl.appendChild(dt);

    const dd = document.createElement('dd');
    dd.textContent = '-';
    dd.style.margin = '0 0 0 16px';
    dl.appendChild(dd);

    return dd;
  }

  private _setupMouseListener(): void {
    const terminal = this._terminal;
    if (!terminal.element) {
      return;
    }

    const cell = terminal.buffer.active.getNullCell();

    terminal.element.addEventListener('mousemove', (e: MouseEvent) => {
      const core = (terminal as any)._core;
      const coords = core._mouseService?.getCoords(e, core.screenElement, terminal.cols, terminal.rows);
      if (!coords) {
        this._clearDisplay();
        return;
      }

      const x = coords[0] - 1;
      const y = coords[1] - 1;
      const bufferY = terminal.buffer.active.viewportY + y;

      const line = terminal.buffer.active.getLine(bufferY);
      if (!line) {
        this._clearDisplay();
        return;
      }

      const cellData = line.getCell(x, cell);
      if (!cellData) {
        this._clearDisplay();
        return;
      }

      this._updateDisplay(x, y, bufferY, cellData);
    });

    terminal.element.addEventListener('mouseleave', () => {
      this._clearDisplay();
    });
  }

  private _clearDisplay(): void {
    this._positionEl.textContent = '-';
    this._charEl.textContent = '-';
    this._codeEl.textContent = '-';
    this._widthEl.textContent = '-';
    this._fgEl.textContent = '-';
    this._bgEl.textContent = '-';
    this._attrsEl.textContent = '-';
  }

  private _updateDisplay(x: number, y: number, bufferY: number, cell: IBufferCell): void {
    // Position
    this._positionEl.textContent = `x=${x}, y=${y} (buffer: ${bufferY})`;

    // Character
    const chars = cell.getChars();
    this._charEl.textContent = chars.length > 0 ? `"${chars}"` : '(empty)';

    // Codepoint(s)
    if (chars.length > 0) {
      const codepoints = [...chars].map(c => {
        const cp = c.codePointAt(0)!;
        return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
      });
      this._codeEl.textContent = codepoints.join(' ');
    } else {
      this._codeEl.textContent = '(none)';
    }

    // Width
    this._widthEl.textContent = cell.getWidth().toString();

    // Foreground color
    this._fgEl.textContent = this._formatFgColor(
      cell.getFgColor(),
      cell.isFgDefault(),
      cell.isFgPalette(),
      cell.isFgRGB()
    );

    // Background color
    this._bgEl.textContent = this._formatBgColor(
      cell.getBgColor(),
      cell.isBgDefault(),
      cell.isBgPalette(),
      cell.isBgRGB()
    );

    // Attributes (SGR codes)
    const attrs: string[] = [];
    if (cell.isBold()) attrs.push('bold (1)');
    if (cell.isDim()) attrs.push('dim (2)');
    if (cell.isItalic()) attrs.push('italic (3)');
    if (cell.isUnderline()) {
      const cellData = cell as unknown as IAttributeDataInternal;
      const style = cellData.getUnderlineStyle();
      const styleName = this._getUnderlineStyleName(style);
      attrs.push(`underline ${styleName} (4:${style})`);

      // Show underline color if not default
      if (!cellData.isUnderlineColorDefault()) {
        const color = cellData.getUnderlineColor();
        const colorStr = this._formatUnderlineColor(
          color,
          cellData.isUnderlineColorPalette(),
          cellData.isUnderlineColorRGB()
        );
        attrs.push(`underline color: ${colorStr}`);
      }
    }
    if (cell.isBlink()) attrs.push('blink (5)');
    if (cell.isInverse()) attrs.push('inverse (7)');
    if (cell.isInvisible()) attrs.push('invisible (8)');
    if (cell.isStrikethrough()) attrs.push('strikethrough (9)');
    if (cell.isOverline()) attrs.push('overline (53)');
    this._attrsEl.textContent = attrs.length > 0 ? attrs.join(', ') : '(none)';
  }

  private _formatFgColor(color: number, isDefault: boolean, isPalette: boolean, isRGB: boolean): string {
    if (isDefault) {
      return 'default (39)';
    }
    if (isPalette) {
      // SGR 30-37 for colors 0-7, 90-97 for colors 8-15, or 38;5;n for 0-255
      let sgr: string;
      if (color < 8) {
        sgr = `${30 + color}`;
      } else if (color < 16) {
        sgr = `${90 + color - 8}`;
      } else {
        sgr = `38;5;${color}`;
      }
      return `palette(${color}) (${sgr})`;
    }
    if (isRGB) {
      const r = (color >> 16) & 0xFF;
      const g = (color >> 8) & 0xFF;
      const b = color & 0xFF;
      return `#${color.toString(16).toUpperCase().padStart(6, '0')} (38;2;${r};${g};${b})`;
    }
    return `unknown(${color})`;
  }

  private _formatBgColor(color: number, isDefault: boolean, isPalette: boolean, isRGB: boolean): string {
    if (isDefault) {
      return 'default (49)';
    }
    if (isPalette) {
      // SGR 40-47 for colors 0-7, 100-107 for colors 8-15, or 48;5;n for 0-255
      let sgr: string;
      if (color < 8) {
        sgr = `${40 + color}`;
      } else if (color < 16) {
        sgr = `${100 + color - 8}`;
      } else {
        sgr = `48;5;${color}`;
      }
      return `palette(${color}) (${sgr})`;
    }
    if (isRGB) {
      const r = (color >> 16) & 0xFF;
      const g = (color >> 8) & 0xFF;
      const b = color & 0xFF;
      return `#${color.toString(16).toUpperCase().padStart(6, '0')} (48;2;${r};${g};${b})`;
    }
    return `unknown(${color})`;
  }

  private _getUnderlineStyleName(style: UnderlineStyle): string {
    switch (style) {
      case UnderlineStyle.NONE: return 'none';
      case UnderlineStyle.SINGLE: return 'single';
      case UnderlineStyle.DOUBLE: return 'double';
      case UnderlineStyle.CURLY: return 'curly';
      case UnderlineStyle.DOTTED: return 'dotted';
      case UnderlineStyle.DASHED: return 'dashed';
      default: return 'unknown';
    }
  }

  private _formatUnderlineColor(color: number, isPalette: boolean, isRGB: boolean): string {
    if (isPalette) {
      return `palette(${color}) (58;5;${color})`;
    }
    if (isRGB) {
      const r = (color >> 16) & 0xFF;
      const g = (color >> 8) & 0xFF;
      const b = color & 0xFF;
      return `#${color.toString(16).toUpperCase().padStart(6, '0')} (58;2;${r};${g};${b})`;
    }
    return `unknown(${color})`;
  }
}
