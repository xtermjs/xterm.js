/* Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
#ifndef PARSER_WASM_H
#define PARSER_WASM_H

#include <stdint.h>

#define PARSER_NON_ASCII_PRINTABLE 0xA0
#define PARSER_TABLE_ACTION_SHIFT 8
#define PARSER_TABLE_STATE_MASK 255
#define PARSER_TABLE_INDEX_STATE_SHIFT 8

#define OP_PRINT 0
#define OP_EXECUTE 1
#define OP_ESC 2
#define OP_CSI 3
#define OP_OSC 4
#define OP_DCS 5
#define OP_APC 6
#define OP_DCS_HOOK 7
#define OP_DCS_PUT 8
#define OP_DCS_UNHOOK 9
#define OP_OSC_START 10
#define OP_OSC_PUT 11
#define OP_OSC_END 12
#define OP_APC_START 13
#define OP_APC_PUT 14
#define OP_APC_END 15
#define OP_ERROR 16

#define PARSER_STATE_GROUND 0
#define PARSER_STATE_ESCAPE 1
#define PARSER_STATE_OSC_STRING 8
#define PARSER_STATE_DCS_PASSTHROUGH 13
#define PARSER_STATE_APC_PASSTHROUGH 16
#define PARSER_STATE_CSI_PARAM 4

#define PARSER_ACTION_IGNORE 0
#define PARSER_ACTION_PRINT 2
#define PARSER_ACTION_EXECUTE 3
#define PARSER_ACTION_CSI_DISPATCH 7
#define PARSER_ACTION_ESC_DISPATCH 10
#define PARSER_ACTION_OSC_END 6
#define PARSER_ACTION_DCS_UNHOOK 14
#define PARSER_ACTION_APC_END 17

#define PARSER_MAX_OPS 4096
#define PARSER_MAX_PARAMS 4096
#define PARSER_PARAMS_MAX_LEN 32
#define PARSER_SUBPARAMS_MAX_LEN 256

typedef struct {
  uint32_t current_state;
  uint32_t collect;
  uint32_t preceding_join_state;
  int32_t params[PARSER_PARAMS_MAX_LEN];
  uint32_t params_len;
  int32_t subparams[PARSER_SUBPARAMS_MAX_LEN];
  uint32_t subparams_len;
  uint16_t subparams_idx[PARSER_PARAMS_MAX_LEN];
  uint32_t reject_digits;
  uint32_t reject_sub_digits;
  uint32_t digit_is_sub;
  uint32_t osc_start;
  uint32_t dcs_start;
  uint32_t apc_start;
  uint32_t dcs_hook_ident;
  uint32_t apc_hook_ident;
  uint32_t osc_term;
} ParserWasmState;

typedef struct {
  uint32_t op_count;
  uint32_t input_len;
  uint32_t params_arena_len;
  uint32_t scan_offset;
} ParserScanHeader;

#endif
