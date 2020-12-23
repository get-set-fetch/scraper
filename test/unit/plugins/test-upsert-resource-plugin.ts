import { assert } from 'chai';
import UpsertResourcePlugin from '../../../src/plugins/default/UpsertResourcePlugin';
import Resource from '../../../src/storage/base/Resource';

describe('UpsertResourcePlugin', () => {
  let plugin: UpsertResourcePlugin;
  const site:any = { resourceCount: 0 };

  it('test conditions', () => {
    plugin = new UpsertResourcePlugin();
    assert.isFalse(plugin.test(site, null));
    assert.isTrue(plugin.test(site, <Resource>{}));
  });
});
