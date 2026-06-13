/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { AttributeData } from '../primitives/buffer/AttributeData';
import { BufferService } from './BufferService';
import { OptionsService } from './OptionsService';
import { OscLinkService } from './OscLinkService';
import { IBufferService, IOptionsService, IOscLinkService } from './Services';
import { MockLogService } from '../TestUtils.test';

describe('OscLinkService', () => {
  describe('constructor', () => {
    let bufferService: IBufferService;
    let optionsService: IOptionsService;
    let oscLinkService: IOscLinkService;
    beforeEach(() => {
      optionsService = new OptionsService({ rows: 3, cols: 10 });
      bufferService = new BufferService(optionsService, new MockLogService());
      oscLinkService = new OscLinkService(bufferService);
    });

    it('link IDs are created and fetched consistently', () => {
      const linkId = oscLinkService.registerLink({ id: 'foo', uri: 'bar' });
      assert.ok(linkId);
      assert.equal(oscLinkService.registerLink({ id: 'foo', uri: 'bar' }), linkId);
    });

    it('should dispose the link ID when the last marker is trimmed from the buffer', () => {
      // Activate the alt buffer to get 0 scrollback
      bufferService.buffers.activateAltBuffer();
      const linkId = oscLinkService.registerLink({ id: 'foo', uri: 'bar' });
      assert.ok(linkId);
      bufferService.scroll(new AttributeData());
      assert.notStrictEqual(oscLinkService.registerLink({ id: 'foo', uri: 'bar' }), linkId);
    });

    it('should fetch link data from link id', () => {
      const linkId = oscLinkService.registerLink({ id: 'foo', uri: 'bar' });
      assert.deepStrictEqual(oscLinkService.getLinkData(linkId), { id: 'foo', uri: 'bar' });
    });
  });
});
