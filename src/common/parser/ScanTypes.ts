/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export const Op = {
  Print: 0,
  Execute: 1,
  Esc: 2,
  Csi: 3,
  Osc: 4,
  Dcs: 5,
  Apc: 6,
  DcsHook: 7,
  DcsPut: 8,
  DcsUnhook: 9,
  OscStart: 10,
  OscPut: 11,
  OscEnd: 12,
  ApcStart: 13,
  ApcPut: 14,
  ApcEnd: 15,
  Error: 16
} as const;

export type OpKind = typeof Op[keyof typeof Op];

export type ScanResult = {
  kinds: Uint8Array;
  starts: Uint32Array;
  lengths: Uint32Array;
  aux: Uint32Array;
  params: Uint32Array;
  paramStarts: Uint32Array;
  paramCounts: Uint16Array;
  opCount: number;
};
