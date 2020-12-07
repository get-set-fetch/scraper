import { assert } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import PluginStore from '../../../src/pluginstore/PluginStore';

describe('PluginStore', () => {
  it('add plugin without bundling', async () => {
    const pluginFilepath = join(__dirname, 'input', 'Extended.ts');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('Extended');
    assert.isTrue(filepath.endsWith('Extended.ts'));
    assert.isNull(bundle);
    assert.isNotNull(Cls);
  });

  it('add plugin with bundling', async () => {
    const pluginFilepath = join(__dirname, 'input', 'ExtendedDomRead.ts');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('ExtendedDomRead');
    assert.isTrue(filepath.endsWith('ExtendedDomRead.ts'));
    assert.isNotNull(Cls);

    const compactCode = (code:string) => code.replace(/\s+/g, ' ').replace(/\r\n/g, '\n');
    const expectedBundle = readFileSync(join(__dirname, 'expected-extended-dom-read-bundle.txt'), 'utf8');
    assert.strictEqual(compactCode(bundle), compactCode(expectedBundle));
  });
});
