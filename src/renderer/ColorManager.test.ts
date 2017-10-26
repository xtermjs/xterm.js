/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { ColorManager } from './ColorManager';

describe('ColorManager', () => {
  let cm: ColorManager;

  beforeEach(() => {
    cm = new ColorManager();
  });

  describe('constructor', () => {
    it('should fill all colors with values', () => {
      for (let key in cm.colors) {
        if (typeof key === 'string') {
          // A #rrggbb or rgba(...)
          assert.ok(cm.colors[key].length >= 7);
        }
      }
      assert.equal(cm.colors.ansi.length, 256);
    });

    it('should fill 240 colors with expected values', () => {
      assert.equal(cm.colors.ansi[16], '#000000');
      assert.equal(cm.colors.ansi[17], '#00005f');
      assert.equal(cm.colors.ansi[18], '#000087');
      assert.equal(cm.colors.ansi[19], '#0000af');
      assert.equal(cm.colors.ansi[20], '#0000d7');
      assert.equal(cm.colors.ansi[21], '#0000ff');
      assert.equal(cm.colors.ansi[22], '#005f00');
      assert.equal(cm.colors.ansi[23], '#005f5f');
      assert.equal(cm.colors.ansi[24], '#005f87');
      assert.equal(cm.colors.ansi[25], '#005faf');
      assert.equal(cm.colors.ansi[26], '#005fd7');
      assert.equal(cm.colors.ansi[27], '#005fff');
      assert.equal(cm.colors.ansi[28], '#008700');
      assert.equal(cm.colors.ansi[29], '#00875f');
      assert.equal(cm.colors.ansi[30], '#008787');
      assert.equal(cm.colors.ansi[31], '#0087af');
      assert.equal(cm.colors.ansi[32], '#0087d7');
      assert.equal(cm.colors.ansi[33], '#0087ff');
      assert.equal(cm.colors.ansi[34], '#00af00');
      assert.equal(cm.colors.ansi[35], '#00af5f');
      assert.equal(cm.colors.ansi[36], '#00af87');
      assert.equal(cm.colors.ansi[37], '#00afaf');
      assert.equal(cm.colors.ansi[38], '#00afd7');
      assert.equal(cm.colors.ansi[39], '#00afff');
      assert.equal(cm.colors.ansi[40], '#00d700');
      assert.equal(cm.colors.ansi[41], '#00d75f');
      assert.equal(cm.colors.ansi[42], '#00d787');
      assert.equal(cm.colors.ansi[43], '#00d7af');
      assert.equal(cm.colors.ansi[44], '#00d7d7');
      assert.equal(cm.colors.ansi[45], '#00d7ff');
      assert.equal(cm.colors.ansi[46], '#00ff00');
      assert.equal(cm.colors.ansi[47], '#00ff5f');
      assert.equal(cm.colors.ansi[48], '#00ff87');
      assert.equal(cm.colors.ansi[49], '#00ffaf');
      assert.equal(cm.colors.ansi[50], '#00ffd7');
      assert.equal(cm.colors.ansi[51], '#00ffff');
      assert.equal(cm.colors.ansi[52], '#5f0000');
      assert.equal(cm.colors.ansi[53], '#5f005f');
      assert.equal(cm.colors.ansi[54], '#5f0087');
      assert.equal(cm.colors.ansi[55], '#5f00af');
      assert.equal(cm.colors.ansi[56], '#5f00d7');
      assert.equal(cm.colors.ansi[57], '#5f00ff');
      assert.equal(cm.colors.ansi[58], '#5f5f00');
      assert.equal(cm.colors.ansi[59], '#5f5f5f');
      assert.equal(cm.colors.ansi[60], '#5f5f87');
      assert.equal(cm.colors.ansi[61], '#5f5faf');
      assert.equal(cm.colors.ansi[62], '#5f5fd7');
      assert.equal(cm.colors.ansi[63], '#5f5fff');
      assert.equal(cm.colors.ansi[64], '#5f8700');
      assert.equal(cm.colors.ansi[65], '#5f875f');
      assert.equal(cm.colors.ansi[66], '#5f8787');
      assert.equal(cm.colors.ansi[67], '#5f87af');
      assert.equal(cm.colors.ansi[68], '#5f87d7');
      assert.equal(cm.colors.ansi[69], '#5f87ff');
      assert.equal(cm.colors.ansi[70], '#5faf00');
      assert.equal(cm.colors.ansi[71], '#5faf5f');
      assert.equal(cm.colors.ansi[72], '#5faf87');
      assert.equal(cm.colors.ansi[73], '#5fafaf');
      assert.equal(cm.colors.ansi[74], '#5fafd7');
      assert.equal(cm.colors.ansi[75], '#5fafff');
      assert.equal(cm.colors.ansi[76], '#5fd700');
      assert.equal(cm.colors.ansi[77], '#5fd75f');
      assert.equal(cm.colors.ansi[78], '#5fd787');
      assert.equal(cm.colors.ansi[79], '#5fd7af');
      assert.equal(cm.colors.ansi[80], '#5fd7d7');
      assert.equal(cm.colors.ansi[81], '#5fd7ff');
      assert.equal(cm.colors.ansi[82], '#5fff00');
      assert.equal(cm.colors.ansi[83], '#5fff5f');
      assert.equal(cm.colors.ansi[84], '#5fff87');
      assert.equal(cm.colors.ansi[85], '#5fffaf');
      assert.equal(cm.colors.ansi[86], '#5fffd7');
      assert.equal(cm.colors.ansi[87], '#5fffff');
      assert.equal(cm.colors.ansi[88], '#870000');
      assert.equal(cm.colors.ansi[89], '#87005f');
      assert.equal(cm.colors.ansi[90], '#870087');
      assert.equal(cm.colors.ansi[91], '#8700af');
      assert.equal(cm.colors.ansi[92], '#8700d7');
      assert.equal(cm.colors.ansi[93], '#8700ff');
      assert.equal(cm.colors.ansi[94], '#875f00');
      assert.equal(cm.colors.ansi[95], '#875f5f');
      assert.equal(cm.colors.ansi[96], '#875f87');
      assert.equal(cm.colors.ansi[97], '#875faf');
      assert.equal(cm.colors.ansi[98], '#875fd7');
      assert.equal(cm.colors.ansi[99], '#875fff');
      assert.equal(cm.colors.ansi[100], '#878700');
      assert.equal(cm.colors.ansi[101], '#87875f');
      assert.equal(cm.colors.ansi[102], '#878787');
      assert.equal(cm.colors.ansi[103], '#8787af');
      assert.equal(cm.colors.ansi[104], '#8787d7');
      assert.equal(cm.colors.ansi[105], '#8787ff');
      assert.equal(cm.colors.ansi[106], '#87af00');
      assert.equal(cm.colors.ansi[107], '#87af5f');
      assert.equal(cm.colors.ansi[108], '#87af87');
      assert.equal(cm.colors.ansi[109], '#87afaf');
      assert.equal(cm.colors.ansi[110], '#87afd7');
      assert.equal(cm.colors.ansi[111], '#87afff');
      assert.equal(cm.colors.ansi[112], '#87d700');
      assert.equal(cm.colors.ansi[113], '#87d75f');
      assert.equal(cm.colors.ansi[114], '#87d787');
      assert.equal(cm.colors.ansi[115], '#87d7af');
      assert.equal(cm.colors.ansi[116], '#87d7d7');
      assert.equal(cm.colors.ansi[117], '#87d7ff');
      assert.equal(cm.colors.ansi[118], '#87ff00');
      assert.equal(cm.colors.ansi[119], '#87ff5f');
      assert.equal(cm.colors.ansi[120], '#87ff87');
      assert.equal(cm.colors.ansi[121], '#87ffaf');
      assert.equal(cm.colors.ansi[122], '#87ffd7');
      assert.equal(cm.colors.ansi[123], '#87ffff');
      assert.equal(cm.colors.ansi[124], '#af0000');
      assert.equal(cm.colors.ansi[125], '#af005f');
      assert.equal(cm.colors.ansi[126], '#af0087');
      assert.equal(cm.colors.ansi[127], '#af00af');
      assert.equal(cm.colors.ansi[128], '#af00d7');
      assert.equal(cm.colors.ansi[129], '#af00ff');
      assert.equal(cm.colors.ansi[130], '#af5f00');
      assert.equal(cm.colors.ansi[131], '#af5f5f');
      assert.equal(cm.colors.ansi[132], '#af5f87');
      assert.equal(cm.colors.ansi[133], '#af5faf');
      assert.equal(cm.colors.ansi[134], '#af5fd7');
      assert.equal(cm.colors.ansi[135], '#af5fff');
      assert.equal(cm.colors.ansi[136], '#af8700');
      assert.equal(cm.colors.ansi[137], '#af875f');
      assert.equal(cm.colors.ansi[138], '#af8787');
      assert.equal(cm.colors.ansi[139], '#af87af');
      assert.equal(cm.colors.ansi[140], '#af87d7');
      assert.equal(cm.colors.ansi[141], '#af87ff');
      assert.equal(cm.colors.ansi[142], '#afaf00');
      assert.equal(cm.colors.ansi[143], '#afaf5f');
      assert.equal(cm.colors.ansi[144], '#afaf87');
      assert.equal(cm.colors.ansi[145], '#afafaf');
      assert.equal(cm.colors.ansi[146], '#afafd7');
      assert.equal(cm.colors.ansi[147], '#afafff');
      assert.equal(cm.colors.ansi[148], '#afd700');
      assert.equal(cm.colors.ansi[149], '#afd75f');
      assert.equal(cm.colors.ansi[150], '#afd787');
      assert.equal(cm.colors.ansi[151], '#afd7af');
      assert.equal(cm.colors.ansi[152], '#afd7d7');
      assert.equal(cm.colors.ansi[153], '#afd7ff');
      assert.equal(cm.colors.ansi[154], '#afff00');
      assert.equal(cm.colors.ansi[155], '#afff5f');
      assert.equal(cm.colors.ansi[156], '#afff87');
      assert.equal(cm.colors.ansi[157], '#afffaf');
      assert.equal(cm.colors.ansi[158], '#afffd7');
      assert.equal(cm.colors.ansi[159], '#afffff');
      assert.equal(cm.colors.ansi[160], '#d70000');
      assert.equal(cm.colors.ansi[161], '#d7005f');
      assert.equal(cm.colors.ansi[162], '#d70087');
      assert.equal(cm.colors.ansi[163], '#d700af');
      assert.equal(cm.colors.ansi[164], '#d700d7');
      assert.equal(cm.colors.ansi[165], '#d700ff');
      assert.equal(cm.colors.ansi[166], '#d75f00');
      assert.equal(cm.colors.ansi[167], '#d75f5f');
      assert.equal(cm.colors.ansi[168], '#d75f87');
      assert.equal(cm.colors.ansi[169], '#d75faf');
      assert.equal(cm.colors.ansi[170], '#d75fd7');
      assert.equal(cm.colors.ansi[171], '#d75fff');
      assert.equal(cm.colors.ansi[172], '#d78700');
      assert.equal(cm.colors.ansi[173], '#d7875f');
      assert.equal(cm.colors.ansi[174], '#d78787');
      assert.equal(cm.colors.ansi[175], '#d787af');
      assert.equal(cm.colors.ansi[176], '#d787d7');
      assert.equal(cm.colors.ansi[177], '#d787ff');
      assert.equal(cm.colors.ansi[178], '#d7af00');
      assert.equal(cm.colors.ansi[179], '#d7af5f');
      assert.equal(cm.colors.ansi[180], '#d7af87');
      assert.equal(cm.colors.ansi[181], '#d7afaf');
      assert.equal(cm.colors.ansi[182], '#d7afd7');
      assert.equal(cm.colors.ansi[183], '#d7afff');
      assert.equal(cm.colors.ansi[184], '#d7d700');
      assert.equal(cm.colors.ansi[185], '#d7d75f');
      assert.equal(cm.colors.ansi[186], '#d7d787');
      assert.equal(cm.colors.ansi[187], '#d7d7af');
      assert.equal(cm.colors.ansi[188], '#d7d7d7');
      assert.equal(cm.colors.ansi[189], '#d7d7ff');
      assert.equal(cm.colors.ansi[190], '#d7ff00');
      assert.equal(cm.colors.ansi[191], '#d7ff5f');
      assert.equal(cm.colors.ansi[192], '#d7ff87');
      assert.equal(cm.colors.ansi[193], '#d7ffaf');
      assert.equal(cm.colors.ansi[194], '#d7ffd7');
      assert.equal(cm.colors.ansi[195], '#d7ffff');
      assert.equal(cm.colors.ansi[196], '#ff0000');
      assert.equal(cm.colors.ansi[197], '#ff005f');
      assert.equal(cm.colors.ansi[198], '#ff0087');
      assert.equal(cm.colors.ansi[199], '#ff00af');
      assert.equal(cm.colors.ansi[200], '#ff00d7');
      assert.equal(cm.colors.ansi[201], '#ff00ff');
      assert.equal(cm.colors.ansi[202], '#ff5f00');
      assert.equal(cm.colors.ansi[203], '#ff5f5f');
      assert.equal(cm.colors.ansi[204], '#ff5f87');
      assert.equal(cm.colors.ansi[205], '#ff5faf');
      assert.equal(cm.colors.ansi[206], '#ff5fd7');
      assert.equal(cm.colors.ansi[207], '#ff5fff');
      assert.equal(cm.colors.ansi[208], '#ff8700');
      assert.equal(cm.colors.ansi[209], '#ff875f');
      assert.equal(cm.colors.ansi[210], '#ff8787');
      assert.equal(cm.colors.ansi[211], '#ff87af');
      assert.equal(cm.colors.ansi[212], '#ff87d7');
      assert.equal(cm.colors.ansi[213], '#ff87ff');
      assert.equal(cm.colors.ansi[214], '#ffaf00');
      assert.equal(cm.colors.ansi[215], '#ffaf5f');
      assert.equal(cm.colors.ansi[216], '#ffaf87');
      assert.equal(cm.colors.ansi[217], '#ffafaf');
      assert.equal(cm.colors.ansi[218], '#ffafd7');
      assert.equal(cm.colors.ansi[219], '#ffafff');
      assert.equal(cm.colors.ansi[220], '#ffd700');
      assert.equal(cm.colors.ansi[221], '#ffd75f');
      assert.equal(cm.colors.ansi[222], '#ffd787');
      assert.equal(cm.colors.ansi[223], '#ffd7af');
      assert.equal(cm.colors.ansi[224], '#ffd7d7');
      assert.equal(cm.colors.ansi[225], '#ffd7ff');
      assert.equal(cm.colors.ansi[226], '#ffff00');
      assert.equal(cm.colors.ansi[227], '#ffff5f');
      assert.equal(cm.colors.ansi[228], '#ffff87');
      assert.equal(cm.colors.ansi[229], '#ffffaf');
      assert.equal(cm.colors.ansi[230], '#ffffd7');
      assert.equal(cm.colors.ansi[231], '#ffffff');
      assert.equal(cm.colors.ansi[232], '#080808');
      assert.equal(cm.colors.ansi[233], '#121212');
      assert.equal(cm.colors.ansi[234], '#1c1c1c');
      assert.equal(cm.colors.ansi[235], '#262626');
      assert.equal(cm.colors.ansi[236], '#303030');
      assert.equal(cm.colors.ansi[237], '#3a3a3a');
      assert.equal(cm.colors.ansi[238], '#444444');
      assert.equal(cm.colors.ansi[239], '#4e4e4e');
      assert.equal(cm.colors.ansi[240], '#585858');
      assert.equal(cm.colors.ansi[241], '#626262');
      assert.equal(cm.colors.ansi[242], '#6c6c6c');
      assert.equal(cm.colors.ansi[243], '#767676');
      assert.equal(cm.colors.ansi[244], '#808080');
      assert.equal(cm.colors.ansi[245], '#8a8a8a');
      assert.equal(cm.colors.ansi[246], '#949494');
      assert.equal(cm.colors.ansi[247], '#9e9e9e');
      assert.equal(cm.colors.ansi[248], '#a8a8a8');
      assert.equal(cm.colors.ansi[249], '#b2b2b2');
      assert.equal(cm.colors.ansi[250], '#bcbcbc');
      assert.equal(cm.colors.ansi[251], '#c6c6c6');
      assert.equal(cm.colors.ansi[252], '#d0d0d0');
      assert.equal(cm.colors.ansi[253], '#dadada');
      assert.equal(cm.colors.ansi[254], '#e4e4e4');
      assert.equal(cm.colors.ansi[255], '#eeeeee');
    });
  });

  describe('setTheme', () => {
    it('should not throw when not setting all colors', () => {
      assert.doesNotThrow(() => {
        cm.setTheme({});
      });
    });

    it('should set a partial set of colors, using the default if not present', () => {
      assert.equal(cm.colors.background, '#000000');
      assert.equal(cm.colors.foreground, '#ffffff');
      cm.setTheme({
        background: '#FF0000',
        foreground: '#00FF00'
      });
      assert.equal(cm.colors.background, '#FF0000');
      assert.equal(cm.colors.foreground, '#00FF00');
      cm.setTheme({
        background: '#0000FF'
      });
      assert.equal(cm.colors.background, '#0000FF');
      // FG reverts back to default
      assert.equal(cm.colors.foreground, '#ffffff');
    });
  });
});
