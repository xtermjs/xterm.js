/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */


/**
 * Trying to shape a better image protocol -- This is still WIP!
 *
 * Image protocol:
 *
 * Image Upload and Draw
 * OSC 5000 ; dx ; dy ; dw ; dh ; id ; mode ; format ; size ; payload ST
 *
 *  dx      optional    col to start drawing.
 *                      default: current cursor position                          # FIXME: How to go about ZDM here?
 *                      0 or out of range: store only (eligible with proper id)
 *
 *  dy      optional    row to start drawing.
 *                      default: current cursor position
 *                      0 or out of range: store only (eligible with proper id)
 *
 *  dw      mandatory   Width of the image in number of cells.
 *                      The image gets rescaled / aligned to the cells based on mode.
 *
 *  dh      mandatory   Height of the image in number of cells.
 *                      The image gets rescaled / aligned to the cells based on mode.
 *
 *  id      optional    Image reference for storing and later using (in HEX up to 8 characters).
 *                      Reusing an id deletes the previous image.
 *                      A sequence with id but no payload releases the reference on purpose.
 *                      At least one image up to the full cols * rows viewport size shall be storable.
 *                      Eviction of images happens always in FIFO manner, released references
 *                      are shown with a suitable placeholder taking the same cell coverage.
 *                      A reference is tagged to the current screen buffer, thus shall only be valid
 *                      during one buffer session. A buffer switch always releases all references and
 *                      memory of stored images (full reset, also done RIS and DECSTR).
 *
 * mode     optional    Limited image processing modes:
 *                      0 - pixel perfect all centered (offset floored) with cuts on all borders (default)
 *                      1 - pixel perfect top/left aligned with cuts at bottom/right
 *                      2 - pixel perfect top/centered with cuts at left/right/bottom
 *                      3 - pixel perfect top/right aligned with cuts at bottom/left
 *                      4 - pixel perfect centered/right aligned with cuts at bottom/left/top
 *                      5 - pixel perfect bottom/right aligned with cuts at top/left
 *                      6 - pixel perfect bottom/centered with cuts at left/top/right
 *                      7 - pixel perfect bottom/left aligned with cuts at top/right
 *                      8 - pixel perfect centered/left aligned with cuts at top/right/bottom
 *                      9 - rescale ignoring the aspect ratio
 *                      10 - rescale respecting the aspect ratio, centered
 *                      11 - rescale respecting the aspect ratio, top/left aligned
 *                      12 - rescale respecting the aspect ratio, bottom/right aligned
 *
 *                      On upload the terminal does a simple image transformation to fit the image
 *                      in the cell area given by w x h. The mode can specify how to deal with images,
 *                      that naturally do not fit into this area. To get an image fitting perfectly,
 *                      the pixel dimensions of the image must be in line with the pixel dimensions of
 *                      of the requested drawing area. It is the application's responsibility to ask for
 *                      valid pixel dimensions beforehand (like `CSI 14 t` or an appropriate ioctl).
 *
 * format   optional    Basic formats:
 *                      0 - PNG (default)
 *                      2 - JPEG
 *
 *                      Formats not understood should be skipped during image transformation,
 *                      but the requested drawing area should still be reserved / marked with a placeholder.
 *                      Additional formats might be added over time with a consensus of the terminal-wg.
 *
 * size     optional    Size of encoded payload in bytes. If the amount in payload exceeds the sequence shall
 *                      fail silently without creating a reference. The drawing should still be applied with a placeholder.
 *                      A terminal further might impose restrictions to the maximum allowed size.
 *
 * payload  optional    BASE64 encoded image bytes. Might be empty in conjunction with empty size
 *                      to delete a certain image reference.
 *
 *
 * Image Draw from Reference
 * CSI id ; sx ; sy ; dx ; dy ; w ; h ???
 *
 *  id      mandatory   Identifier of previously uploaded image.
 *                      Draws a placeholder if left empty or pointing to an invalid / already released reference.
 *  sx      optional    Row on the image to start reading (cropping start). Defaults to 1.
 *  sy      optional    Column on the image to start reading (cropping start). Defaults to 1.
 *  dx      optional    Column to start drawing in the terminal.
 *                      empty or 0: current cursor position
 *  dy      optional    Row to start drawing in the terminal.
 *                      empty or 0: current cursor position
 *  w       mandatory   Width to be cropped in number of cells.
 *  h       mandatory   Height to be cropped in number of cells.
 *
 * Note:  This sequence never fails. For illegal parameters (invalid or released reference, out of bounds cropping)
 *        the terminal shall reserve the appropriate amount of cells on the output buffer as if the cropping
 *        would have succeeded, but show a placeholder.
 *
 *
 * Problems to solve:
 * - Where should images be drawn in terms of BG/FG layering?
 * - How to deal with transparency? And in relation to FG/BG content?
 * - How to deal with a rectangular area vs. reflowing in terminals? Other col/row affecting sequences?
 * - Cursor movements?
 */

