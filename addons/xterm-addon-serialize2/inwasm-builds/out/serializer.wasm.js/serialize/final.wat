(module
  (type (;0;) (func (param i32 i32) (result i32)))
  (type (;1;) (func (param i32 i32 i32) (result i32)))
  (type (;2;) (func (param i32 i32 i32 i32)))
  (import "env" "load_link" (func (;0;) (type 0)))
  (import "env" "single_combined" (func (;1;) (type 0)))
  (import "env" "memory" (memory (;0;) 1))
  (func (;2;) (type 0) (param i32 i32) (result i32)
    (local i32 i32)
    local.get 0
    i32.const 9
    i32.le_u
    if  ;; label = @1
      local.get 1
      local.get 0
      i32.const 48
      i32.add
      i32.store16
      local.get 1
      i32.const 2
      i32.add
      return
    end
    local.get 0
    i32.const 99
    i32.le_u
    if  ;; label = @1
      local.get 1
      local.get 0
      i32.const 2
      i32.shl
      i32.const 256
      i32.add
      i32.load
      i32.store
      local.get 1
      i32.const 4
      i32.add
      return
    end
    local.get 0
    i32.const 999
    i32.le_u
    if  ;; label = @1
      local.get 1
      local.get 0
      i32.const 100
      i32.div_u
      local.tee 2
      i32.const 48
      i32.add
      i32.store16
      local.get 1
      local.get 2
      i32.const -100
      i32.mul
      local.get 0
      i32.add
      i32.const 2
      i32.shl
      i32.const 256
      i32.add
      i32.load
      i32.store offset=2
      local.get 1
      i32.const 6
      i32.add
      return
    end
    local.get 0
    i32.const 9999
    i32.le_u
    if  ;; label = @1
      local.get 1
      local.get 0
      i32.const 100
      i32.div_u
      local.tee 2
      i32.const 2
      i32.shl
      i32.const 256
      i32.add
      i32.load
      i32.store
      local.get 1
      local.get 2
      i32.const -100
      i32.mul
      local.get 0
      i32.add
      i32.const 2
      i32.shl
      i32.const 256
      i32.add
      i32.load
      i32.store offset=4
      local.get 1
      i32.const 8
      i32.add
      return
    end
    local.get 1
    local.get 0
    local.get 0
    i32.const 10000
    i32.div_u
    local.tee 0
    i32.const -10000
    i32.mul
    i32.add
    i32.const 65535
    i32.and
    local.tee 2
    i32.const 100
    i32.div_u
    local.tee 3
    i32.const 2
    i32.shl
    i32.const 256
    i32.add
    i32.load
    i32.store offset=2
    local.get 1
    local.get 0
    i32.const 48
    i32.or
    i32.store16
    local.get 1
    local.get 3
    i32.const -100
    i32.mul
    local.get 2
    i32.add
    i32.const 2
    i32.shl
    i32.const 256
    i32.add
    i32.load
    i32.store offset=6
    local.get 1
    i32.const 10
    i32.add)
  (func (;3;) (type 1) (param i32 i32 i32) (result i32)
    (local i64 i32)
    block  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          local.get 1
          i32.const 50331648
          i32.and
          local.tee 4
          i32.const 33554432
          i32.ne
          if  ;; label = @4
            local.get 4
            i32.const 16777216
            i32.ne
            if  ;; label = @5
              local.get 4
              br_if 2 (;@3;)
              local.get 0
              local.get 2
              i64.extend_i32_u
              i64.const 255
              i64.and
              i64.const 253406806016
              i64.or
              i64.store
              br 4 (;@1;)
            end
            local.get 1
            i32.const 7
            i32.and
            i32.const 48
            i32.or
            i64.extend_i32_u
            local.set 3
            local.get 1
            i32.const 8
            i32.and
            if  ;; label = @5
              block  ;; label = @6
                block  ;; label = @7
                  local.get 2
                  i32.const 51
                  i32.sub
                  br_table 0 (;@7;) 1 (;@6;) 5 (;@2;)
                end
                local.get 0
                local.get 3
                i64.const 16
                i64.shl
                i64.const 253403070521
                i64.or
                i64.store
                br 5 (;@1;)
              end
              local.get 0
              local.get 3
              i64.const 32
              i64.shl
              i64.const 16607023629074481
              i64.or
              i64.store
              local.get 0
              i32.const 8
              i32.add
              return
            end
            local.get 0
            local.get 2
            i64.extend_i32_u
            i64.const 255
            i64.and
            local.get 3
            i64.const 16
            i64.shl
            i64.or
            i64.const 253403070464
            i64.or
            i64.store
            br 3 (;@1;)
          end
          local.get 0
          i64.const 16607251263062072
          i64.store offset=2
          local.get 0
          local.get 2
          i32.const 255
          i32.and
          i32.store16
          local.get 1
          i32.const 255
          i32.and
          local.get 0
          i32.const 10
          i32.add
          call 2
          local.tee 0
          i32.const 59
          i32.store16
          local.get 0
          i32.const 2
          i32.add
          return
        end
        local.get 0
        i64.const 16607238378160184
        i64.store offset=2
        local.get 0
        local.get 2
        i32.const 255
        i32.and
        i32.store16
        local.get 1
        i32.const 16
        i32.shr_u
        i32.const 255
        i32.and
        local.get 0
        i32.const 10
        i32.add
        call 2
        local.tee 0
        i32.const 59
        i32.store16
        local.get 1
        i32.const 65280
        i32.and
        i32.const 8
        i32.shr_u
        local.get 0
        i32.const 2
        i32.add
        call 2
        local.tee 0
        i32.const 59
        i32.store16
        local.get 1
        i32.const 255
        i32.and
        local.get 0
        i32.const 2
        i32.add
        call 2
        local.tee 0
        i32.const 59
        i32.store16
        local.get 0
        i32.const 2
        i32.add
        local.set 0
      end
      local.get 0
      return
    end
    local.get 0
    i32.const 6
    i32.add)
  (func (;4;) (type 2) (param i32 i32 i32 i32)
    i32.const 4
    local.get 1
    i32.store
    i32.const 0
    local.get 0
    i32.store
    i32.const 8
    local.get 2
    i32.store
    i32.const 12
    local.get 3
    i32.store)
  (func (;5;) (type 1) (param i32 i32 i32) (result i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      local.get 1
      i32.const 0
      i32.le_s
      br_if 0 (;@1;)
      i32.const 4
      i32.load
      local.set 12
      loop  ;; label = @2
        local.get 0
        local.get 9
        i32.const 12
        i32.mul
        i32.add
        local.tee 3
        i32.load offset=8
        local.tee 6
        i32.const -268435457
        i32.and
        local.set 14
        local.get 9
        i32.const 2
        i32.shl
        i32.const 16384
        i32.add
        i32.load
        local.set 10
        local.get 3
        i32.load
        local.set 7
        i32.const 8
        i32.load
        local.set 13
        i32.const 4
        i32.load
        local.set 11
        block  ;; label = @3
          block  ;; label = @4
            local.get 3
            i32.load offset=4
            local.tee 5
            i32.const 0
            i32.load
            local.tee 8
            i32.ne
            br_if 0 (;@4;)
            local.get 11
            local.get 14
            i32.ne
            br_if 0 (;@4;)
            local.get 10
            local.get 13
            i32.ne
            br_if 0 (;@4;)
            local.get 2
            local.set 3
            br 1 (;@3;)
          end
          local.get 4
          if  ;; label = @4
            local.get 11
            local.get 12
            i32.ne
            if  ;; label = @5
              local.get 2
              i32.const 5963803
              i32.store
              local.get 4
              i32.const 65535
              i32.and
              local.get 2
              i32.const 4
              i32.add
              call 2
              local.tee 2
              i32.const 88
              i32.store16
              local.get 2
              i32.const 2
              i32.add
              local.set 2
            end
            local.get 2
            i32.const 5963803
            i32.store
            local.get 4
            i32.const 65535
            i32.and
            local.get 2
            i32.const 4
            i32.add
            call 2
            local.tee 2
            i32.const 67
            i32.store16
            i32.const 8
            i32.load
            local.set 13
            i32.const 4
            i32.load
            local.set 11
            i32.const 0
            i32.load
            local.set 8
            local.get 2
            i32.const 2
            i32.add
            local.set 2
          end
          local.get 2
          i32.const 5963803
          i32.store
          block  ;; label = @4
            local.get 5
            local.get 6
            i32.or
            i32.eqz
            if  ;; label = @5
              local.get 2
              i32.const 59
              i32.store16 offset=4
              local.get 2
              i32.const 6
              i32.add
              local.set 3
              br 1 (;@4;)
            end
            local.get 2
            i32.const 4
            i32.add
            local.set 3
            block  ;; label = @5
              local.get 5
              local.get 8
              i32.xor
              local.tee 4
              i32.const 67108864
              i32.lt_u
              br_if 0 (;@5;)
              block  ;; label = @6
                local.get 4
                i32.const 67108864
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 5
                i32.const 67108864
                i32.and
                if  ;; label = @7
                  local.get 2
                  i32.const 3866679
                  i32.store offset=4
                  local.get 2
                  i32.const 8
                  i32.add
                  local.set 3
                  br 1 (;@6;)
                end
                local.get 2
                i64.const 253406674994
                i64.store offset=4
                local.get 2
                i32.const 10
                i32.add
                local.set 3
              end
              block  ;; label = @6
                local.get 4
                i32.const 134217728
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 5
                i32.const 134217728
                i32.and
                if  ;; label = @7
                  local.get 3
                  i32.const 3866673
                  i32.store
                  local.get 3
                  i32.const 4
                  i32.add
                  local.set 3
                  br 1 (;@6;)
                end
                local.get 3
                i64.const 253406347314
                i64.store
                local.get 3
                i32.const 6
                i32.add
                local.set 3
              end
              block  ;; label = @6
                local.get 4
                i32.const 536870912
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 5
                i32.const 536870912
                i32.and
                if  ;; label = @7
                  local.get 3
                  i32.const 3866677
                  i32.store
                  local.get 3
                  i32.const 4
                  i32.add
                  local.set 3
                  br 1 (;@6;)
                end
                local.get 3
                i64.const 253406543922
                i64.store
                local.get 3
                i32.const 6
                i32.add
                local.set 3
              end
              block  ;; label = @6
                local.get 4
                i32.const 1073741824
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 5
                i32.const 1073741824
                i32.and
                if  ;; label = @7
                  local.get 3
                  i32.const 3866680
                  i32.store
                  local.get 3
                  i32.const 4
                  i32.add
                  local.set 3
                  br 1 (;@6;)
                end
                local.get 3
                i64.const 253406740530
                i64.store
                local.get 3
                i32.const 6
                i32.add
                local.set 3
              end
              local.get 4
              i32.const 0
              i32.ge_s
              br_if 0 (;@5;)
              local.get 5
              i32.const 0
              i32.lt_s
              if  ;; label = @6
                local.get 3
                i32.const 3866681
                i32.store
                local.get 3
                i32.const 4
                i32.add
                local.set 3
                br 1 (;@5;)
              end
              local.get 3
              i64.const 253406806066
              i64.store
              local.get 3
              i32.const 6
              i32.add
              local.set 3
            end
            local.get 4
            i32.const 67108863
            i32.and
            if  ;; label = @5
              local.get 3
              local.get 5
              i32.const 51
              call 3
              local.set 3
            end
            block  ;; label = @5
              local.get 6
              local.get 11
              i32.xor
              local.tee 2
              i32.const 67108864
              i32.lt_u
              br_if 0 (;@5;)
              block  ;; label = @6
                local.get 2
                i32.const 67108864
                i32.and
                i32.eqz
                br_if 0 (;@6;)
                local.get 6
                i32.const 67108864
                i32.and
                if  ;; label = @7
                  local.get 3
                  i32.const 3866675
                  i32.store
                  local.get 3
                  i32.const 4
                  i32.add
                  local.set 3
                  br 1 (;@6;)
                end
                local.get 3
                i64.const 253403070515
                i64.store
                local.get 3
                i32.const 6
                i32.add
                local.set 3
              end
              local.get 2
              i32.const 134217728
              i32.and
              i32.eqz
              br_if 0 (;@5;)
              local.get 6
              i32.const 134217728
              i32.and
              if  ;; label = @6
                local.get 3
                i32.const 3866674
                i32.store
                local.get 3
                i32.const 4
                i32.add
                local.set 3
                br 1 (;@5;)
              end
              local.get 3
              i64.const 253403070514
              i64.store
              local.get 3
              i32.const 6
              i32.add
              local.set 3
            end
            local.get 2
            i32.const 67108863
            i32.and
            if  ;; label = @5
              local.get 3
              local.get 6
              i32.const 52
              call 3
              local.set 3
            end
            local.get 6
            i32.const 268435456
            i32.and
            i32.eqz
            br_if 0 (;@4;)
            local.get 10
            local.get 13
            i32.xor
            local.tee 2
            i32.const 469762048
            i32.and
            if  ;; label = @5
              local.get 3
              i32.const 59
              i32.store16 offset=6
              local.get 3
              i32.const 3801140
              i32.store align=2
              local.get 3
              local.get 10
              i32.const 26
              i32.shr_u
              i32.const 7
              i32.and
              i32.const 48
              i32.or
              i32.store16 offset=4
              local.get 3
              i32.const 8
              i32.add
              local.set 3
            end
            local.get 2
            i32.const 67108863
            i32.and
            i32.eqz
            br_if 0 (;@4;)
            local.get 3
            local.get 10
            i32.const 53
            call 3
            local.set 3
          end
          i32.const 0
          local.set 4
          i32.const 0
          local.get 5
          i32.store
          i32.const 4
          local.get 14
          i32.store
          i32.const 8
          local.get 10
          i32.store
          local.get 3
          i32.const 2
          i32.sub
          i32.const 109
          i32.store16
        end
        block  ;; label = @3
          local.get 1
          local.get 9
          i32.add
          i32.const 2
          i32.shl
          i32.const 16384
          i32.add
          i32.load
          local.tee 8
          i32.const 12
          i32.load
          local.tee 2
          i32.eq
          if  ;; label = @4
            local.get 3
            local.set 2
            br 1 (;@3;)
          end
          local.get 2
          if  ;; label = @4
            local.get 3
            i32.const 458811
            i32.store offset=8
            local.get 3
            i64.const 16607264150192155
            i64.store
            local.get 3
            i32.const 12
            i32.add
            local.set 3
          end
          block (result i32)  ;; label = @4
            block  ;; label = @5
              local.get 6
              i32.const 268435456
              i32.and
              i32.eqz
              br_if 0 (;@5;)
              local.get 8
              i32.eqz
              br_if 0 (;@5;)
              local.get 3
              local.get 8
              call 0
              br 1 (;@4;)
            end
            i32.const 0
            local.set 8
            local.get 3
          end
          local.set 2
          i32.const 12
          local.get 8
          i32.store
        end
        block (result i32)  ;; label = @3
          local.get 7
          i32.const 4194303
          i32.and
          if  ;; label = @4
            local.get 4
            if  ;; label = @5
              local.get 12
              i32.const 4
              i32.load
              i32.ne
              if  ;; label = @6
                local.get 2
                i32.const 5963803
                i32.store
                local.get 4
                i32.const 65535
                i32.and
                local.get 2
                i32.const 4
                i32.add
                call 2
                local.tee 2
                i32.const 88
                i32.store16
                local.get 2
                i32.const 2
                i32.add
                local.set 2
              end
              local.get 2
              i32.const 5963803
              i32.store
              local.get 4
              i32.const 65535
              i32.and
              local.get 2
              i32.const 4
              i32.add
              call 2
              local.tee 2
              i32.const 67
              i32.store16
              local.get 2
              i32.const 2
              i32.add
              local.set 2
            end
            local.get 7
            i32.const 2097152
            i32.and
            if  ;; label = @5
              local.get 2
              local.get 9
              call 1
              local.set 2
              i32.const 0
              br 2 (;@3;)
            end
            block (result i32)  ;; label = @5
              local.get 7
              i32.const 2097151
              i32.and
              local.tee 4
              i32.const 65536
              i32.ge_u
              if  ;; label = @6
                local.get 2
                local.get 7
                i32.const 1023
                i32.and
                i32.const 56320
                i32.or
                i32.store16 offset=2
                local.get 4
                i32.const 67043328
                i32.add
                i32.const 10
                i32.shr_u
                i32.const 10240
                i32.sub
                local.set 4
                local.get 2
                i32.const 2
                i32.add
                br 1 (;@5;)
              end
              local.get 7
              local.set 4
              local.get 2
            end
            local.get 2
            local.get 4
            i32.store16
            i32.const 2
            i32.add
            local.set 2
            i32.const 0
            br 1 (;@3;)
          end
          local.get 4
          i32.const 1
          i32.add
        end
        local.set 4
        i32.const 1
        local.get 7
        i32.const 22
        i32.shr_u
        local.get 7
        i32.const 4194304
        i32.lt_u
        select
        local.get 9
        i32.add
        local.tee 9
        local.get 1
        i32.lt_s
        br_if 0 (;@2;)
      end
      local.get 4
      i32.eqz
      br_if 0 (;@1;)
      i32.const 4
      i32.load
      local.get 12
      i32.eq
      br_if 0 (;@1;)
      local.get 2
      i32.const 5963803
      i32.store
      local.get 4
      i32.const 65535
      i32.and
      local.get 2
      i32.const 4
      i32.add
      call 2
      local.tee 0
      i32.const 88
      i32.store16
      local.get 0
      i32.const 2
      i32.add
      local.set 2
    end
    local.get 2)
  (export "reset" (func 4))
  (export "line16" (func 5))
  (data (;0;) (i32.const 0) "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"))
