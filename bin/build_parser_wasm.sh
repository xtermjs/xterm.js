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

# Apple Clang (Xcode CLT) has no wasm32 target; prefer Homebrew LLVM when needed.
wasm_clang_has_target() {
  "$1" --print-targets 2>/dev/null | grep -q 'wasm32'
}

resolve_wasm_toolchain() {
  local clang_bin=clang
  if wasm_clang_has_target clang; then
    :
  else
    local llvm_prefix=""
    if command -v brew >/dev/null 2>&1; then
      llvm_prefix="$(brew --prefix llvm 2>/dev/null || true)"
    fi
    for prefix in "$llvm_prefix" /opt/homebrew/opt/llvm /usr/local/opt/llvm; do
      if [[ -n "$prefix" && -x "$prefix/bin/clang" ]] && wasm_clang_has_target "$prefix/bin/clang"; then
        clang_bin="$prefix/bin/clang"
        local lld_prefix=""
        if command -v brew >/dev/null 2>&1; then
          lld_prefix="$(brew --prefix lld 2>/dev/null || true)"
        fi
        for lld_dir in "$lld_prefix/bin" /opt/homebrew/opt/lld/bin /usr/local/opt/lld/bin; do
          if [[ -n "$lld_dir" && -x "$lld_dir/lld" ]]; then
            PATH="$lld_dir:$(dirname "$clang_bin"):$PATH"
            break
          fi
        done
        PATH="$(dirname "$clang_bin"):$PATH"
        break
      fi
    done
    if ! wasm_clang_has_target "$clang_bin"; then
      echo "error: no clang with wasm32 support found (macOS: brew install llvm lld)" >&2
      exit 1
    fi
  fi
  WASM_CLANG="$clang_bin"
}

resolve_wasm_toolchain

"$WASM_CLANG" --target=wasm32-unknown-unknown -O2 -nostdlib -fuse-ld=lld \
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
