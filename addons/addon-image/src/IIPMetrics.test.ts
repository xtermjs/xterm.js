/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { imageType, IMetrics } from './IIPMetrics';

// fix missing nodejs decl
declare const require: (s: string) => any;
const fs = require('fs');


const TEST_IMAGES: [string, IMetrics][] = [
  ['w3c_home_256.gif', { mime: 'image/gif', width: 72, height: 48 }],
  ['w3c_home_256.jpg', { mime: 'image/jpeg', width: 72, height: 48 }],
  ['w3c_home_256.png', { mime: 'image/png', width: 72, height: 48 }],
  ['w3c_home_2.gif', { mime: 'image/gif', width: 72, height: 48 }],
  ['w3c_home_2.jpg', { mime: 'image/jpeg', width: 72, height: 48 }],
  ['w3c_home_2.png', { mime: 'image/png', width: 72, height: 48 }],
  ['w3c_home_animation.gif', { mime: 'image/gif', width: 72, height: 48 }],
  ['w3c_home.gif', { mime: 'image/gif', width: 72, height: 48 }],
  ['w3c_home_gray.gif', { mime: 'image/gif', width: 72, height: 48 }],
  ['w3c_home_gray.jpg', { mime: 'image/jpeg', width: 72, height: 48 }],
  ['w3c_home_gray.png', { mime: 'image/png', width: 72, height: 48 }],
  ['w3c_home.jpg', { mime: 'image/jpeg', width: 72, height: 48 }],
  ['w3c_home.png', { mime: 'image/png', width: 72, height: 48 }],
  ['spinfox.png', { mime: 'image/png', width: 148, height: 148 }],
  ['iphone_hdr_YES.jpg', { mime: 'image/jpeg', width: 3264, height: 2448 }],
  ['nikon-e950.jpg', { mime: 'image/jpeg', width: 800, height: 600 }],
  ['agfa-makernotes.jpg', { mime: 'image/jpeg', width: 8, height: 8 }],
  ['sony-alpha-6000.jpg', { mime: 'image/jpeg', width: 6000, height: 4000 }]
];


describe('IIPMetrics', () => {
  it('bunch of testimages', () => {
    for (let i = 0; i < TEST_IMAGES.length; ++i) {
      const imageData = fs.readFileSync('./addons/addon-image/fixture/testimages/' + TEST_IMAGES[i][0]);
      assert.deepStrictEqual(imageType(imageData), TEST_IMAGES[i][1]);
    }
  });
});
