/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface IStyleSheet {
  dispose: () => void;
  setCss: (value: string) => void;
}

const createCssStyleSheet = (doc: Document): IStyleSheet => {
  const sheet = new CSSStyleSheet();
  doc.adoptedStyleSheets.push(sheet);
  return {
    dispose() {
      const index = doc.adoptedStyleSheets.indexOf(sheet);
      doc.adoptedStyleSheets.splice(index, 1);
    },
    setCss(css) {
      sheet.replaceSync(css);
    }
  };
};

const createStyleElement = (parent: HTMLElement): IStyleSheet => {
  const doc = parent.ownerDocument;
  const element = doc.createElement('style');
  parent.append(element);
  return {
    dispose() {
      element.remove();
    },
    setCss(css) {
      element.textContent = css;
    }
  };
};

export const createStyle = (parent: HTMLElement): IStyleSheet => {
  try {
    return createCssStyleSheet(parent.ownerDocument);
  } catch {
    return createStyleElement(parent);
  }
};
