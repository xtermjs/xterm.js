/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export function initControlBar(): void {
  // Sidebar resize handling
  const sidebar = document.getElementById('sidebar');
  const resizeHandleH = document.getElementById('sidebar-resize-handle-horizontal');
  const resizeHandleV = document.getElementById('sidebar-resize-handle-vertical');
  const resizeHandleCorner = document.getElementById('sidebar-resize-handle-corner');
  let resizeMode: 'none' | 'horizontal' | 'vertical' | 'corner' = 'none';

  function startResize(mode: 'horizontal' | 'vertical' | 'corner', e: MouseEvent): void {
    resizeMode = mode;
    document.body.style.cursor = mode === 'horizontal' ? 'ew-resize' : mode === 'vertical' ? 'ns-resize' : 'nesw-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  resizeHandleH.addEventListener('mousedown', (e: MouseEvent) => startResize('horizontal', e));
  resizeHandleV.addEventListener('mousedown', (e: MouseEvent) => startResize('vertical', e));
  resizeHandleCorner.addEventListener('mousedown', (e: MouseEvent) => startResize('corner', e));

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (resizeMode === 'none') return;
    if (resizeMode === 'horizontal' || resizeMode === 'corner') {
      const newWidth = window.innerWidth - e.clientX - 10;
      sidebar.style.width = `${Math.max(200, newWidth)}px`;
    }
    if (resizeMode === 'vertical' || resizeMode === 'corner') {
      const rect = sidebar.getBoundingClientRect();
      const newHeight = e.clientY - rect.top;
      sidebar.style.height = `${Math.max(100, newHeight)}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    resizeMode = 'none';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}
