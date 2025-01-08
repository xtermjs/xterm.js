/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This contains the type declarations for the @xterm/addon-ligatures library.
 * Note that some interfaces may differ between this file and the actual
 * implementation in src/, that's because this file declares the *public* API
 * which is intended to be stable and consumed by external programs.
 */

import { Terminal, ITerminalAddon } from '@xterm/xterm';

declare module '@xterm/addon-ligatures' {
  /**
   * An xterm.js addon that enables web links.
   */
  export class LigaturesAddon implements ITerminalAddon {
    /**
     * Creates a new ligatures addon.
     *
     * @param options Options for the ligatures addon.
     */
    constructor(options?: Partial<ILigatureOptions>);

    /**
     * Activates the addon. Note that if webgl is also being used, that addon
     * should be reactivated after ligatures is activated in order to apply
     * {@link ILigatureOptions.fontFeatureSettings} to the texture atlas.
     *
     *
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    /**
     * Disposes the addon.
     */
    public dispose(): void;
  }

  /**
   * Options for the ligatures addon.
   */
  export interface ILigatureOptions {
    /**
     * Fallback ligatures to use when the font access API is either not
     * supported by the browser or access is denied. The default set of
     * ligatures is taken from Iosevka's default "calt" ligation set:
     * https://typeof.net/Iosevka/
     *
     * ```
     * <-- <--- <<- <- -> ->> --> --->
     * <== <=== <<= <= => =>> ==> ===> >= >>=
     * <-> <--> <---> <----> <=> <==> <===> <====> :: :::
     * <~~ </ </> /> ~~> == != /= ~= <> === !== !===
     * <: := *= *+ <* <*> *> <| <|> |> +* =* =: :>
     * /* <close block comment> +++ <!-- <!---
     */
    fallbackLigatures: string[]

    /**
     * The CSS `font-feature-settings` value to use for enabling ligatures. This
     * also supports font variants for example with a value like
     * `"calt" on, "ss03"`.
     *
     * The default value is `"calt" on`.
     */
    fontFeatureSettings: string;
  }
}
