export interface IStyleSheet {
  dispose: () => void;
  setCss: (value: string) => void;
}

const createCssStyleSheet = (): IStyleSheet => {
  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets.push(sheet);
  return {
    dispose() {
      const index = document.adoptedStyleSheets.indexOf(sheet);
      document.adoptedStyleSheets.splice(index, 1);
    },
    setCss(css) {
      sheet.replaceSync(css);
    }
  };
};

const createStyleElement = (parent: HTMLElement): IStyleSheet => {
  const element = document.createElement('style');
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
    return createCssStyleSheet();
  } catch {
    return createStyleElement(parent);
  }
};
