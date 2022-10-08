import { ISelectionRenderModel } from 'browser/renderer/shared/Types';
import { ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { IColorSet, ReadonlyColorSet } from 'browser/Types';
import { Attributes, BgFlags, FgFlags } from 'common/buffer/Constants';
import { IDecorationService } from 'common/services/Services';
import { ICellData } from 'common/Types';
import { Terminal } from 'xterm';

// Work variables to avoid garbage collection
let $fg = 0;
let $bg = 0;
let $hasFg = false;
let $hasBg = false;
let $isSelected = false;
let $colors: ReadonlyColorSet | undefined;

export class CellColorResolver {
  /**
   * The shared result of the {@link resolve} call. This is only safe to use immediately after as
   * any other calls will share object.
   */
  public readonly result: { fg: number, bg: number, ext: number } = {
    fg: 0,
    bg: 0,
    ext: 0
  };

  constructor(
    private readonly _terminal: Terminal,
    private readonly _selectionRenderModel: ISelectionRenderModel,
    private readonly _decorationService: IDecorationService,
    private readonly _coreBrowserService: ICoreBrowserService,
    private readonly _themeService: IThemeService
  ) {
  }

  /**
   * Resolves colors for the cell, putting the result into the shared {@link result}. This resolves
   * overrides, inverse and selection for the cell which can then be used to feed into the renderer.
   */
  public resolve(cell: ICellData, x: number, y: number): void {
    this.result.bg = cell.bg;
    this.result.fg = cell.fg;
    this.result.ext = cell.bg & BgFlags.HAS_EXTENDED ? cell.extended.ext : 0;
    // Get any foreground/background overrides, this happens on the model to avoid spreading
    // override logic throughout the different sub-renderers

    // Reset overrides work variables
    $bg = 0;
    $fg = 0;
    $hasBg = false;
    $hasFg = false;
    $isSelected = false;
    $colors = this._themeService.colors;

    // Apply decorations on the bottom layer
    this._decorationService.forEachDecorationAtCell(x, y, 'bottom', d => {
      if (d.backgroundColorRGB) {
        $bg = d.backgroundColorRGB.rgba >> 8 & 0xFFFFFF;
        $hasBg = true;
      }
      if (d.foregroundColorRGB) {
        $fg = d.foregroundColorRGB.rgba >> 8 & 0xFFFFFF;
        $hasFg = true;
      }
    });

    // Apply the selection color if needed
    $isSelected = this._selectionRenderModel.isCellSelected(this._terminal, x, y);
    if ($isSelected) {
      $bg = (this._coreBrowserService.isFocused ? $colors.selectionBackgroundOpaque : $colors.selectionInactiveBackgroundOpaque).rgba >> 8 & 0xFFFFFF;
      $hasBg = true;
      if ($colors.selectionForeground) {
        $fg = $colors.selectionForeground.rgba >> 8 & 0xFFFFFF;
        $hasFg = true;
      }
    }

    // Apply decorations on the top layer
    this._decorationService.forEachDecorationAtCell(x, y, 'top', d => {
      if (d.backgroundColorRGB) {
        $bg = d.backgroundColorRGB.rgba >> 8 & 0xFFFFFF;
        $hasBg = true;
      }
      if (d.foregroundColorRGB) {
        $fg = d.foregroundColorRGB.rgba >> 8 & 0xFFFFFF;
        $hasFg = true;
      }
    });

    // Convert any overrides from rgba to the fg/bg packed format. This resolves the inverse flag
    // ahead of time in order to use the correct cache key
    if ($hasBg) {
      if ($isSelected) {
        // Non-RGB attributes from model + force non-dim + override + force RGB color mode
        $bg = (cell.bg & ~Attributes.RGB_MASK & ~BgFlags.DIM) | $bg | Attributes.CM_RGB;
      } else {
        // Non-RGB attributes from model + override + force RGB color mode
        $bg = (cell.bg & ~Attributes.RGB_MASK) | $bg | Attributes.CM_RGB;
      }
    }
    if ($hasFg) {
      // Non-RGB attributes from model + force disable inverse + override + force RGB color mode
      $fg = (cell.fg & ~Attributes.RGB_MASK & ~FgFlags.INVERSE) | $fg | Attributes.CM_RGB;
    }

    // Handle case where inverse was specified by only one of bg override or fg override was set,
    // resolving the other inverse color and setting the inverse flag if needed.
    if (this.result.fg & FgFlags.INVERSE) {
      if ($hasBg && !$hasFg) {
        // Resolve bg color type (default color has a different meaning in fg vs bg)
        if ((this.result.bg & Attributes.CM_MASK) === Attributes.CM_DEFAULT) {
          $fg = (this.result.fg & ~(Attributes.RGB_MASK | FgFlags.INVERSE | Attributes.CM_MASK)) | (($colors.background.rgba >> 8 & 0xFFFFFF) & Attributes.RGB_MASK) | Attributes.CM_RGB;
        } else {
          $fg = (this.result.fg & ~(Attributes.RGB_MASK | FgFlags.INVERSE | Attributes.CM_MASK)) | this.result.bg & (Attributes.RGB_MASK | Attributes.CM_MASK);
        }
        $hasFg = true;
      }
      if (!$hasBg && $hasFg) {
        // Resolve bg color type (default color has a different meaning in fg vs bg)
        if ((this.result.fg & Attributes.CM_MASK) === Attributes.CM_DEFAULT) {
          $bg = (this.result.bg & ~(Attributes.RGB_MASK | Attributes.CM_MASK)) | (($colors.foreground.rgba >> 8 & 0xFFFFFF) & Attributes.RGB_MASK) | Attributes.CM_RGB;
        } else {
          $bg = (this.result.bg & ~(Attributes.RGB_MASK | Attributes.CM_MASK)) | this.result.fg & (Attributes.RGB_MASK | Attributes.CM_MASK);
        }
        $hasBg = true;
      }
    }

    // Release object
    $colors = undefined;

    // Use the override if it exists
    this.result.bg = $hasBg ? $bg : this.result.bg;
    this.result.fg = $hasFg ? $fg : this.result.fg;
  }
}
