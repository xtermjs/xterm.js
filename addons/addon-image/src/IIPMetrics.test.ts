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
  ['w3c_home_256.gif', { mime: 'image/gif', width: 72, height: 48, animated: false }],
  ['w3c_home_256.jpg', { mime: 'image/jpeg', width: 72, height: 48, animated: false }],
  ['w3c_home_256.png', { mime: 'image/png', width: 72, height: 48, animated: false }],
  ['w3c_home_2.gif', { mime: 'image/gif', width: 72, height: 48, animated: false }],
  ['w3c_home_2.jpg', { mime: 'image/jpeg', width: 72, height: 48, animated: false }],
  ['w3c_home_2.png', { mime: 'image/png', width: 72, height: 48, animated: false }],
  ['w3c_home_animation.gif', { mime: 'image/gif', width: 72, height: 48, animated: true }],
  ['w3c_home.gif', { mime: 'image/gif', width: 72, height: 48, animated: false }],
  ['w3c_home_gray.gif', { mime: 'image/gif', width: 72, height: 48, animated: false }],
  ['w3c_home_gray.jpg', { mime: 'image/jpeg', width: 72, height: 48, animated: false }],
  ['w3c_home_gray.png', { mime: 'image/png', width: 72, height: 48, animated: false }],
  ['w3c_home.jpg', { mime: 'image/jpeg', width: 72, height: 48, animated: false }],
  ['w3c_home.png', { mime: 'image/png', width: 72, height: 48, animated: false }],
  ['w3c_home_noexif.jpg', { mime: 'image/jpeg', width: 72, height: 48, animated: false }],
  ['spinfox.png', { mime: 'image/png', width: 148, height: 148, animated: true }],
  ['iphone_hdr_YES.jpg', { mime: 'image/jpeg', width: 3264, height: 2448, animated: false }],
  ['nikon-e950.jpg', { mime: 'image/jpeg', width: 800, height: 600, animated: false }],
  ['agfa-makernotes.jpg', { mime: 'image/jpeg', width: 8, height: 8, animated: false }],
  ['sony-alpha-6000.jpg', { mime: 'image/jpeg', width: 6000, height: 4000, animated: false }],
  ['dice.qoi', { mime: 'image/qoi', width: 800, height: 600, animated: false }],
  // VP8
  ['1.webp', { mime: 'image/webp', width: 550, height: 368, animated: false }],
  ['2.webp', { mime: 'image/webp', width: 550, height: 404, animated: false }],
  ['3.webp', { mime: 'image/webp', width: 1280, height: 720, animated: false }],
  ['4.webp', { mime: 'image/webp', width: 1024, height: 772, animated: false }],
  ['5.webp', { mime: 'image/webp', width: 1024, height: 752, animated: false }],
  // VP8X
  ['1_webp_a.webp', { mime: 'image/webp', width: 400, height: 301, animated: false }],
  ['2_webp_a.webp', { mime: 'image/webp', width: 386, height: 395, animated: false }],
  ['3_webp_a.webp', { mime: 'image/webp', width: 800, height: 600, animated: false }],
  ['4_webp_a.webp', { mime: 'image/webp', width: 421, height: 163, animated: false }],
  ['5_webp_a.webp', { mime: 'image/webp', width: 300, height: 300, animated: false }],
  // VP8L
  ['1_webp_ll.webp', { mime: 'image/webp', width: 400, height: 301, animated: false }],
  ['2_webp_ll.webp', { mime: 'image/webp', width: 386, height: 395, animated: false }],
  ['3_webp_ll.webp', { mime: 'image/webp', width: 800, height: 600, animated: false }],
  ['4_webp_ll.webp', { mime: 'image/webp', width: 421, height: 163, animated: false }],
  ['5_webp_ll.webp', { mime: 'image/webp', width: 300, height: 300, animated: false }],
  // some AVIF test images
  ['fox.profile2.12bpc.yuv444.odd-width.odd-height.avif', { mime: 'image/avif', width: 1203, height: 799, animated: false }],
  ['hato.profile0.8bpc.yuv420.avif', { mime: 'image/avif', width: 3082, height: 2048, animated: false }],
  ['kimono.crop.avif', { mime: 'image/avif', width: 722, height: 1024, animated: false }],
];


describe('IIPMetrics', () => {
  it('bunch of testimages', () => {
    for (let i = 0; i < TEST_IMAGES.length; ++i) {
      const imageData = fs.readFileSync('./addons/addon-image/fixture/testimages/' + TEST_IMAGES[i][0]);
      assert.deepStrictEqual(imageType(imageData), TEST_IMAGES[i][1]);
    }
  });
});
