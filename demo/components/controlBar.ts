/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface ITabConfig {
  id: string;
  label: string;
}

export interface IControlWindow {
  readonly id: string;
  readonly label: string;
  build(container: HTMLElement): void;
}

export class ControlBar {
  private readonly _sidebar: HTMLElement;
  private readonly _resizeHandleH: HTMLElement;
  private readonly _resizeHandleV: HTMLElement;
  private readonly _resizeHandleCorner: HTMLElement;
  private _resizeMode: 'none' | 'horizontal' | 'vertical' | 'corner' = 'none';

  private readonly _tabContainer: HTMLElement;
  private readonly _tabs: Map<string, { button: HTMLButtonElement; content: HTMLElement }> = new Map();
  private _activeTabId: string | null = null;

  constructor(sidebar: HTMLElement, tabContainer: HTMLElement, tabs: ITabConfig[]) {
    this._sidebar = sidebar;
    this._tabContainer = tabContainer;

    // Create resize handles
    this._resizeHandleH = document.createElement('div');
    this._resizeHandleH.id = 'sidebar-resize-handle-horizontal';

    this._resizeHandleV = document.createElement('div');
    this._resizeHandleV.id = 'sidebar-resize-handle-vertical';

    this._resizeHandleCorner = document.createElement('div');
    this._resizeHandleCorner.id = 'sidebar-resize-handle-corner';

    // Insert handles at the beginning of the sidebar
    this._sidebar.prepend(this._resizeHandleCorner);
    this._sidebar.prepend(this._resizeHandleV);
    this._sidebar.prepend(this._resizeHandleH);

    this._initResizeListeners();
    this._initTabs(tabs);
  }

  private _initResizeListeners(): void {
    this._resizeHandleH.addEventListener('mousedown', (e: MouseEvent) => this._startResize('horizontal', e));
    this._resizeHandleV.addEventListener('mousedown', (e: MouseEvent) => this._startResize('vertical', e));
    this._resizeHandleCorner.addEventListener('mousedown', (e: MouseEvent) => this._startResize('corner', e));

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (this._resizeMode === 'none') return;
      if (this._resizeMode === 'horizontal' || this._resizeMode === 'corner') {
        const newWidth = window.innerWidth - e.clientX - 10;
        this._sidebar.style.width = `${Math.max(200, newWidth)}px`;
      }
      if (this._resizeMode === 'vertical' || this._resizeMode === 'corner') {
        const rect = this._sidebar.getBoundingClientRect();
        const newHeight = e.clientY - rect.top;
        this._sidebar.style.height = `${Math.max(100, newHeight)}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      this._resizeMode = 'none';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }

  private _startResize(mode: 'horizontal' | 'vertical' | 'corner', e: MouseEvent): void {
    this._resizeMode = mode;
    document.body.style.cursor = mode === 'horizontal' ? 'ew-resize' : mode === 'vertical' ? 'ns-resize' : 'nesw-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  private _initTabs(tabs: ITabConfig[]): void {
    // Clear existing buttons
    this._tabContainer.innerHTML = '';

    // Create tab buttons
    for (const tab of tabs) {
      const content = document.getElementById(tab.id);
      if (!content) {
        console.warn(`Tab content element not found: ${tab.id}`);
        continue;
      }

      const button = document.createElement('button');
      button.id = `${tab.id}button`;
      button.className = 'tabLinks';
      button.textContent = tab.label;
      button.addEventListener('click', (e) => this._openSection(e, tab.id));

      this._tabContainer.appendChild(button);
      this._tabs.set(tab.id, { button, content });

      // Hide content initially
      content.style.display = 'none';
    }

    // Restore saved tab or default to first
    const savedTab = localStorage.getItem('tab');
    const tabId = savedTab && this._tabs.has(savedTab) ? savedTab : tabs[0]?.id;
    if (tabId) {
      this._activateTab(tabId);
    }
  }

  private _openSection(event: MouseEvent, tabId: string): void {
    const tab = this._tabs.get(tabId);
    if (!tab) return;

    // If clicking active tab, toggle sidebar visibility
    if (tab.button.classList.contains('active')) {
      this._sidebar.classList.toggle('sidebar-hidden');
      return;
    }

    // Show sidebar if hidden
    this._sidebar.classList.remove('sidebar-hidden');

    this._activateTab(tabId);
  }

  private _activateTab(tabId: string): void {
    // Deactivate all tabs
    for (const [, { button, content }] of this._tabs) {
      button.classList.remove('active');
      content.style.display = 'none';
    }

    // Activate the selected tab
    const tab = this._tabs.get(tabId);
    if (tab) {
      tab.button.classList.add('active');
      tab.content.style.display = 'block';
      this._activeTabId = tabId;
      localStorage.setItem('tab', tabId);
    }
  }

  public registerWindow(window: IControlWindow): void {
    // Create button
    const button = document.createElement('button');
    button.id = `${window.id}button`;
    button.className = 'tabLinks';
    button.textContent = window.label;
    button.addEventListener('click', (e) => this._openSection(e, window.id));
    this._tabContainer.appendChild(button);

    // Create content container
    const content = document.createElement('div');
    content.id = window.id;
    content.className = 'tabContent';
    content.style.display = 'none';
    this._sidebar.appendChild(content);

    // Let the window build its content
    window.build(content);

    this._tabs.set(window.id, { button, content });
  }

  public get activeTabId(): string | null {
    return this._activeTabId;
  }
}
