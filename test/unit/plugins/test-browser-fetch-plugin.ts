import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import BrowserFetchPlugin from '../../../src/plugins/default/BrowserFetchPlugin';
import Resource from '../../../src/storage/base/Resource';
import Project from '../../../src/storage/base/Project';
import { FetchError } from '../../../src/plugins/default/BaseFetchPlugin';
import { DomStabilityStatus } from '../../../src/plugins/dom-utils';

describe('BrowserFetchPlugin', () => {
  let sandbox:SinonSandbox;
  let plugin: BrowserFetchPlugin = new BrowserFetchPlugin();
  const project:Project = <Project>{ resourceCount: 0 };

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('test conditions', () => {
    plugin = new BrowserFetchPlugin();
    assert.isFalse(plugin.test(project, <Resource>{ contentType: 'text/html' }));
    assert.isFalse(plugin.test(project, null));
    assert.isFalse(plugin.test(project, <Resource>{}));
    assert.isTrue(plugin.test(project, <Resource>{ url: 'http://a.com' }));
  });

  it('getExtension', () => {
    assert.isNull(plugin.getExtension('http://www.a.com/dirA'));
    assert.strictEqual(plugin.getExtension('http://www.a.com/a.html?param'), 'html');
    assert.strictEqual(plugin.getExtension('http://www.a.com/a.php'), 'php');
  });

  it('isHtml', async () => {
    sandbox.stub(plugin, 'fetch')
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
    assert.isFalse(plugin.isCorsActive('http://sitea.com/index.html', 'http://sitea.com/imgA.png'));
    assert.isTrue(plugin.isCorsActive('http://sitea.com/index.html', 'http://img.sitea.com/imgA.png'));
  });// te iubesc

  it('openInTab - invalid status', async () => {
    const client = {
      goto: sandbox.stub().returns({
        status: () => 404,
        request: () => null,
      }),
      getRedirectResponse: sandbox.stub().returns(null),
    };

    let err;
    try {
      await plugin.openInTab(<Resource>{ url: 'http://www.a.com/a.html' }, <any>client);
    }
    catch (e) {
      err = e;
    }

    assert.isTrue(err instanceof FetchError);
    assert.strictEqual(err.status, 404);
  });

  it('openInTab - dom unstable', async () => {
    plugin = new BrowserFetchPlugin({ stabilityCheck: 100, stabilityTimeout: 200 });

    const client = {
      goto: sandbox.stub().returns({
        status: () => 201,
        request: () => null,
      }),
      getRedirectResponse: sandbox.stub().returns(null),
      evaluate: sandbox.stub()
        // client.evaluate(() => document.contentType);
        .onCall(0)
        .returns('text/html')

        // client.evaluate(waitForDomStability,
        .onCall(1)
        .returns(DomStabilityStatus.Unstable),
    };

    let err;
    try {
      await plugin.openInTab(<Resource>{ url: 'http://www.a.com/a.html' }, <any>client);
    }
    catch (e) {
      err = e;
    }

    assert.isTrue(/DOM not stable/.test(err));
  });

  it('openInTab - no redirect', async () => {
    const client = {
      goto: sandbox.stub().returns({
        status: () => 201,
        request: () => null,
      }),
      getRedirectResponse: sandbox.stub().returns(null),
      evaluate: sandbox.stub()
        // client.evaluate(() => document.contentType);
        .onCall(0)
        .returns('text/html'),
    };

    const result:Partial<Resource> = await plugin.openInTab(<Resource>{ url: 'http://www.a.com/a.html' }, <any>client);
    assert.deepEqual({ status: 201, contentType: 'text/html' }, result);
  });

  it('openInTab - redirect', async () => {
    const client = {
      goto: sandbox.stub().returns({
        status: () => 201,
        request: () => null,
        url: () => 'http://www.a.com/a-after-redirect.html',
      }),
      getRedirectResponse: sandbox.stub().returns({
        url: () => 'http://www.a.com/a.html',
        status: () => 301,
      }),
      evaluate: sandbox.stub()
        // client.evaluate(() => document.contentType);
        .onCall(0)
        .returns('text/html'),
    };

    let err;
    try {
      await plugin.openInTab(<Resource>{ url: 'http://www.a.com/a.html' }, <any>client);
    }
    catch (e) {
      err = e;
    }
    assert.deepInclude(
      {
        status: 301,
        redirectUrl: 'http://www.a.com/a-after-redirect.html',
      },
      err,
    );

    const result:Partial<Resource> = await plugin.apply(<any>{}, <Resource>{ url: 'http://www.a.com/a.html' }, <any>client);
    assert.deepEqual(
      {
        status: 301,
        resourcesToAdd: [ { url: 'http://www.a.com/a-after-redirect.html' } ],
      },
      result,
    );
  });
});
