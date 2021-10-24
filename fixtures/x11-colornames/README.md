### Fixture for 11 color names

`rgb.txt` contains X11's defined color names, copied over from `/etc/X11/rgb.txt` on Ubuntu 18.

Run `create_module.js` to create a TS module containing the color definitions. The script performs these steps:
- extract color definitions from `rgb.txt`
- remove gray definitions (re-added programmatically later)
- create a perfect hash function
- calculate crc10 for basic collision prevention 
- run several collision tests
- compress table and color data
- write data with loading shim to `ColorNames.ts`

The final file is meant to be copied over to `../../src/common/data/`.
