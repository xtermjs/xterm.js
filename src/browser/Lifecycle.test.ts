/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { addDisposableDomListener } from './Lifecycle';
import jsdom = require('jsdom');

describe('addDisposableDomListener', () => {
  const dom = new jsdom.JSDOM();
  const document = dom.window.document;

  function createEvent(type: string): Event {
    const event = document.createEvent('Event');
    event.initEvent(type);
    return event;
  }

  it('dispose', () => {
    let calledTimes = 0;
    const div = document.createElement('div');
    const disposable = addDisposableDomListener(div, 'test', () => { calledTimes++; });

    assert.equal(calledTimes, 0);

    div.dispatchEvent(createEvent('test'));
    assert.equal(calledTimes, 1);

    disposable.dispose();

    div.dispatchEvent(createEvent('test'));
    assert.equal(calledTimes, 1);

    disposable.dispose(); // double disposing

    div.dispatchEvent(createEvent('test'));
    assert.equal(calledTimes, 1);
  });
});
