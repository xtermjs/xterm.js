#!/usr/bin/env bash
# Copyright (c) 2026 The xterm.js authors. All rights reserved.
# @license MIT
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f src/common/parser/wasm/transition_table.h ]]; then
  npm run build
  node bin/gen_parser_transition_table.mjs
fi

WASM_DIR=src/common/parser/wasm
OUT="$WASM_DIR/parser.wasm"

clang --target=wasm32-unknown-unknown -O2 -nostdlib -fuse-ld=lld \
  -Wl,--no-entry \
  -Wl,--export-memory \
  -Wl,--export=reset \
  -Wl,--export=scan \
  -Wl,--export=probe_action \
  -Wl,--export=set_state \
  -Wl,--export=sync_params_from \
  -Wl,--export=export_params_to \
  -Wl,--export=get_params_len \
  -Wl,--export=get_subparams_len \
  -Wl,--export=get_subparams_ptr \
  -Wl,--export=get_subparams_idx_ptr \
  -Wl,--export=get_input_ptr \
  -Wl,--export=get_kinds_ptr \
  -Wl,--export=get_starts_ptr \
  -Wl,--export=get_lengths_ptr \
  -Wl,--export=get_aux_ptr \
  -Wl,--export=get_param_starts_ptr \
  -Wl,--export=get_param_counts_ptr \
  -Wl,--export=get_params_ptr \
  -Wl,--export=get_state_ptr \
  -Wl,--export=get_header_ptr \
  -Wl,--initial-memory=67108864 \
  -Wl,--max-memory=67108864 \
  "$WASM_DIR/parser.c" -o "$OUT"

node bin/embed_parser_wasm.mjs

echo "Built $OUT"
