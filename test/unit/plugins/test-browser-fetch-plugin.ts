import { assert } from 'chai';
import { stub } from 'sinon';
import BrowserFetchPlugin from '../../../src/plugins/default/BrowserFetchPlugin';
import Resource from '../../../src/storage/base/Resource';
import Project from '../../../src/storage/base/Project';

describe('BrowserFetchPlugin', () => {
  let plugin: BrowserFetchPlugin;
  const project:Project = <Project>{ resourceCount: 0 };

  it('test conditions', () => {
    plugin = new BrowserFetchPlugin();
    assert.isFalse(plugin.test(project, <Resource>{ contentType: 'text/html' }));
    assert.isFalse(plugin.test(project, null));
    assert.isFalse(plugin.test(project, <Resource>{}));
    assert.isTrue(plugin.test(project, <Resource>{ url: 'http://a.com' }));
  });

  it('getExtension', () => {
    plugin = new BrowserFetchPlugin();

    assert.isNull(plugin.getExtension('http://www.a.com/dirA'));
    assert.strictEqual(plugin.getExtension('http://www.a.com/a.html?param'), 'html');
    assert.strictEqual(plugin.getExtension('http://www.a.com/a.php'), 'php');
  });

  it('isHtml', async () => {
    plugin = new BrowserFetchPlugin();

    stub(plugin, 'fetch')
      .onCall(0)
      .returns(Promise.resolve({ contentType: 'text/html' }))
      .onCall(1)
      .returns(Promise.resolve({ contentType: 'application/pdf' }));

    assert.isTrue(await plugin.isHtml(<Resource>{ url: 'http://www.a.com/a.html' }, null));
    assert.isTrue(await plugin.isHtml(<Resource>{ url: 'http://www.a.com/a.html?param' }, null));
    assert.isFalse(await plugin.isHtml(<Resource>{ url: 'http://www.a.com/a.png' }, null));
    assert.isTrue(await plugin.isHtml(<Resource>{ url: 'http://www.a.com/a' }, null));
    assert.isFalse(await plugin.isHtml(<Resource>{ url: 'http://www.a.com/a' }, null));
  });

  it('isCorsActive', () => {
    plugin = new BrowserFetchPlugin();
    assert.isFalse(plugin.isCorsActive('http://sitea.com/index.html', 'http://sitea.com/imgA.png'));
    assert.isTrue(plugin.isCorsActive('http://sitea.com/index.html', 'http://img.sitea.com/imgA.png'));
  });// te iubesc
});
