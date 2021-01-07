import { assert } from 'chai';
import SelectResourcePlugin from '../../../src/plugins/default/SelectResourcePlugin';
import Resource from '../../../src/storage/base/Resource';

describe('SelectResourcePlugin', () => {
  let plugin: SelectResourcePlugin;
  const project:any = { resourceCount: 0 };

  it('test conditions', () => {
    plugin = new SelectResourcePlugin();
    assert.isFalse(plugin.test(project, <Resource>{}));
    assert.isTrue(plugin.test(project, null));
  });
});
