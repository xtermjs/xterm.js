interface ITextAttributes {
  flags: number;
  foreground: number;
  background: number;
}

export const enum AtlasEntry {
  FLAGS = 1,
  FOREGROUND = 2,
  BACKGROUND = 3
}

export class TextAttributeAtlas {
  /** data storage */
  public data: Uint32Array;
  constructor(size: number) {
    this.data = new Uint32Array(size * 4);
  }
  private _setData(idx: number, attributes: ITextAttributes): void {
    this.data[idx] = 0;
    this.data[idx + AtlasEntry.FLAGS] = attributes.flags;
    this.data[idx + AtlasEntry.FOREGROUND] = attributes.foreground;
    this.data[idx + AtlasEntry.BACKGROUND] = attributes.background;
  }

  /**
   * convenient method to inspect attributes at slot `idx`.
   * For better performance atlas idx and AtlasEntry
   * should be used directly to avoid number conversions.
   * @param {number} idx
   * @return {ITextAttributes}
   */
  getAttributes(idx: number): ITextAttributes {
    return {
      flags: this.data[idx + AtlasEntry.FLAGS],
      foreground: this.data[idx + AtlasEntry.FOREGROUND],
      background: this.data[idx + AtlasEntry.BACKGROUND]
    };
  }

  /**
   * Returns a slot index in the atlas for the given text attributes.
   * To be called upon attributes changes, e.g. by SGR.
   * NOTE: The ref counter is set to 0 for a new slot index, thus
   * values will get overwritten if not referenced in between.
   * @param {ITextAttributes} attributes
   * @return {number}
   */
  getSlot(attributes: ITextAttributes): number {
    // find equal slot or free
    for (let i = 0; i < this.data.length; i += 4) {
      if (!this.data[i]) {
        this._setData(i, attributes);
        return i;
      }
      if (
          this.data[i + AtlasEntry.FLAGS] === attributes.flags
          && this.data[i + AtlasEntry.FOREGROUND] === attributes.foreground
          && this.data[i + AtlasEntry.BACKGROUND] === attributes.background
      ) {
          return i;
      }
    }
    // could not find a valid slot --> resize storage
    const data = new Uint32Array(this.data.length * 2);
    for (let i = 0; i < this.data.length; ++i) data[i] = this.data[i];
    const idx = this.data.length;
    this.data = data;
    this._setData(idx, attributes);
    return idx;
  }

  /**
   * Increment ref counter.
   * To be called for every terminal cell, that holds `idx` as text attributes.
   * @param {number} idx
   */
  ref(idx: number): void {
    this.data[idx]++;
  }

  /**
   * Decrement ref counter. Once dropped to 0 the slot will be reused.
   * To be called for every cell that gets removed or reused with another value.
   * @param {number} idx
   */
  unref(idx: number): void {
    this.data[idx]--;
    if (this.data[idx] < 0)
    this.data[idx] = 0;
  }
}
