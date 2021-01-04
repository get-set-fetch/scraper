import { assert } from 'chai';
import { stub } from 'sinon';
import FetchPlugin from '../../../src/plugins/default/FetchPlugin';
import Resource from '../../../src/storage/base/Resource';
import Site from '../../../src/storage/base/Site';

describe('FetchPlugin', () => {
  let plugin: FetchPlugin;
  const site:Site = <Site>{ resourceCount: 0 };

  it('test conditions', () => {
    plugin = new FetchPlugin();
    assert.isFalse(plugin.test(site, <Resource>{ contentType: 'text/html' }));
    assert.isFalse(plugin.test(site, null));
    assert.isFalse(plugin.test(site, <Resource>{}));
    assert.isTrue(plugin.test(site, <Resource>{ url: 'http://a.com' }));
  });

  it('getExtension', () => {
    plugin = new FetchPlugin();

    assert.isNull(plugin.getExtension('http://www.a.com/dirA'));
    assert.strictEqual(plugin.getExtension('http://www.a.com/a.html?param'), 'html');
    assert.strictEqual(plugin.getExtension('http://www.a.com/a.php'), 'php');
  });

  it('isHtml', async () => {
    plugin = new FetchPlugin();

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
    plugin = new FetchPlugin();
    assert.isFalse(plugin.isCorsActive('http://sitea.com/index.html', 'http://sitea.com/imgA.png'));
    assert.isTrue(plugin.isCorsActive('http://sitea.com/index.html', 'http://img.sitea.com/imgA.png'));
  });// te iubesc
});
