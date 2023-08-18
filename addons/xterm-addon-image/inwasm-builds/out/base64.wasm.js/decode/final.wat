(module
  (type (;0;) (func (result i32)))
  (import "env" "memory" (memory (;0;) 1))
  (func (;0;) (type 0) (result i32)
    (local i32 i32 i32 i32 i32)
    i32.const 5128
    i32.load
    i32.const 5152
    i32.add
    local.set 1
    i32.const 5124
    i32.load
    local.tee 0
    i32.const 5120
    i32.load
    i32.const 1
    i32.sub
    i32.const -4
    i32.and
    local.tee 2
    i32.lt_s
    if  ;; label = @1
      local.get 2
      i32.const 5152
      i32.add
      local.set 3
      local.get 0
      i32.const 5152
      i32.add
      local.set 0
      loop  ;; label = @2
        local.get 0
        i32.load8_u offset=3
        i32.const 2
        i32.shl
        i32.load offset=4096
        local.get 0
        i32.load8_u offset=2
        i32.const 2
        i32.shl
        i32.load offset=3072
        local.get 0
        i32.load8_u offset=1
        i32.const 2
        i32.shl
        i32.load offset=2048
        local.get 0
        i32.load8_u
        i32.const 2
        i32.shl
        i32.load offset=1024
        i32.or
        i32.or
        i32.or
        local.tee 4
        i32.const 16777215
        i32.gt_u
        if  ;; label = @3
          i32.const 1
          return
        end
        local.get 1
        local.get 4
        i32.store
        local.get 1
        i32.const 3
        i32.add
        local.set 1
        local.get 0
        i32.const 4
        i32.add
        local.tee 0
        local.get 3
        i32.lt_u
        br_if 0 (;@2;)
      end
    end
    i32.const 5124
    local.get 2
    i32.store
    i32.const 5128
    local.get 1
    i32.const 5152
    i32.sub
    i32.store
    i32.const 0)
  (func (;1;) (type 0) (result i32)
    (local i32 i32 i32 i32 i32 i32)
    block  ;; label = @1
      i32.const 5120
      i32.load
      local.tee 1
      i32.const 5124
      i32.load
      local.tee 0
      i32.sub
      i32.const 5
      i32.ge_s
      if  ;; label = @2
        i32.const 1
        local.set 3
        call 0
        br_if 1 (;@1;)
        i32.const 5120
        i32.load
        local.set 1
        i32.const 5124
        i32.load
        local.set 0
      end
      i32.const 1
      local.set 3
      local.get 1
      local.get 0
      i32.sub
      local.tee 4
      i32.const 2
      i32.lt_s
      br_if 0 (;@1;)
      local.get 0
      i32.const 5153
      i32.add
      i32.load8_u
      i32.const 2
      i32.shl
      i32.load offset=2048
      local.get 0
      i32.const 5152
      i32.add
      i32.load8_u
      i32.const 2
      i32.shl
      i32.load offset=1024
      i32.or
      local.set 1
      block  ;; label = @2
        local.get 4
        i32.const 2
        i32.eq
        if  ;; label = @3
          i32.const 1
          local.set 2
          br 1 (;@2;)
        end
        i32.const 1
        local.set 2
        local.get 0
        i32.load8_u offset=5154
        local.tee 5
        i32.const 61
        i32.ne
        if  ;; label = @3
          i32.const 2
          local.set 2
          local.get 5
          i32.const 2
          i32.shl
          i32.load offset=3072
          local.get 1
          i32.or
          local.set 1
        end
        local.get 4
        i32.const 4
        i32.ne
        br_if 0 (;@2;)
        local.get 0
        i32.load8_u offset=5155
        local.tee 0
        i32.const 61
        i32.eq
        br_if 0 (;@2;)
        local.get 2
        i32.const 1
        i32.add
        local.set 2
        local.get 0
        i32.const 2
        i32.shl
        i32.load offset=4096
        local.get 1
        i32.or
        local.set 1
      end
      local.get 1
      i32.const 16777215
      i32.gt_u
      br_if 0 (;@1;)
      i32.const 5128
      i32.load
      i32.const 5152
      i32.add
      local.get 1
      i32.store
      i32.const 5128
      i32.const 5128
      i32.load
      local.get 2
      i32.add
      local.tee 0
      i32.store
      local.get 0
      i32.const 5136
      i32.load
      i32.ne
      local.set 3
    end
    local.get 3)
  (export "dec" (func 0))
  (export "end" (func 1)))
