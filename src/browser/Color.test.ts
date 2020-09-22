/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { channels, color, css, rgb, rgba, toPaddedHex, contrastRatio } from 'browser/Color';

describe('Color', () => {

  describe('channels', () => {
    describe('toCss', () => {
      it('should convert an rgb array to css hex string', () => {
        assert.equal(channels.toCss(0x00, 0x00, 0x00), '#000000');
        assert.equal(channels.toCss(0x10, 0x10, 0x10), '#101010');
        assert.equal(channels.toCss(0x20, 0x20, 0x20), '#202020');
        assert.equal(channels.toCss(0x30, 0x30, 0x30), '#303030');
        assert.equal(channels.toCss(0x40, 0x40, 0x40), '#404040');
        assert.equal(channels.toCss(0x50, 0x50, 0x50), '#505050');
        assert.equal(channels.toCss(0x60, 0x60, 0x60), '#606060');
        assert.equal(channels.toCss(0x70, 0x70, 0x70), '#707070');
        assert.equal(channels.toCss(0x80, 0x80, 0x80), '#808080');
        assert.equal(channels.toCss(0x90, 0x90, 0x90), '#909090');
        assert.equal(channels.toCss(0xa0, 0xa0, 0xa0), '#a0a0a0');
        assert.equal(channels.toCss(0xb0, 0xb0, 0xb0), '#b0b0b0');
        assert.equal(channels.toCss(0xc0, 0xc0, 0xc0), '#c0c0c0');
        assert.equal(channels.toCss(0xd0, 0xd0, 0xd0), '#d0d0d0');
        assert.equal(channels.toCss(0xe0, 0xe0, 0xe0), '#e0e0e0');
        assert.equal(channels.toCss(0xf0, 0xf0, 0xf0), '#f0f0f0');
        assert.equal(channels.toCss(0xff, 0xff, 0xff), '#ffffff');
      });
    });

    describe('toRgba', () => {
      it('should convert an rgb array to an rgba number', () => {
        assert.equal(channels.toRgba(0x00, 0x00, 0x00), 0x000000FF);
        assert.equal(channels.toRgba(0x10, 0x10, 0x10), 0x101010FF);
        assert.equal(channels.toRgba(0x20, 0x20, 0x20), 0x202020FF);
        assert.equal(channels.toRgba(0x30, 0x30, 0x30), 0x303030FF);
        assert.equal(channels.toRgba(0x40, 0x40, 0x40), 0x404040FF);
        assert.equal(channels.toRgba(0x50, 0x50, 0x50), 0x505050FF);
        assert.equal(channels.toRgba(0x60, 0x60, 0x60), 0x606060FF);
        assert.equal(channels.toRgba(0x70, 0x70, 0x70), 0x707070FF);
        assert.equal(channels.toRgba(0x80, 0x80, 0x80), 0x808080FF);
        assert.equal(channels.toRgba(0x90, 0x90, 0x90), 0x909090FF);
        assert.equal(channels.toRgba(0xa0, 0xa0, 0xa0), 0xa0a0a0FF);
        assert.equal(channels.toRgba(0xb0, 0xb0, 0xb0), 0xb0b0b0FF);
        assert.equal(channels.toRgba(0xc0, 0xc0, 0xc0), 0xc0c0c0FF);
        assert.equal(channels.toRgba(0xd0, 0xd0, 0xd0), 0xd0d0d0FF);
        assert.equal(channels.toRgba(0xe0, 0xe0, 0xe0), 0xe0e0e0FF);
        assert.equal(channels.toRgba(0xf0, 0xf0, 0xf0), 0xf0f0f0FF);
        assert.equal(channels.toRgba(0xff, 0xff, 0xff), 0xffffffFF);
      });
      it('should convert an rgba array to an rgba number', () => {
        assert.equal(channels.toRgba(0x00, 0x00, 0x00, 0x00), 0x00000000);
        assert.equal(channels.toRgba(0x10, 0x10, 0x10, 0x10), 0x10101010);
        assert.equal(channels.toRgba(0x20, 0x20, 0x20, 0x20), 0x20202020);
        assert.equal(channels.toRgba(0x30, 0x30, 0x30, 0x30), 0x30303030);
        assert.equal(channels.toRgba(0x40, 0x40, 0x40, 0x40), 0x40404040);
        assert.equal(channels.toRgba(0x50, 0x50, 0x50, 0x50), 0x50505050);
        assert.equal(channels.toRgba(0x60, 0x60, 0x60, 0x60), 0x60606060);
        assert.equal(channels.toRgba(0x70, 0x70, 0x70, 0x70), 0x70707070);
        assert.equal(channels.toRgba(0x80, 0x80, 0x80, 0x80), 0x80808080);
        assert.equal(channels.toRgba(0x90, 0x90, 0x90, 0x90), 0x90909090);
        assert.equal(channels.toRgba(0xa0, 0xa0, 0xa0, 0xa0), 0xa0a0a0a0);
        assert.equal(channels.toRgba(0xb0, 0xb0, 0xb0, 0xb0), 0xb0b0b0b0);
        assert.equal(channels.toRgba(0xc0, 0xc0, 0xc0, 0xc0), 0xc0c0c0c0);
        assert.equal(channels.toRgba(0xd0, 0xd0, 0xd0, 0xd0), 0xd0d0d0d0);
        assert.equal(channels.toRgba(0xe0, 0xe0, 0xe0, 0xe0), 0xe0e0e0e0);
        assert.equal(channels.toRgba(0xf0, 0xf0, 0xf0, 0xf0), 0xf0f0f0f0);
        assert.equal(channels.toRgba(0xff, 0xff, 0xff, 0xff), 0xffffffff);
      });
    });
  });

  describe('color', () => {
    describe('blend', () => {
      it('should blend colors based on the alpha channel', () => {
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF00', rgba: 0xFFFFFF00 }), { css: '#000000', rgba: 0x000000FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF10', rgba: 0xFFFFFF10 }), { css: '#101010', rgba: 0x101010FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF20', rgba: 0xFFFFFF20 }), { css: '#202020', rgba: 0x202020FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF30', rgba: 0xFFFFFF30 }), { css: '#303030', rgba: 0x303030FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF40', rgba: 0xFFFFFF40 }), { css: '#404040', rgba: 0x404040FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF50', rgba: 0xFFFFFF50 }), { css: '#505050', rgba: 0x505050FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF60', rgba: 0xFFFFFF60 }), { css: '#606060', rgba: 0x606060FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF70', rgba: 0xFFFFFF70 }), { css: '#707070', rgba: 0x707070FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF80', rgba: 0xFFFFFF80 }), { css: '#808080', rgba: 0x808080FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFF90', rgba: 0xFFFFFF90 }), { css: '#909090', rgba: 0x909090FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFA0', rgba: 0xFFFFFFA0 }), { css: '#a0a0a0', rgba: 0xA0A0A0FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFB0', rgba: 0xFFFFFFB0 }), { css: '#b0b0b0', rgba: 0xB0B0B0FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFC0', rgba: 0xFFFFFFC0 }), { css: '#c0c0c0', rgba: 0xC0C0C0FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFD0', rgba: 0xFFFFFFD0 }), { css: '#d0d0d0', rgba: 0xD0D0D0FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFE0', rgba: 0xFFFFFFE0 }), { css: '#e0e0e0', rgba: 0xE0E0E0FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFF0', rgba: 0xFFFFFFF0 }), { css: '#f0f0f0', rgba: 0xF0F0F0FF });
        assert.deepEqual(color.blend({ css: '#000000', rgba: 0x000000FF }, { css: '#FFFFFFFF', rgba: 0xFFFFFFFF }), { css: '#FFFFFFFF', rgba: 0xFFFFFFFF });
      });
    });

    describe('opaque', () => {
      it('should make the color opaque', () => {
        assert.deepEqual(color.opaque({ css: '#00000000', rgba: 0x00000000 }), { css: '#000000', rgba: 0x000000FF });
        assert.deepEqual(color.opaque({ css: '#10101010', rgba: 0x10101010 }), { css: '#101010', rgba: 0x101010FF });
        assert.deepEqual(color.opaque({ css: '#20202020', rgba: 0x20202020 }), { css: '#202020', rgba: 0x202020FF });
        assert.deepEqual(color.opaque({ css: '#30303030', rgba: 0x30303030 }), { css: '#303030', rgba: 0x303030FF });
        assert.deepEqual(color.opaque({ css: '#40404040', rgba: 0x40404040 }), { css: '#404040', rgba: 0x404040FF });
        assert.deepEqual(color.opaque({ css: '#50505050', rgba: 0x50505050 }), { css: '#505050', rgba: 0x505050FF });
        assert.deepEqual(color.opaque({ css: '#60606060', rgba: 0x60606060 }), { css: '#606060', rgba: 0x606060FF });
        assert.deepEqual(color.opaque({ css: '#70707070', rgba: 0x70707070 }), { css: '#707070', rgba: 0x707070FF });
        assert.deepEqual(color.opaque({ css: '#80808080', rgba: 0x80808080 }), { css: '#808080', rgba: 0x808080FF });
        assert.deepEqual(color.opaque({ css: '#90909090', rgba: 0x90909090 }), { css: '#909090', rgba: 0x909090FF });
        assert.deepEqual(color.opaque({ css: '#a0a0a0a0', rgba: 0xa0a0a0a0 }), { css: '#a0a0a0', rgba: 0xa0a0a0FF });
        assert.deepEqual(color.opaque({ css: '#b0b0b0b0', rgba: 0xb0b0b0b0 }), { css: '#b0b0b0', rgba: 0xb0b0b0FF });
        assert.deepEqual(color.opaque({ css: '#c0c0c0c0', rgba: 0xc0c0c0c0 }), { css: '#c0c0c0', rgba: 0xc0c0c0FF });
        assert.deepEqual(color.opaque({ css: '#d0d0d0d0', rgba: 0xd0d0d0d0 }), { css: '#d0d0d0', rgba: 0xd0d0d0FF });
        assert.deepEqual(color.opaque({ css: '#e0e0e0e0', rgba: 0xe0e0e0e0 }), { css: '#e0e0e0', rgba: 0xe0e0e0FF });
        assert.deepEqual(color.opaque({ css: '#f0f0f0f0', rgba: 0xf0f0f0f0 }), { css: '#f0f0f0', rgba: 0xf0f0f0FF });
        assert.deepEqual(color.opaque({ css: '#ffffffff', rgba: 0xffffffff }), { css: '#ffffff', rgba: 0xffffffFF });
      });
    });

    describe('isOpaque', () => {
      it('should return true for opaque colors', () => {
        assert.ok(color.isOpaque(css.toColor('#000000')));
        assert.ok(color.isOpaque(css.toColor('#000000ff')));
        assert.ok(color.isOpaque(css.toColor('#808080')));
        assert.ok(color.isOpaque(css.toColor('#808080ff')));
        assert.ok(color.isOpaque(css.toColor('#ffffff')));
        assert.ok(color.isOpaque(css.toColor('#ffffffff')));
      });
      it('should return false for transparent colors', () => {
        assert.ok(!color.isOpaque(css.toColor('#00000000')));
        assert.ok(!color.isOpaque(css.toColor('#00000080')));
        assert.ok(!color.isOpaque(css.toColor('#000000fe')));
        assert.ok(!color.isOpaque(css.toColor('#80808000')));
        assert.ok(!color.isOpaque(css.toColor('#80808080')));
        assert.ok(!color.isOpaque(css.toColor('#808080fe')));
        assert.ok(!color.isOpaque(css.toColor('#ffffff00')));
        assert.ok(!color.isOpaque(css.toColor('#ffffff80')));
        assert.ok(!color.isOpaque(css.toColor('#fffffffe')));
      });
    });

    describe('opacity', () => {
      it('should make the color transparent', () => {
        assert.deepEqual(color.opacity(css.toColor('#000000'), 0), { css: '#00000000', rgba: 0x00000000 });
        assert.deepEqual(color.opacity(css.toColor('#000000'), 0.25), { css: '#00000040', rgba: 0x00000040 });
        assert.deepEqual(color.opacity(css.toColor('#000000'), 0.5), { css: '#00000080', rgba: 0x00000080 });
        assert.deepEqual(color.opacity(css.toColor('#000000'), 0.75), { css: '#000000bf', rgba: 0x000000bf });
        assert.deepEqual(color.opacity(css.toColor('#000000'), 1), { css: '#000000ff', rgba: 0x000000ff });
      });
    });
  });

  describe('css', () => {
    describe('toColor', () => {
      it('should convert the #rrggbb format to an IColor', () => {
        assert.deepEqual(css.toColor('#000000'), { css: '#000000', rgba: 0x000000FF });
        assert.deepEqual(css.toColor('#101010'), { css: '#101010', rgba: 0x101010FF });
        assert.deepEqual(css.toColor('#202020'), { css: '#202020', rgba: 0x202020FF });
        assert.deepEqual(css.toColor('#303030'), { css: '#303030', rgba: 0x303030FF });
        assert.deepEqual(css.toColor('#404040'), { css: '#404040', rgba: 0x404040FF });
        assert.deepEqual(css.toColor('#505050'), { css: '#505050', rgba: 0x505050FF });
        assert.deepEqual(css.toColor('#606060'), { css: '#606060', rgba: 0x606060FF });
        assert.deepEqual(css.toColor('#707070'), { css: '#707070', rgba: 0x707070FF });
        assert.deepEqual(css.toColor('#808080'), { css: '#808080', rgba: 0x808080FF });
        assert.deepEqual(css.toColor('#909090'), { css: '#909090', rgba: 0x909090FF });
        assert.deepEqual(css.toColor('#a0a0a0'), { css: '#a0a0a0', rgba: 0xa0a0a0FF });
        assert.deepEqual(css.toColor('#b0b0b0'), { css: '#b0b0b0', rgba: 0xb0b0b0FF });
        assert.deepEqual(css.toColor('#c0c0c0'), { css: '#c0c0c0', rgba: 0xc0c0c0FF });
        assert.deepEqual(css.toColor('#d0d0d0'), { css: '#d0d0d0', rgba: 0xd0d0d0FF });
        assert.deepEqual(css.toColor('#e0e0e0'), { css: '#e0e0e0', rgba: 0xe0e0e0FF });
        assert.deepEqual(css.toColor('#f0f0f0'), { css: '#f0f0f0', rgba: 0xf0f0f0FF });
        assert.deepEqual(css.toColor('#ffffff'), { css: '#ffffff', rgba: 0xffffffFF });
      });
      it('should convert the #rrggbbaa format to an IColor', () => {
        assert.deepEqual(css.toColor('#00000000'), { css: '#00000000', rgba: 0x00000000 });
        assert.deepEqual(css.toColor('#10101010'), { css: '#10101010', rgba: 0x10101010 });
        assert.deepEqual(css.toColor('#20202020'), { css: '#20202020', rgba: 0x20202020 });
        assert.deepEqual(css.toColor('#30303030'), { css: '#30303030', rgba: 0x30303030 });
        assert.deepEqual(css.toColor('#40404040'), { css: '#40404040', rgba: 0x40404040 });
        assert.deepEqual(css.toColor('#50505050'), { css: '#50505050', rgba: 0x50505050 });
        assert.deepEqual(css.toColor('#60606060'), { css: '#60606060', rgba: 0x60606060 });
        assert.deepEqual(css.toColor('#70707070'), { css: '#70707070', rgba: 0x70707070 });
        assert.deepEqual(css.toColor('#80808080'), { css: '#80808080', rgba: 0x80808080 });
        assert.deepEqual(css.toColor('#90909090'), { css: '#90909090', rgba: 0x90909090 });
        assert.deepEqual(css.toColor('#a0a0a0a0'), { css: '#a0a0a0a0', rgba: 0xa0a0a0a0 });
        assert.deepEqual(css.toColor('#b0b0b0b0'), { css: '#b0b0b0b0', rgba: 0xb0b0b0b0 });
        assert.deepEqual(css.toColor('#c0c0c0c0'), { css: '#c0c0c0c0', rgba: 0xc0c0c0c0 });
        assert.deepEqual(css.toColor('#d0d0d0d0'), { css: '#d0d0d0d0', rgba: 0xd0d0d0d0 });
        assert.deepEqual(css.toColor('#e0e0e0e0'), { css: '#e0e0e0e0', rgba: 0xe0e0e0e0 });
        assert.deepEqual(css.toColor('#f0f0f0f0'), { css: '#f0f0f0f0', rgba: 0xf0f0f0f0 });
        assert.deepEqual(css.toColor('#ffffffff'), { css: '#ffffffff', rgba: 0xffffffff });
      });
    });
  });

  describe('rgb', () => {
    describe('relativeLuminance', () => {
      it('should calculate the relative luminance of the color', () => {
        assert.equal(rgb.relativeLuminance(0x000000), 0);
        assert.equal(rgb.relativeLuminance(0x101010).toFixed(4), '0.0052');
        assert.equal(rgb.relativeLuminance(0x202020).toFixed(4), '0.0144');
        assert.equal(rgb.relativeLuminance(0x303030).toFixed(4), '0.0296');
        assert.equal(rgb.relativeLuminance(0x404040).toFixed(4), '0.0513');
        assert.equal(rgb.relativeLuminance(0x505050).toFixed(4), '0.0802');
        assert.equal(rgb.relativeLuminance(0x606060).toFixed(4), '0.1170');
        assert.equal(rgb.relativeLuminance(0x707070).toFixed(4), '0.1620');
        assert.equal(rgb.relativeLuminance(0x808080).toFixed(4), '0.2159');
        assert.equal(rgb.relativeLuminance(0x909090).toFixed(4), '0.2789');
        assert.equal(rgb.relativeLuminance(0xA0A0A0).toFixed(4), '0.3515');
        assert.equal(rgb.relativeLuminance(0xB0B0B0).toFixed(4), '0.4342');
        assert.equal(rgb.relativeLuminance(0xC0C0C0).toFixed(4), '0.5271');
        assert.equal(rgb.relativeLuminance(0xD0D0D0).toFixed(4), '0.6308');
        assert.equal(rgb.relativeLuminance(0xE0E0E0).toFixed(4), '0.7454');
        assert.equal(rgb.relativeLuminance(0xF0F0F0).toFixed(4), '0.8714');
        assert.equal(rgb.relativeLuminance(0xFFFFFF), 1);
      });
    });
  });

  describe('rgba', () => {
    describe('ensureContrastRatio', () => {
      it('should return undefined if the color already meets the contrast ratio (black bg)', () => {
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 1), undefined);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 2), undefined);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 3), undefined);
      });
      it('should return a color that meets the contrast ratio (black bg)', () => {
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 4), 0x707070ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 5), 0x7f7f7fff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 6), 0x8c8c8cff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 7), 0x989898ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 8), 0xa3a3a3ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 9), 0xadadadff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 10), 0xb6b6b6ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 11), 0xbebebeff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 12), 0xc5c5c5ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 13), 0xd1d1d1ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 14), 0xd6d6d6ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 15), 0xdbdbdbff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 16), 0xe3e3e3ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 17), 0xe9e9e9ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 18), 0xeeeeeeff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 19), 0xf4f4f4ff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 20), 0xfafafaff);
        assert.equal(rgba.ensureContrastRatio(0x000000ff, 0x606060ff, 21), 0xffffffff);
      });
      it('should return undefined if the color already meets the contrast ratio (white bg)', () => {
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 1), undefined);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 2), undefined);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 3), undefined);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 4), undefined);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 5), undefined);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 6), undefined);
      });
      it('should return a color that meets the contrast ratio (white bg)', () => {
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 7), 0x565656ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 8), 0x4d4d4dff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 9), 0x454545ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 10), 0x3e3e3eff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 11), 0x373737ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 12), 0x313131ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 13), 0x313131ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 14), 0x272727ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 15), 0x232323ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 16), 0x1f1f1fff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 17), 0x1b1b1bff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 18), 0x151515ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 19), 0x101010ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 20), 0x080808ff);
        assert.equal(rgba.ensureContrastRatio(0xffffffff, 0x606060ff, 21), 0x000000ff);
      });
    });

    describe('toChannels', () => {
      it('should convert an rgba number to an rgba array', () => {
        assert.deepEqual(rgba.toChannels(0x00000000), [0x00, 0x00, 0x00, 0x00]);
        assert.deepEqual(rgba.toChannels(0x10101010), [0x10, 0x10, 0x10, 0x10]);
        assert.deepEqual(rgba.toChannels(0x20202020), [0x20, 0x20, 0x20, 0x20]);
        assert.deepEqual(rgba.toChannels(0x30303030), [0x30, 0x30, 0x30, 0x30]);
        assert.deepEqual(rgba.toChannels(0x40404040), [0x40, 0x40, 0x40, 0x40]);
        assert.deepEqual(rgba.toChannels(0x50505050), [0x50, 0x50, 0x50, 0x50]);
        assert.deepEqual(rgba.toChannels(0x60606060), [0x60, 0x60, 0x60, 0x60]);
        assert.deepEqual(rgba.toChannels(0x70707070), [0x70, 0x70, 0x70, 0x70]);
        assert.deepEqual(rgba.toChannels(0x80808080), [0x80, 0x80, 0x80, 0x80]);
        assert.deepEqual(rgba.toChannels(0x90909090), [0x90, 0x90, 0x90, 0x90]);
        assert.deepEqual(rgba.toChannels(0xa0a0a0a0), [0xa0, 0xa0, 0xa0, 0xa0]);
        assert.deepEqual(rgba.toChannels(0xb0b0b0b0), [0xb0, 0xb0, 0xb0, 0xb0]);
        assert.deepEqual(rgba.toChannels(0xc0c0c0c0), [0xc0, 0xc0, 0xc0, 0xc0]);
        assert.deepEqual(rgba.toChannels(0xd0d0d0d0), [0xd0, 0xd0, 0xd0, 0xd0]);
        assert.deepEqual(rgba.toChannels(0xe0e0e0e0), [0xe0, 0xe0, 0xe0, 0xe0]);
        assert.deepEqual(rgba.toChannels(0xf0f0f0f0), [0xf0, 0xf0, 0xf0, 0xf0]);
        assert.deepEqual(rgba.toChannels(0xffffffff), [0xff, 0xff, 0xff, 0xff]);
      });
    });
  });

  describe('toPaddedHex', () => {
    it('should convert numbers to 2-digit hex values', () => {
      assert.equal(toPaddedHex(0x00), '00');
      assert.equal(toPaddedHex(0x10), '10');
      assert.equal(toPaddedHex(0x20), '20');
      assert.equal(toPaddedHex(0x30), '30');
      assert.equal(toPaddedHex(0x40), '40');
      assert.equal(toPaddedHex(0x50), '50');
      assert.equal(toPaddedHex(0x60), '60');
      assert.equal(toPaddedHex(0x70), '70');
      assert.equal(toPaddedHex(0x80), '80');
      assert.equal(toPaddedHex(0x90), '90');
      assert.equal(toPaddedHex(0xa0), 'a0');
      assert.equal(toPaddedHex(0xb0), 'b0');
      assert.equal(toPaddedHex(0xc0), 'c0');
      assert.equal(toPaddedHex(0xd0), 'd0');
      assert.equal(toPaddedHex(0xe0), 'e0');
      assert.equal(toPaddedHex(0xf0), 'f0');
      assert.equal(toPaddedHex(0xff), 'ff');
    });
  });

  describe('contrastRatio', () => {
    it('should calculate the relative luminance of the color', () => {
      assert.equal(contrastRatio(0, 0), 1);
      assert.equal(contrastRatio(0, 0.5), 11);
      assert.equal(contrastRatio(0, 1), 21);
    });
    it('should work regardless of the parameter order', () => {
      assert.equal(contrastRatio(0, 1), 21);
      assert.equal(contrastRatio(1, 0), 21);
    });
  });
});
