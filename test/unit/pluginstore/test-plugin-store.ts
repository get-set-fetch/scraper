import { assert } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import PluginStore from '../../../src/pluginstore/PluginStore';

describe('PluginStore', () => {
  it('add plugin without bundling', async () => {
    const pluginFilepath = join(__dirname, 'input', 'ts', 'Extended.ts');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('Extended');
    assert.isTrue(filepath.endsWith('Extended.ts'));
    assert.isNull(bundle);
    assert.isNotNull(Cls);
  });

  it('add ts plugin with bundling', async () => {
    const pluginFilepath = join(__dirname, 'input', 'ts', 'ExtendedDomRead.ts');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('ExtendedDomRead');
    assert.isTrue(filepath.endsWith('ExtendedDomRead.ts'));
    assert.isNotNull(Cls);

    const compactCode = (code:string) => code.replace(/\s+/g, ' ').replace(/\r\n/g, '\n');
    const expectedBundle = readFileSync(join(__dirname, 'input', 'ts', 'expected-extended-dom-read-bundle.txt'), 'utf8');
    assert.strictEqual(compactCode(bundle), compactCode(expectedBundle));
  });

  it('add js plugin with bundling', async () => {
    const pluginFilepath = join(__dirname, 'input', 'js', 'ExtendedDomRead.js');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('ExtendedDomRead');
    assert.isTrue(filepath.endsWith('ExtendedDomRead.js'));
    assert.isNotNull(Cls);

    const compactCode = (code:string) => code.replace(/\s+/g, ' ').replace(/\r\n/g, '\n');
    const expectedBundle = readFileSync(join(__dirname, 'input', 'js', 'expected-extended-dom-read-bundle.txt'), 'utf8');
    assert.strictEqual(compactCode(bundle), compactCode(expectedBundle));
  });
});
