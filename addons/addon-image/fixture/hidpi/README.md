# HiDPI rendering test fixtures

Used by `ImageRendering.test.ts` and for generating the before/after proof
images for the device-resolution rendering fix.

- **resolution-chart.png** — a multi-frequency checkerboard (six panels, check
  size doubling 3→96px). A lens/resolution test target: fine panels collapse to
  gray when downscaled at CSS resolution but are recovered at device resolution,
  while coarse panels look identical. Generated for this project and dedicated to
  the public domain (CC0).

- **photo.jpg** — a broadband real photograph (asphalt/gravel texture), the kind
  of high-detail content downscaled by `imgcat photo.jpg`. Source: Wikimedia
  Commons, "Asphalt high resolution texture.jpg", public domain
  (https://commons.wikimedia.org/wiki/File:Asphalt_high_resolution_texture.jpg),
  cropped square and downscaled to 800px.
