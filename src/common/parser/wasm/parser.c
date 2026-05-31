/* Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT */

#include "parser.h"
#include "transition_table.h"
#include <stddef.h>

/* Static transition table is linked at 65536; scratch must sit above it. */
#define MEM_BASE 65536
#define PARSER_TABLE_BYTE_SIZE (PARSER_TABLE_SIZE * sizeof(uint16_t))
#define MEM_STATE (((MEM_BASE + PARSER_TABLE_BYTE_SIZE) + 255u) & ~255u)
/* ParserWasmState is ~2.3KB; keep header and op buffers past it */
#define MEM_HEADER (MEM_STATE + 2048)
#define MEM_KINDS (MEM_HEADER + 64)
#define MEM_STARTS (MEM_KINDS + PARSER_MAX_OPS)
#define MEM_LENGTHS (MEM_STARTS + PARSER_MAX_OPS * 4)
#define MEM_AUX (MEM_LENGTHS + PARSER_MAX_OPS * 4)
#define MEM_PARAM_STARTS (MEM_AUX + PARSER_MAX_OPS * 4)
#define MEM_PARAM_COUNTS (MEM_PARAM_STARTS + PARSER_MAX_OPS * 4)
#define MEM_PARAMS_ARENA (MEM_PARAM_COUNTS + PARSER_MAX_OPS * 2) /* uint16 param counts */
#define MEM_INPUT_BASE (MEM_PARAMS_ARENA + PARSER_MAX_PARAMS * 4)

static ParserWasmState *state(void) { return (ParserWasmState *)(uintptr_t)MEM_STATE; }
static ParserScanHeader *header(void) { return (ParserScanHeader *)(uintptr_t)MEM_HEADER; }
static uint8_t *kinds(void) { return (uint8_t *)(uintptr_t)MEM_KINDS; }
static uint32_t *starts(void) { return (uint32_t *)(uintptr_t)MEM_STARTS; }
static uint32_t *lengths(void) { return (uint32_t *)(uintptr_t)MEM_LENGTHS; }
static uint32_t *aux(void) { return (uint32_t *)(uintptr_t)MEM_AUX; }
static uint32_t *param_starts(void) { return (uint32_t *)(uintptr_t)MEM_PARAM_STARTS; }
static uint16_t *param_counts(void) { return (uint16_t *)(uintptr_t)MEM_PARAM_COUNTS; }
static int32_t *params_arena(void) { return (int32_t *)(uintptr_t)MEM_PARAMS_ARENA; }
static uint32_t *input(void) { return (uint32_t *)(uintptr_t)MEM_INPUT_BASE; }

static uint32_t transition_lookup(uint32_t st, uint32_t code) {
  uint32_t idx = code < PARSER_NON_ASCII_PRINTABLE ? code : PARSER_NON_ASCII_PRINTABLE;
  return PARSER_TRANSITION_TABLE[st << PARSER_TABLE_INDEX_STATE_SHIFT | idx];
}

static void params_reset_zdm(ParserWasmState *s) {
  s->params_len = 1;
  s->subparams_len = 0;
  s->reject_digits = 0;
  s->reject_sub_digits = 0;
  s->digit_is_sub = 0;
  s->subparams_idx[0] = 0;
  s->params[0] = 0;
}

static void params_reset(ParserWasmState *s) {
  s->params_len = 0;
  s->subparams_len = 0;
  s->reject_digits = 0;
  s->reject_sub_digits = 0;
  s->digit_is_sub = 0;
}

static void params_add_param(ParserWasmState *s, int32_t value) {
  s->digit_is_sub = 0;
  if (s->params_len >= PARSER_PARAMS_MAX_LEN) {
    s->reject_digits = 1;
    return;
  }
  s->subparams_idx[s->params_len] = (uint16_t)(s->subparams_len << 8 | s->subparams_len);
  if (value < 0) value = 0;
  if (value > 0x7FFFFFFF) value = 0x7FFFFFFF;
  s->params[s->params_len++] = value;
}

static void params_add_subparam(ParserWasmState *s, int32_t value) {
  s->digit_is_sub = 1;
  if (!s->params_len) return;
  if (s->reject_digits || s->subparams_len >= PARSER_SUBPARAMS_MAX_LEN) {
    s->reject_sub_digits = 1;
    return;
  }
  if (value < 0) value = -1;
  if (value > 0x7FFFFFFF) value = 0x7FFFFFFF;
  s->subparams[s->subparams_len++] = value;
  s->subparams_idx[s->params_len - 1]++;
}

static void params_add_digit(ParserWasmState *s, int32_t digit) {
  uint32_t len;
  if (s->reject_digits) return;
  len = s->digit_is_sub ? s->subparams_len : s->params_len;
  if (!len) return;
  if (s->digit_is_sub && s->reject_sub_digits) return;
  int32_t *store = s->digit_is_sub ? s->subparams : s->params;
  int32_t cur = store[len - 1];
  store[len - 1] = cur >= 0 ? (cur * 10 + digit > 0x7FFFFFFF ? 0x7FFFFFFF : cur * 10 + digit) : digit;
}

static void copy_params_to_arena(uint32_t op_idx, ParserWasmState *s) {
  uint32_t start = header()->params_arena_len;
  param_starts()[op_idx] = start;
  param_counts()[op_idx] = (uint16_t)s->params_len;
  for (uint32_t i = 0; i < s->params_len; i++) {
    if (header()->params_arena_len >= PARSER_MAX_PARAMS) return;
    params_arena()[header()->params_arena_len++] = s->params[i];
    uint16_t idx = s->subparams_idx[i];
    uint32_t sub_start = idx >> 8;
    uint32_t sub_end = idx & 0xFF;
    for (uint32_t k = sub_start; k < sub_end; k++) {
      if (header()->params_arena_len >= PARSER_MAX_PARAMS) return;
      int32_t sv = s->subparams[k];
      uint32_t encoded = 0x80000000u | (uint32_t)(sv < 0 ? 0x7FFFFFFF : sv);
      params_arena()[header()->params_arena_len++] = encoded;
    }
  }
}

static int emit_op(uint8_t kind, uint32_t start, uint32_t length, uint32_t aux_val, ParserWasmState *s) {
  uint32_t idx = header()->op_count;
  if (idx > 0) {
    uint32_t prev = idx - 1;
    if (kind == OP_EXECUTE && kinds()[prev] == OP_EXECUTE && aux()[prev] == aux_val) {
      lengths()[prev]++;
      return (int)prev;
    }
    if (kind == OP_ESC && kinds()[prev] == OP_ESC && aux()[prev] == aux_val) {
      lengths()[prev]++;
      return (int)prev;
    }
  }
  if (idx >= PARSER_MAX_OPS) return -1;
  kinds()[idx] = kind;
  starts()[idx] = start;
  if ((kind == OP_EXECUTE || kind == OP_ESC) && length == 0) {
    lengths()[idx] = 1;
  } else {
    lengths()[idx] = length;
  }
  aux()[idx] = aux_val;
  if (kind == OP_CSI || kind == OP_DCS_HOOK) {
    uint32_t input_pos = start;
    copy_params_to_arena(idx, s);
    lengths()[idx] = input_pos;
    starts()[idx] = param_starts()[idx];
  } else if (kind == OP_ESC) {
    uint32_t input_pos = start;
    uint32_t repeat = lengths()[idx];
    copy_params_to_arena(idx, s);
    starts()[idx] = input_pos;
    lengths()[idx] = repeat;
  } else {
    param_starts()[idx] = 0;
    param_counts()[idx] = 0;
  }
  header()->op_count++;
  return (int)idx;
}

static int is_printable(uint32_t code) {
  return (code >= 0x20 && code <= 0x7e) || code >= PARSER_NON_ASCII_PRINTABLE;
}

__attribute__((export_name("reset")))
void reset(void) {
  ParserWasmState *s = state();
  s->current_state = PARSER_STATE_GROUND;
  s->collect = 0;
  s->preceding_join_state = 0;
  s->osc_start = 0;
  s->dcs_start = 0;
  s->apc_start = 0;
  params_reset_zdm(s);
  header()->op_count = 0;
  header()->input_len = 0;
  header()->params_arena_len = 0;
  header()->scan_offset = 0;
}

__attribute__((export_name("get_input_ptr")))
uint32_t get_input_ptr(void) { return MEM_INPUT_BASE; }

__attribute__((export_name("get_kinds_ptr")))
uint32_t get_kinds_ptr(void) { return MEM_KINDS; }

__attribute__((export_name("get_starts_ptr")))
uint32_t get_starts_ptr(void) { return MEM_STARTS; }

__attribute__((export_name("get_lengths_ptr")))
uint32_t get_lengths_ptr(void) { return MEM_LENGTHS; }

__attribute__((export_name("get_aux_ptr")))
uint32_t get_aux_ptr(void) { return MEM_AUX; }

__attribute__((export_name("get_param_starts_ptr")))
uint32_t get_param_starts_ptr(void) { return MEM_PARAM_STARTS; }

__attribute__((export_name("get_param_counts_ptr")))
uint32_t get_param_counts_ptr(void) { return MEM_PARAM_COUNTS; }

__attribute__((export_name("get_params_ptr")))
uint32_t get_params_ptr(void) { return MEM_PARAMS_ARENA; }

__attribute__((export_name("get_state_ptr")))
uint32_t get_state_ptr(void) { return MEM_STATE; }

__attribute__((export_name("get_header_ptr")))
uint32_t get_header_ptr(void) { return MEM_HEADER; }

__attribute__((export_name("set_state")))
void set_state(uint32_t current_state, uint32_t collect) {
  state()->current_state = current_state;
  state()->collect = collect;
}

__attribute__((export_name("export_params_to")))
void export_params_to(uint32_t dst_ptr, uint32_t max_len) {
  ParserWasmState *s = state();
  int32_t *dst = (int32_t *)(uintptr_t)dst_ptr;
  uint32_t n = s->params_len < max_len ? s->params_len : max_len;
  for (uint32_t i = 0; i < n; i++) {
    dst[i] = s->params[i];
  }
}

__attribute__((export_name("get_params_len")))
uint32_t get_params_len(void) {
  return state()->params_len;
}

__attribute__((export_name("get_subparams_len")))
uint32_t get_subparams_len(void) {
  return state()->subparams_len;
}

__attribute__((export_name("get_subparams_ptr")))
uint32_t get_subparams_ptr(void) {
  return (uint32_t)(uintptr_t)state()->subparams;
}

__attribute__((export_name("get_subparams_idx_ptr")))
uint32_t get_subparams_idx_ptr(void) {
  return (uint32_t)(uintptr_t)state()->subparams_idx;
}

__attribute__((export_name("sync_params_from")))
void sync_params_from(uint32_t src_ptr, uint32_t len) {
  ParserWasmState *s = state();
  const int32_t *src = (const int32_t *)(uintptr_t)src_ptr;
  s->params_len = len > PARSER_PARAMS_MAX_LEN ? PARSER_PARAMS_MAX_LEN : len;
  for (uint32_t i = 0; i < s->params_len; i++) {
    s->params[i] = src[i];
  }
  s->subparams_len = 0;
  s->reject_digits = 0;
  s->reject_sub_digits = 0;
  s->digit_is_sub = 0;
}

__attribute__((export_name("probe_action")))
uint32_t probe_action(uint32_t state_id, uint32_t code) {
  uint32_t tr = transition_lookup(state_id, code);
  return tr >> PARSER_TABLE_ACTION_SHIFT;
}

static int emit_or_stop(uint8_t kind, uint32_t start, uint32_t length, uint32_t aux_val, ParserWasmState *s, uint32_t stop_at) {
  if (emit_op(kind, start, length, aux_val, s) < 0) {
    header()->scan_offset = stop_at;
    return 0;
  }
  return 1;
}

__attribute__((export_name("scan")))
int32_t scan(uint32_t offset, uint32_t length) {
  ParserWasmState *s = state();
  ParserScanHeader *h = header();
  h->op_count = 0;
  h->params_arena_len = 0;
  h->input_len = length;
  uint32_t i = offset;
  uint32_t code;
  uint32_t transition;
  uint32_t action;
  uint32_t print_start;

  while (i < length) {
    code = input()[i];

    if (code < 0x18 && s->current_state <= PARSER_STATE_CSI_PARAM + 2) {
      if (!emit_or_stop(OP_EXECUTE, i, 0, code, s, i)) {
        return h->op_count > 0 ? (int32_t)h->op_count : -1;
      }
      s->preceding_join_state = 0;
      i++;
      continue;
    }

    if (code == 0x1b && s->current_state < PARSER_STATE_OSC_STRING && i + 2 < length && input()[i + 1] == 0x5b) {
      params_reset_zdm(s);
      s->collect = 0;
      uint32_t k = i + 2;
      uint32_t ch = input()[k];
      if (ch >= 0x3c && ch <= 0x3f) {
        s->collect = ch;
        k++;
      }
      int csi_done = 0;
      for (; k < length; k++) {
        ch = input()[k];
        if (ch >= 0x30 && ch <= 0x39) {
          params_add_digit(s, ch - 48);
        } else if (ch == 0x3b) {
          params_add_param(s, 0);
        } else if (ch == 0x3a) {
          params_add_subparam(s, -1);
        } else if (ch >= 0x40 && ch <= 0x7e) {
          uint32_t ident = (s->collect << 8) | ch;
          if (!emit_or_stop(OP_CSI, k, 0, ident, s, k)) {
            return h->op_count > 0 ? (int32_t)h->op_count : -1;
          }
          s->preceding_join_state = 0;
          i = k;
          s->current_state = PARSER_STATE_GROUND;
          csi_done = 1;
          break;
        } else {
          break;
        }
      }
      if (!csi_done) {
        i = k - 1;
        s->current_state = PARSER_STATE_CSI_PARAM;
      }
      i++;
      continue;
    }

    transition = transition_lookup(s->current_state, code);
    action = transition >> PARSER_TABLE_ACTION_SHIFT;
    {
      uint32_t next_state = transition & PARSER_TABLE_STATE_MASK;
      switch (action) {
      case 1: /* ERROR - report state before transition (matches TS parser) */
        if (!emit_or_stop(OP_ERROR, i, 0, (s->current_state << 16) | code, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        s->current_state = next_state;
        break;
      default:
        s->current_state = next_state;
        break;
      }
    }

    switch (action) {
      case PARSER_ACTION_PRINT: {
        print_start = i;
        uint32_t c = i;
        uint32_t l4 = length > 4 ? length - 4 : 0;
        while (c < l4 && is_printable(input()[c]) && is_printable(input()[c + 1]) &&
               is_printable(input()[c + 2]) && is_printable(input()[c + 3])) {
          c += 4;
        }
        while (c < length && is_printable(input()[c])) c++;
        if (!emit_or_stop(OP_PRINT, print_start, c - print_start, 0, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        i = c - 1;
        break;
      }
      case PARSER_ACTION_EXECUTE:
        if (!emit_or_stop(OP_EXECUTE, i, 0, code, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        s->preceding_join_state = 0;
        break;
      case PARSER_ACTION_IGNORE:
        break;
      case 1: /* ERROR - handled above */
        break;
      case PARSER_ACTION_CSI_DISPATCH: {
        uint32_t ident = (s->collect << 8) | code;
        if (!emit_or_stop(OP_CSI, i, 0, ident, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        s->preceding_join_state = 0;
        break;
      }
      case 8: /* PARAM */
        do {
          switch (code) {
            case 0x3b: params_add_param(s, 0); break;
            case 0x3a: params_add_subparam(s, -1); break;
            default: params_add_digit(s, code - 48); break;
          }
        } while (++i < length && (code = input()[i]) > 0x2f && code < 0x3c);
        i--;
        break;
      case 9: /* COLLECT */
        s->collect <<= 8;
        s->collect |= code;
        break;
      case PARSER_ACTION_ESC_DISPATCH: {
        uint32_t ident = (s->collect << 8) | code;
        if (!emit_or_stop(OP_ESC, i, 0, ident, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        s->preceding_join_state = 0;
        break;
      }
      case 11: /* CLEAR */
        params_reset_zdm(s);
        s->collect = 0;
        break;
      case 4: /* OSC_START */
        if (!emit_or_stop(OP_OSC_START, i, 0, 0, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        s->osc_start = i + 1;
        break;
      case 5: /* OSC_PUT */
        for (uint32_t j = i + 1; ; j++) {
          if (j >= length || (code = input()[j]) < 0x20 ||
              (code > 0x7f && code < PARSER_NON_ASCII_PRINTABLE)) {
            if (j > i && !emit_or_stop(OP_OSC_PUT, i, j - i, 0, s, i)) {
              return h->op_count > 0 ? (int32_t)h->op_count : -1;
            }
            i = j - 1;
            break;
          }
        }
        break;
      case PARSER_ACTION_OSC_END: {
        if (!emit_or_stop(OP_OSC_END, i, 0, code, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        s->osc_term = code;
        if (code == 0x1b) s->current_state = PARSER_STATE_ESCAPE;
        params_reset_zdm(s);
        s->collect = 0;
        s->preceding_join_state = 0;
        break;
      }
      case 12: /* DCS_HOOK */
        s->dcs_hook_ident = (s->collect << 8) | code;
        if (!emit_or_stop(OP_DCS_HOOK, i, 0, s->dcs_hook_ident, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        s->dcs_start = i + 1;
        break;
      case 13: /* DCS_PUT */
        for (uint32_t j = i + 1; ; j++) {
          if (j >= length || (code = input()[j]) == 0x18 || code == 0x1a || code == 0x1b ||
              (code > 0x7f && code < PARSER_NON_ASCII_PRINTABLE)) {
            if (j > i && !emit_or_stop(OP_DCS_PUT, i, j - i, 0, s, i)) {
              return h->op_count > 0 ? (int32_t)h->op_count : -1;
            }
            i = j - 1;
            break;
          }
        }
        break;
      case PARSER_ACTION_DCS_UNHOOK: {
        if (!emit_or_stop(OP_DCS_UNHOOK, i, 0, code, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        if (code == 0x1b) s->current_state = PARSER_STATE_ESCAPE;
        params_reset_zdm(s);
        s->collect = 0;
        s->preceding_join_state = 0;
        break;
      }
      case 15: /* APC_START */
        s->apc_hook_ident = (s->collect << 8) | code;
        if (!emit_or_stop(OP_APC_START, i, 0, s->apc_hook_ident, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        s->apc_start = i + 1;
        break;
      case 16: /* APC_PUT */
        for (uint32_t j = i + 1; ; j++) {
          if (j < length && (
            (input()[j] >= 0x20 && input()[j] < 0x7f) ||
            (input()[j] >= 0x08 && input()[j] < 0x0e) ||
            input()[j] >= PARSER_NON_ASCII_PRINTABLE
          )) continue;
          if (j > i && !emit_or_stop(OP_APC_PUT, i, j - i, 0, s, i)) {
            return h->op_count > 0 ? (int32_t)h->op_count : -1;
          }
          i = j - 1;
          break;
        }
        break;
      case PARSER_ACTION_APC_END: {
        if (!emit_or_stop(OP_APC_END, i, 0, code, s, i)) {
          return h->op_count > 0 ? (int32_t)h->op_count : -1;
        }
        if (code == 0x1b) s->current_state = PARSER_STATE_ESCAPE;
        params_reset_zdm(s);
        s->collect = 0;
        s->preceding_join_state = 0;
        break;
      }
      default:
        break;
    }
    i++;
  }
  h->scan_offset = length;
  return (int32_t)h->op_count;
}
