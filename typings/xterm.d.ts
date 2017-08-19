/**
 * @license MIT
 *
 * This contains the type declarations for the xterm.js library. Note that
 * some interfaces differ between this file and the actual implementation in
 * src/, that's because this file declares the *public* API which is intended
 * to be stable and consumed by external programs.
 */

/**
 * An object containing start up options for the terminal.
 */
interface ITerminalOptions {
  /**
   * The number of columns in the terminal.
   */
  cols?: number;

  /**
   * Whether the cursor blinks.
   */
  cursorBlink?: boolean;

  /**
   * The style of the cursor.
   */
  cursorStyle?: 'block' | 'underline' | 'bar';

  /**
   * Whether input should be disabled.
   */
  disableStdin?: boolean;

  /**
   * The number of rows in the terminal.
   */
  rows?: number;

  /**
   * The amount of scrollback in the terminal. Scrollback is the amount of rows
   * that are retained when lines are scrolled beyond the initial viewport.
   */
  scrollback?: number;

  /**
   * The size of tab stops in the terminal.
   */
  tabStopWidth?: number;
}


type Option = BooleanOption | StringOption | StringArrayOption | NumberOption | GeometryOption | HandlerOption;
type BooleanOption =
    'cancelEvents' |
    'convertEol' |
    'cursorBlink' |
    'debug' |
    'disableStdin' |
    'popOnBell' |
    'screenKeys' |
    'useFlowControl' |
    'visualBell';
type StringOption =
    'cursorStyle' |
    'termName';
type StringArrayOption = 'colors';
type NumberOption =
    'cols' |
    'rows' |
    'tabStopWidth' |
    'scrollback';
type GeometryOption = 'geometry';
type HandlerOption = 'handler';

declare module 'xterm' {
  /**
   * The class that represents an xterm.js terminal.
   */
  export class Terminal {
    element: HTMLElement;
    textarea: HTMLTextAreaElement;

    /**
     * Creates a new `Terminal` object.
     *
     * @param options An object containing a set of options.
     */
    constructor(options?: ITerminalOptions);

    /**
     * Unfocus the terminal.
     */
    blur(): void;

    /**
     * Focus the terminal.
     */
    focus(): void;

    /**
     * Registers an event listener.
     * @param type The type of the event.
     * @param listener The listener.
     */
    on(type: string, listener: (data: any) => void): void;

    /**
     * Deregisters an event listener.
     * @param type The type of the event.
     * @param listener The listener.
     */
    on(type: string, listener: (data: any) => void): void;

    /**
     * Resizes the terminal.
     * @param x The number of columns to resize to.
     * @param y The number of rows to resize to.
     */
    resize(columns: number, rows: number): void;

    /**
     * Writes text to the terminal, followed by a break line character (\n).
     * @param data The text to write to the terminal.
     */
    writeln(data: string): void;

    /**
     * Opens the terminal within an element.
     * @param parent The element to create the terminal within.
     */
    open(parent: HTMLElement): void;

    /**
     * Attaches a custom key event handler which is run before keys are
     * processed, giving consumers of xterm.js ultimate control as to what keys
     * should be processed by the terminal and what keys should not.
     * @param customKeyEventHandler The custom KeyboardEvent handler to attach.
     * This is a function that takes a KeyboardEvent, allowing consumers to stop
     * propogation and/or prevent the default action. The function returns
     * whether the event should be processed by xterm.js.
     */
    attachCustomKeyEventHandler(customKeyEventHandler: (event: KeyboardEvent) => boolean);

    /**
     * Retrieves an option's value from the terminal.
     * @param key The option key.
     */
    getOption(key: StringOption): string;
    getOption(key: BooleanOption): boolean;
    getOption(key: StringArrayOption): number[];
    getOption(key: NumberOption): number;
    getOption(key: GeometryOption): [number, number];
    getOption(key: HandlerOption): (data: string) => void;
    getOption(key: Option): any;

    // /**
    //  * Registers a link matcher, allowing custom link patterns to be matched and
    //  * handled.
    //  * @param {RegExp} regex The regular expression to search for, specifically
    //  * this searches the textContent of the rows. You will want to use \s to match
    //  * a space ' ' character for example.
    //  * @param {LinkMatcherHandler} handler The callback when the link is called.
    //  * @param {LinkMatcherOptions} [options] Options for the link matcher.
    //  * @return {number} The ID of the new matcher, this can be used to deregister.
    //  */
    // registerLinkMatcher(regex: RegExp, handler: LinkMatcherHandler , options?: any);

    // /**
    //  * Deregisters a link matcher if it has been registered.
    //  * @param matcherId The link matcher's ID (returned after register)
    //  */
    // deregisterLinkMatcher(matcherId: number): void;

    /**
     * Gets whether the terminal has an active selection.
     */
    hasSelection(): boolean;

    /**
     * Gets the terminal's current selection, this is useful for implementing
     * copy behavior outside of xterm.js.
     */
    getSelection(): string;

    /**
     * Clears the current terminal selection.
     */
    clearSelection(): void;

    /**
     * Selects all text within the terminal.
     */
    selectAll(): void;

    // /**
    //  * Find the next instance of the term, then scroll to and select it. If it
    //  * doesn't exist, do nothing.
    //  * @param term Tne search term.
    //  * @return Whether a result was found.
    //  */
    // findNext(term: string): boolean;

    // /**
    //  * Find the previous instance of the term, then scroll to and select it. If it
    //  * doesn't exist, do nothing.
    //  * @param term Tne search term.
    //  * @return Whether a result was found.
    //  */
    // findPrevious(term: string): boolean;

    /**
     * Destroys the terminal and detaches it from the DOM.
     */
    destroy(): void;

    /**
     * Scroll the display of the terminal
     * @param amount The number of lines to scroll down (negative scroll up).
     */
    scrollDisp(amount: number): void;

    /**
     * Scroll the display of the terminal by a number of pages.
     * @param pageCount The number of pages to scroll (negative scrolls up).
     */
    scrollPages(pageCount: number): void;

    /**
     * Scrolls the display of the terminal to the top.
     */
    scrollToTop(): void;

    /**
     * Scrolls the display of the terminal to the bottom.
     */
    scrollToBottom(): void;

    /**
     * Clear the entire buffer, making the prompt line the new first line.
     */
    clear(): void;

    /**
     * Writes text to the terminal.
     * @param data The text to write to the terminal.
     */
    write(data: string): void;

    /**
     * Sets an option on the terminal.
     * @param key The option key.
     * @param value The option value.
     */
    setOption(key: StringOption, value: string): void;
    setOption(key: BooleanOption, value: boolean): void;
    setOption(key: StringArrayOption, value: number[]): void;
    setOption(key: NumberOption, value: number): void;
    setOption(key: GeometryOption, value: [number, number]): void;
    setOption(key: HandlerOption, value: (data: string) => void): void;
    setOption(key: Option, value: any): void;

    /**
     * Tells the renderer to refresh terminal content between two rows
     * (inclusive) at the next opportunity.
     * @param start The row to start from (between 0 and this.rows - 1).
     * @param end The row to end at (between start and this.rows - 1).
     */
    refresh(start: number, end: number): void;

    /**
     * Perform a full reset (RIS, aka '\x1bc').
     */
    reset(): void

    /**
     * Loads an addon, attaching it to the Terminal prototype and making it
     * available to all newly created Terminals.
     * @param addon The addon to load.
     */
    static loadAddon(addon: 'attach' | 'fit' | 'fullscreen' | 'search' | 'terminado'): void;
  }
}
