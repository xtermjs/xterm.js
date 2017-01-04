import { assert } from 'chai';
import { DomElementObjectPool } from './DomElementObjectPool';

class MockDocument {
  private _attr: {[key: string]: string} = {};
  constructor() {}
  public getAttribute(key: string): string { return this._attr[key]; };
  public setAttribute(key: string, value: string): void { this._attr[key] = value; }
}

describe('DomElementObjectPool', () => {
  let pool: DomElementObjectPool;

  beforeEach(() => {
    pool = new DomElementObjectPool('span');
    (<any>global).document = {
      createElement: () => new MockDocument()
    };
  });

  it('should acquire distinct elements', () => {
    const element1 = pool.acquire();
    const element2 = pool.acquire();
    assert.notEqual(element1, element2);
  });

  it('should acquire released elements', () => {
    const element = pool.acquire();
    pool.release(element);
    assert.equal(pool.acquire(), element);
  });

  it('should handle a series of acquisitions and releases', () => {
    const element1 = pool.acquire();
    const element2 = pool.acquire();
    pool.release(element1);
    assert.equal(pool.acquire(), element1);
    pool.release(element1);
    pool.release(element2);
    assert.equal(pool.acquire(), element2);
    assert.equal(pool.acquire(), element1);
  });

  it('should throw when releasing an element that was not acquired', () => {
    assert.throws(() => pool.release(document.createElement('span')));
  });
});
