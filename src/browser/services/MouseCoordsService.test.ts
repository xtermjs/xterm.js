/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { MouseCoordsService } from './MouseCoordsService';
import { MockCharSizeService, MockRenderService } from '../TestUtils.test';

describe('MouseCoordsService', () => {
  let mouseCoordsService: MouseCoordsService;
  let element: HTMLElement;

  beforeEach(() => {
    const renderService = new MockRenderService();
    renderService.dimensions.css.canvas.width = 100;
    renderService.dimensions.css.canvas.height = 200;
    renderService.dimensions.css.cell.width = 10;
    renderService.dimensions.css.cell.height = 20;
    mouseCoordsService = new MouseCoordsService(new MockCharSizeService(10, 20), renderService);
    const document = new jsdom.JSDOM('').window.document;
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  describe('getMouseReportCoords', () => {
    it('should return the cell and pixel coords', () => {
      assert.deepEqual(
        mouseCoordsService.getMouseReportCoords({ clientX: 25, clientY: 45 } as MouseEvent, element),
        { col: 2, row: 2, x: 25, y: 45 }
      );
    });

    it('should return undefined when the coords are not finite', () => {
      assert.equal(mouseCoordsService.getMouseReportCoords({} as MouseEvent, element), undefined);
      assert.equal(mouseCoordsService.getMouseReportCoords({ clientX: NaN, clientY: 45 } as MouseEvent, element), undefined);
      assert.equal(mouseCoordsService.getMouseReportCoords({ clientX: 25, clientY: Infinity } as MouseEvent, element), undefined);
    });
  });
});
