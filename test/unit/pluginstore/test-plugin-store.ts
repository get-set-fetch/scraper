import { assert } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import PluginStore from '../../../src/pluginstore/PluginStore';

describe('PluginStore', () => {
  it('add esm ts plugin without bundling', async () => {
    const pluginFilepath = join(__dirname, 'input-esm-ts', 'Extended.ts');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('Extended');
    assert.isTrue(filepath.endsWith('Extended.ts'));
    assert.isNull(bundle);
    assert.isNotNull(Cls);
  });

  it('add cjs js plugin without bundling', async () => {
    const pluginFilepath = join(__dirname, 'input-cjs-js', 'Extended.js');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('Extended');
    assert.isTrue(filepath.endsWith('Extended.js'));
    assert.isNull(bundle);
    assert.isNotNull(Cls);
  });

  it('add esm-ts plugin containing node_modules dependencies with bundling', async () => {
    const pluginFilepath = join(__dirname, 'input-esm-ts', 'ExtendedDomRead.ts');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('ExtendedDomRead');
    assert.isTrue(filepath.endsWith('ExtendedDomRead.ts'));
    assert.isNotNull(Cls);

    const compactCode = (code:string) => code.replace(/\s+/g, ' ').replace(/\r\n/g, '\n');
    const expectedBundle = readFileSync(join(__dirname, 'input-esm-ts', 'expected-extended-dom-read-bundle.txt'), 'utf8');
    assert.strictEqual(compactCode(bundle), compactCode(expectedBundle));
  });

  it('add cjs-js plugin containing node_modules dependencies with bundling', async () => {
    const pluginFilepath = join(__dirname, 'input-cjs-js', 'ExtendedDomRead.js');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('ExtendedDomRead');
    assert.isTrue(filepath.endsWith('ExtendedDomRead.js'));
    assert.isNotNull(Cls);

    const compactCode = (code:string) => code.replace(/\s+/g, ' ').replace(/\r\n/g, '\n');
    const expectedBundle = readFileSync(join(__dirname, 'input-cjs-js', 'expected-extended-dom-read-bundle.txt'), 'utf8');
    assert.strictEqual(compactCode(bundle), compactCode(expectedBundle));
  });

  it('add esm-js plugin containing node_modules dependencies with bundling', async () => {
    const pluginFilepath = join(__dirname, 'input-esm-js', 'ExtendedDomRead.js');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('ExtendedDomRead');
    assert.isTrue(filepath.endsWith('ExtendedDomRead.js'));
    assert.isNotNull(Cls);

    const compactCode = (code:string) => code.replace(/\s+/g, ' ').replace(/\r\n/g, '\n');
    const expectedBundle = readFileSync(join(__dirname, 'input-esm-js', 'expected-extended-dom-read-bundle.txt'), 'utf8');
    assert.strictEqual(compactCode(bundle), compactCode(expectedBundle));
  });

  it('add mixed esm-cjs-ts-js plugin containing node_modules dependencies with bundling', async () => {
    const pluginFilepath = join(__dirname, 'input-mixed-esm-cjs-ts-js', 'ExtendedDomRead.ts');

    await PluginStore.add(pluginFilepath);

    const { filepath, bundle, Cls } = PluginStore.get('ExtendedDomRead');
    assert.isTrue(filepath.endsWith('ExtendedDomRead.ts'));
    assert.isNotNull(Cls);

    const compactCode = (code:string) => code.replace(/\s+/g, ' ').replace(/\r\n/g, '\n');
    const expectedBundle = readFileSync(join(__dirname, 'input-mixed-esm-cjs-ts-js', 'expected-extended-dom-read-bundle.txt'), 'utf8');
    assert.strictEqual(compactCode(bundle), compactCode(expectedBundle));
  });
});
