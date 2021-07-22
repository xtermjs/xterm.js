/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { clone } from 'common/Clone';

describe('clone', () => {
  it('should clone simple objects', () => {
    const test = {
      a: 1,
      b: 2
    };

    assert.deepEqual(clone(test), { a: 1, b: 2 });
  });

  it('should clone nested objects', () => {
    const test = {
      bar: {
        a: 1,
        b: 2,
        c: {
          foo: 'bar'
        }
      }
    };

    assert.deepEqual(clone(test), {
      bar: {
        a: 1,
        b: 2,
        c: {
          foo: 'bar'
        }
      }
    });
  });

  it('should clone array values', () => {
    const test = {
      a: [1, 2, 3],
      b: [1, null, 'test', { foo: 'bar' }]
    };

    assert.deepEqual(clone(test), {
      a: [1, 2, 3],
      b: [1, null, 'test', { foo: 'bar' }]
    });
  });

  it('should stop mutation from occuring on the original object', () => {
    const test = {
      a: 1,
      b: 2,
      c: {
        foo: 'bar'
      }
    };

    const cloned = clone(test);

    test.a = 5;
    test.c.foo = 'barbaz';

    assert.deepEqual(cloned, {
      a: 1,
      b: 2,
      c: {
        foo: 'bar'
      }
    });
  });

  it('should clone to a maximum depth of 5 by default', () => {
    const test = {
      a: {
        b: {
          c: {
            d: {
              e: {
                f: 'foo'
              }
            }
          }
        }
      }
    };

    const cloned = clone(test);

    test.a.b.c.d.e.f = 'bar';

    // The values at a greater depth then 5 should not be cloned
    assert.equal((cloned as any).a.b.c.d.e.f, 'bar');
  });

  it('should allow an optional maximum depth to be set', () => {
    const test = {
      a: {
        b: {
          c: 'foo'
        }
      }
    };

    const cloned = clone(test, 2);

    test.a.b.c = 'bar';

    // The values at a greater depth then 2 should not be cloned
    assert.equal((cloned as any).a.b.c, 'bar');
  });

  it('should not throw when cloning a recursive reference', () => {
    const test = {
      a: {
        b: {
          c: {}
        }
      }
    };

    test.a.b.c = test;

    assert.doesNotThrow(() => clone(test));
  });
});
