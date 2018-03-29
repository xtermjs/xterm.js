/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { ColorManager } from './ColorManager';

describe('ColorManager', () => {
  let cm: ColorManager;
  let dom: jsdom.JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    window = dom.window;
    document = window.document;
    (<any>window).HTMLCanvasElement.prototype.getContext = () => ({
      createLinearGradient(): any {
        return null;
      },

      fillRect(): void { },

      getImageData(): any {
        return {data: [0, 0, 0, 0xFF]};
      }
    });
    cm = new ColorManager(document, false);
  });

  describe('constructor', () => {
    it('should fill all colors with values', () => {
      for (let key of Object.keys(cm.colors)) {
        if (key !== 'ansi') {
          // A #rrggbb or rgba(...)
          assert.ok(cm.colors[key].css.length >= 7);
        }
      }
      assert.equal(cm.colors.ansi.length, 256);
    });

    it('should fill 240 colors with expected values', () => {
      assert.equal(cm.colors.ansi[16].css, '#000000');
      assert.equal(cm.colors.ansi[17].css, '#00005f');
      assert.equal(cm.colors.ansi[18].css, '#000087');
      assert.equal(cm.colors.ansi[19].css, '#0000af');
      assert.equal(cm.colors.ansi[20].css, '#0000d7');
      assert.equal(cm.colors.ansi[21].css, '#0000ff');
      assert.equal(cm.colors.ansi[22].css, '#005f00');
      assert.equal(cm.colors.ansi[23].css, '#005f5f');
      assert.equal(cm.colors.ansi[24].css, '#005f87');
      assert.equal(cm.colors.ansi[25].css, '#005faf');
      assert.equal(cm.colors.ansi[26].css, '#005fd7');
      assert.equal(cm.colors.ansi[27].css, '#005fff');
      assert.equal(cm.colors.ansi[28].css, '#008700');
      assert.equal(cm.colors.ansi[29].css, '#00875f');
      assert.equal(cm.colors.ansi[30].css, '#008787');
      assert.equal(cm.colors.ansi[31].css, '#0087af');
      assert.equal(cm.colors.ansi[32].css, '#0087d7');
      assert.equal(cm.colors.ansi[33].css, '#0087ff');
      assert.equal(cm.colors.ansi[34].css, '#00af00');
      assert.equal(cm.colors.ansi[35].css, '#00af5f');
      assert.equal(cm.colors.ansi[36].css, '#00af87');
      assert.equal(cm.colors.ansi[37].css, '#00afaf');
      assert.equal(cm.colors.ansi[38].css, '#00afd7');
      assert.equal(cm.colors.ansi[39].css, '#00afff');
      assert.equal(cm.colors.ansi[40].css, '#00d700');
      assert.equal(cm.colors.ansi[41].css, '#00d75f');
      assert.equal(cm.colors.ansi[42].css, '#00d787');
      assert.equal(cm.colors.ansi[43].css, '#00d7af');
      assert.equal(cm.colors.ansi[44].css, '#00d7d7');
      assert.equal(cm.colors.ansi[45].css, '#00d7ff');
      assert.equal(cm.colors.ansi[46].css, '#00ff00');
      assert.equal(cm.colors.ansi[47].css, '#00ff5f');
      assert.equal(cm.colors.ansi[48].css, '#00ff87');
      assert.equal(cm.colors.ansi[49].css, '#00ffaf');
      assert.equal(cm.colors.ansi[50].css, '#00ffd7');
      assert.equal(cm.colors.ansi[51].css, '#00ffff');
      assert.equal(cm.colors.ansi[52].css, '#5f0000');
      assert.equal(cm.colors.ansi[53].css, '#5f005f');
      assert.equal(cm.colors.ansi[54].css, '#5f0087');
      assert.equal(cm.colors.ansi[55].css, '#5f00af');
      assert.equal(cm.colors.ansi[56].css, '#5f00d7');
      assert.equal(cm.colors.ansi[57].css, '#5f00ff');
      assert.equal(cm.colors.ansi[58].css, '#5f5f00');
      assert.equal(cm.colors.ansi[59].css, '#5f5f5f');
      assert.equal(cm.colors.ansi[60].css, '#5f5f87');
      assert.equal(cm.colors.ansi[61].css, '#5f5faf');
      assert.equal(cm.colors.ansi[62].css, '#5f5fd7');
      assert.equal(cm.colors.ansi[63].css, '#5f5fff');
      assert.equal(cm.colors.ansi[64].css, '#5f8700');
      assert.equal(cm.colors.ansi[65].css, '#5f875f');
      assert.equal(cm.colors.ansi[66].css, '#5f8787');
      assert.equal(cm.colors.ansi[67].css, '#5f87af');
      assert.equal(cm.colors.ansi[68].css, '#5f87d7');
      assert.equal(cm.colors.ansi[69].css, '#5f87ff');
      assert.equal(cm.colors.ansi[70].css, '#5faf00');
      assert.equal(cm.colors.ansi[71].css, '#5faf5f');
      assert.equal(cm.colors.ansi[72].css, '#5faf87');
      assert.equal(cm.colors.ansi[73].css, '#5fafaf');
      assert.equal(cm.colors.ansi[74].css, '#5fafd7');
      assert.equal(cm.colors.ansi[75].css, '#5fafff');
      assert.equal(cm.colors.ansi[76].css, '#5fd700');
      assert.equal(cm.colors.ansi[77].css, '#5fd75f');
      assert.equal(cm.colors.ansi[78].css, '#5fd787');
      assert.equal(cm.colors.ansi[79].css, '#5fd7af');
      assert.equal(cm.colors.ansi[80].css, '#5fd7d7');
      assert.equal(cm.colors.ansi[81].css, '#5fd7ff');
      assert.equal(cm.colors.ansi[82].css, '#5fff00');
      assert.equal(cm.colors.ansi[83].css, '#5fff5f');
      assert.equal(cm.colors.ansi[84].css, '#5fff87');
      assert.equal(cm.colors.ansi[85].css, '#5fffaf');
      assert.equal(cm.colors.ansi[86].css, '#5fffd7');
      assert.equal(cm.colors.ansi[87].css, '#5fffff');
      assert.equal(cm.colors.ansi[88].css, '#870000');
      assert.equal(cm.colors.ansi[89].css, '#87005f');
      assert.equal(cm.colors.ansi[90].css, '#870087');
      assert.equal(cm.colors.ansi[91].css, '#8700af');
      assert.equal(cm.colors.ansi[92].css, '#8700d7');
      assert.equal(cm.colors.ansi[93].css, '#8700ff');
      assert.equal(cm.colors.ansi[94].css, '#875f00');
      assert.equal(cm.colors.ansi[95].css, '#875f5f');
      assert.equal(cm.colors.ansi[96].css, '#875f87');
      assert.equal(cm.colors.ansi[97].css, '#875faf');
      assert.equal(cm.colors.ansi[98].css, '#875fd7');
      assert.equal(cm.colors.ansi[99].css, '#875fff');
      assert.equal(cm.colors.ansi[100].css, '#878700');
      assert.equal(cm.colors.ansi[101].css, '#87875f');
      assert.equal(cm.colors.ansi[102].css, '#878787');
      assert.equal(cm.colors.ansi[103].css, '#8787af');
      assert.equal(cm.colors.ansi[104].css, '#8787d7');
      assert.equal(cm.colors.ansi[105].css, '#8787ff');
      assert.equal(cm.colors.ansi[106].css, '#87af00');
      assert.equal(cm.colors.ansi[107].css, '#87af5f');
      assert.equal(cm.colors.ansi[108].css, '#87af87');
      assert.equal(cm.colors.ansi[109].css, '#87afaf');
      assert.equal(cm.colors.ansi[110].css, '#87afd7');
      assert.equal(cm.colors.ansi[111].css, '#87afff');
      assert.equal(cm.colors.ansi[112].css, '#87d700');
      assert.equal(cm.colors.ansi[113].css, '#87d75f');
      assert.equal(cm.colors.ansi[114].css, '#87d787');
      assert.equal(cm.colors.ansi[115].css, '#87d7af');
      assert.equal(cm.colors.ansi[116].css, '#87d7d7');
      assert.equal(cm.colors.ansi[117].css, '#87d7ff');
      assert.equal(cm.colors.ansi[118].css, '#87ff00');
      assert.equal(cm.colors.ansi[119].css, '#87ff5f');
      assert.equal(cm.colors.ansi[120].css, '#87ff87');
      assert.equal(cm.colors.ansi[121].css, '#87ffaf');
      assert.equal(cm.colors.ansi[122].css, '#87ffd7');
      assert.equal(cm.colors.ansi[123].css, '#87ffff');
      assert.equal(cm.colors.ansi[124].css, '#af0000');
      assert.equal(cm.colors.ansi[125].css, '#af005f');
      assert.equal(cm.colors.ansi[126].css, '#af0087');
      assert.equal(cm.colors.ansi[127].css, '#af00af');
      assert.equal(cm.colors.ansi[128].css, '#af00d7');
      assert.equal(cm.colors.ansi[129].css, '#af00ff');
      assert.equal(cm.colors.ansi[130].css, '#af5f00');
      assert.equal(cm.colors.ansi[131].css, '#af5f5f');
      assert.equal(cm.colors.ansi[132].css, '#af5f87');
      assert.equal(cm.colors.ansi[133].css, '#af5faf');
      assert.equal(cm.colors.ansi[134].css, '#af5fd7');
      assert.equal(cm.colors.ansi[135].css, '#af5fff');
      assert.equal(cm.colors.ansi[136].css, '#af8700');
      assert.equal(cm.colors.ansi[137].css, '#af875f');
      assert.equal(cm.colors.ansi[138].css, '#af8787');
      assert.equal(cm.colors.ansi[139].css, '#af87af');
      assert.equal(cm.colors.ansi[140].css, '#af87d7');
      assert.equal(cm.colors.ansi[141].css, '#af87ff');
      assert.equal(cm.colors.ansi[142].css, '#afaf00');
      assert.equal(cm.colors.ansi[143].css, '#afaf5f');
      assert.equal(cm.colors.ansi[144].css, '#afaf87');
      assert.equal(cm.colors.ansi[145].css, '#afafaf');
      assert.equal(cm.colors.ansi[146].css, '#afafd7');
      assert.equal(cm.colors.ansi[147].css, '#afafff');
      assert.equal(cm.colors.ansi[148].css, '#afd700');
      assert.equal(cm.colors.ansi[149].css, '#afd75f');
      assert.equal(cm.colors.ansi[150].css, '#afd787');
      assert.equal(cm.colors.ansi[151].css, '#afd7af');
      assert.equal(cm.colors.ansi[152].css, '#afd7d7');
      assert.equal(cm.colors.ansi[153].css, '#afd7ff');
      assert.equal(cm.colors.ansi[154].css, '#afff00');
      assert.equal(cm.colors.ansi[155].css, '#afff5f');
      assert.equal(cm.colors.ansi[156].css, '#afff87');
      assert.equal(cm.colors.ansi[157].css, '#afffaf');
      assert.equal(cm.colors.ansi[158].css, '#afffd7');
      assert.equal(cm.colors.ansi[159].css, '#afffff');
      assert.equal(cm.colors.ansi[160].css, '#d70000');
      assert.equal(cm.colors.ansi[161].css, '#d7005f');
      assert.equal(cm.colors.ansi[162].css, '#d70087');
      assert.equal(cm.colors.ansi[163].css, '#d700af');
      assert.equal(cm.colors.ansi[164].css, '#d700d7');
      assert.equal(cm.colors.ansi[165].css, '#d700ff');
      assert.equal(cm.colors.ansi[166].css, '#d75f00');
      assert.equal(cm.colors.ansi[167].css, '#d75f5f');
      assert.equal(cm.colors.ansi[168].css, '#d75f87');
      assert.equal(cm.colors.ansi[169].css, '#d75faf');
      assert.equal(cm.colors.ansi[170].css, '#d75fd7');
      assert.equal(cm.colors.ansi[171].css, '#d75fff');
      assert.equal(cm.colors.ansi[172].css, '#d78700');
      assert.equal(cm.colors.ansi[173].css, '#d7875f');
      assert.equal(cm.colors.ansi[174].css, '#d78787');
      assert.equal(cm.colors.ansi[175].css, '#d787af');
      assert.equal(cm.colors.ansi[176].css, '#d787d7');
      assert.equal(cm.colors.ansi[177].css, '#d787ff');
      assert.equal(cm.colors.ansi[178].css, '#d7af00');
      assert.equal(cm.colors.ansi[179].css, '#d7af5f');
      assert.equal(cm.colors.ansi[180].css, '#d7af87');
      assert.equal(cm.colors.ansi[181].css, '#d7afaf');
      assert.equal(cm.colors.ansi[182].css, '#d7afd7');
      assert.equal(cm.colors.ansi[183].css, '#d7afff');
      assert.equal(cm.colors.ansi[184].css, '#d7d700');
      assert.equal(cm.colors.ansi[185].css, '#d7d75f');
      assert.equal(cm.colors.ansi[186].css, '#d7d787');
      assert.equal(cm.colors.ansi[187].css, '#d7d7af');
      assert.equal(cm.colors.ansi[188].css, '#d7d7d7');
      assert.equal(cm.colors.ansi[189].css, '#d7d7ff');
      assert.equal(cm.colors.ansi[190].css, '#d7ff00');
      assert.equal(cm.colors.ansi[191].css, '#d7ff5f');
      assert.equal(cm.colors.ansi[192].css, '#d7ff87');
      assert.equal(cm.colors.ansi[193].css, '#d7ffaf');
      assert.equal(cm.colors.ansi[194].css, '#d7ffd7');
      assert.equal(cm.colors.ansi[195].css, '#d7ffff');
      assert.equal(cm.colors.ansi[196].css, '#ff0000');
      assert.equal(cm.colors.ansi[197].css, '#ff005f');
      assert.equal(cm.colors.ansi[198].css, '#ff0087');
      assert.equal(cm.colors.ansi[199].css, '#ff00af');
      assert.equal(cm.colors.ansi[200].css, '#ff00d7');
      assert.equal(cm.colors.ansi[201].css, '#ff00ff');
      assert.equal(cm.colors.ansi[202].css, '#ff5f00');
      assert.equal(cm.colors.ansi[203].css, '#ff5f5f');
      assert.equal(cm.colors.ansi[204].css, '#ff5f87');
      assert.equal(cm.colors.ansi[205].css, '#ff5faf');
      assert.equal(cm.colors.ansi[206].css, '#ff5fd7');
      assert.equal(cm.colors.ansi[207].css, '#ff5fff');
      assert.equal(cm.colors.ansi[208].css, '#ff8700');
      assert.equal(cm.colors.ansi[209].css, '#ff875f');
      assert.equal(cm.colors.ansi[210].css, '#ff8787');
      assert.equal(cm.colors.ansi[211].css, '#ff87af');
      assert.equal(cm.colors.ansi[212].css, '#ff87d7');
      assert.equal(cm.colors.ansi[213].css, '#ff87ff');
      assert.equal(cm.colors.ansi[214].css, '#ffaf00');
      assert.equal(cm.colors.ansi[215].css, '#ffaf5f');
      assert.equal(cm.colors.ansi[216].css, '#ffaf87');
      assert.equal(cm.colors.ansi[217].css, '#ffafaf');
      assert.equal(cm.colors.ansi[218].css, '#ffafd7');
      assert.equal(cm.colors.ansi[219].css, '#ffafff');
      assert.equal(cm.colors.ansi[220].css, '#ffd700');
      assert.equal(cm.colors.ansi[221].css, '#ffd75f');
      assert.equal(cm.colors.ansi[222].css, '#ffd787');
      assert.equal(cm.colors.ansi[223].css, '#ffd7af');
      assert.equal(cm.colors.ansi[224].css, '#ffd7d7');
      assert.equal(cm.colors.ansi[225].css, '#ffd7ff');
      assert.equal(cm.colors.ansi[226].css, '#ffff00');
      assert.equal(cm.colors.ansi[227].css, '#ffff5f');
      assert.equal(cm.colors.ansi[228].css, '#ffff87');
      assert.equal(cm.colors.ansi[229].css, '#ffffaf');
      assert.equal(cm.colors.ansi[230].css, '#ffffd7');
      assert.equal(cm.colors.ansi[231].css, '#ffffff');
      assert.equal(cm.colors.ansi[232].css, '#080808');
      assert.equal(cm.colors.ansi[233].css, '#121212');
      assert.equal(cm.colors.ansi[234].css, '#1c1c1c');
      assert.equal(cm.colors.ansi[235].css, '#262626');
      assert.equal(cm.colors.ansi[236].css, '#303030');
      assert.equal(cm.colors.ansi[237].css, '#3a3a3a');
      assert.equal(cm.colors.ansi[238].css, '#444444');
      assert.equal(cm.colors.ansi[239].css, '#4e4e4e');
      assert.equal(cm.colors.ansi[240].css, '#585858');
      assert.equal(cm.colors.ansi[241].css, '#626262');
      assert.equal(cm.colors.ansi[242].css, '#6c6c6c');
      assert.equal(cm.colors.ansi[243].css, '#767676');
      assert.equal(cm.colors.ansi[244].css, '#808080');
      assert.equal(cm.colors.ansi[245].css, '#8a8a8a');
      assert.equal(cm.colors.ansi[246].css, '#949494');
      assert.equal(cm.colors.ansi[247].css, '#9e9e9e');
      assert.equal(cm.colors.ansi[248].css, '#a8a8a8');
      assert.equal(cm.colors.ansi[249].css, '#b2b2b2');
      assert.equal(cm.colors.ansi[250].css, '#bcbcbc');
      assert.equal(cm.colors.ansi[251].css, '#c6c6c6');
      assert.equal(cm.colors.ansi[252].css, '#d0d0d0');
      assert.equal(cm.colors.ansi[253].css, '#dadada');
      assert.equal(cm.colors.ansi[254].css, '#e4e4e4');
      assert.equal(cm.colors.ansi[255].css, '#eeeeee');
    });
  });

  describe('setTheme', () => {
    it('should not throw when not setting all colors', () => {
      assert.doesNotThrow(() => {
        cm.setTheme({});
      });
    });

    it('should set a partial set of colors, using the default if not present', () => {
      assert.equal(cm.colors.background.css, '#000000');
      assert.equal(cm.colors.foreground.css, '#ffffff');
      cm.setTheme({
        background: '#FF0000',
        foreground: '#00FF00'
      });
      assert.equal(cm.colors.background.css, '#FF0000');
      assert.equal(cm.colors.foreground.css, '#00FF00');
      cm.setTheme({
        background: '#0000FF'
      });
      assert.equal(cm.colors.background.css, '#0000FF');
      // FG reverts back to default
      assert.equal(cm.colors.foreground.css, '#ffffff');
    });
  });
});
