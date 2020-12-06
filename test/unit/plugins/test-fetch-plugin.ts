import { assert } from 'chai';
import FetchPlugin from '../../../src/plugins/default/FetchPlugin';
import Resource from '../../../src/storage/base/Resource';

describe('FetchPlugin', () => {
  let plugin: FetchPlugin;
  const site:any = { resourceCount: 0 };

  it('test conditions', () => {
    plugin = new FetchPlugin();
    assert.isFalse(plugin.test(site, <Resource>{ contentType: 'text/html' }));
    assert.isFalse(plugin.test(site, null));
    assert.isFalse(plugin.test(site, <Resource>{}));
    assert.isTrue(plugin.test(site, <Resource>{ url: 'http://a.com' }));
  });

  it('probableHtmlMimeType', () => {
    plugin = new FetchPlugin();

    assert.isTrue(plugin.probableHtmlMimeType('http://www.a.com/dirA'));
    assert.isTrue(plugin.probableHtmlMimeType('http://www.a.com/a.html?param'));
    assert.isTrue(plugin.probableHtmlMimeType('http://www.a.com/a.htm'));
    assert.isTrue(plugin.probableHtmlMimeType('http://www.a.com/a.php4?param'));

    assert.isFalse(plugin.probableHtmlMimeType('http://www.a.com/a.png'));
  });
});
