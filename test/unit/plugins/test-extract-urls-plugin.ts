import { assert } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import ExtractUrlsPlugin from '../../../src/plugins/default/ExtractUrlsPlugin';
import Resource from '../../../src/storage/base/Resource';
import Site from '../../../src/storage/base/Site';

describe('ExtractUrlsPlugin', () => {
  let sandbox:SinonSandbox;
  let stubQuerySelectorAll;
  let plugin: ExtractUrlsPlugin;
  const site:Site = <Site>{ resourceCount: 0 };

  beforeEach(() => {
    sandbox = createSandbox();
    stubQuerySelectorAll = sandbox.stub(document, 'querySelectorAll');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('test conditions', () => {
    plugin = new ExtractUrlsPlugin({ selectorPairs: [] });
    assert.isFalse(plugin.test(site, null));
    assert.isTrue(plugin.test(site, <Resource>{ contentType: 'text/html' }));
    assert.isFalse(plugin.test(site, <Resource>{ contentType: 'text/plain' }));
  });

  it('extract unique urls - default options', () => {
    plugin = new ExtractUrlsPlugin();

    stubQuerySelectorAll.withArgs('a[href$=".html"]').returns([
      { href: 'http://sitea.com/page1.html', innerText: 'page1' },
      { href: 'http://sitea.com/page1.html#fragment1', innerText: 'page1' },
      { href: 'http://sitea.com/page1.html#fragment2', innerText: 'page1' },
      { href: 'http://sitea.com/page1.html', innerText: 'page1' },
    ]);

    const expectedValidUrls = [
      {
        url: 'http://sitea.com/page1.html',
        parent: {
          linkText: 'page1',
        },
      },
    ];
    // eslint-disable-next-line prefer-spread
    const { resourcesToAdd } = plugin.apply(site, <Resource>{ url: 'http://sitea.com/index.html', depth: 1 });
    assert.sameDeepMembers(resourcesToAdd, expectedValidUrls);
  });

  it('extract unique urls - include images', () => {
    plugin = new ExtractUrlsPlugin({ selectorPairs: [ { urlSelector: 'a' }, { urlSelector: 'img' } ] });

    stubQuerySelectorAll.withArgs('a').returns([
      { href: 'http://sitea.com/page1.html', innerText: 'page1' },
      { href: 'http://sitea.com/page1.html', innerText: 'page1' },
    ]);

    stubQuerySelectorAll.withArgs('img').returns([
      { src: 'http://sitea.com/img1.png', alt: 'img1' },
      { src: 'http://sitea.com/img1.png', alt: 'img1' },
    ]);

    const expectedValidUrls = [
      {
        url: 'http://sitea.com/page1.html',
        parent: {
          linkText: 'page1',
        },
      },
      {
        url: 'http://sitea.com/img1.png',
        parent: {
          imgAlt: 'img1',
        },
      },
    ];
    // eslint-disable-next-line prefer-spread
    const { resourcesToAdd } = plugin.apply(site, <Resource>{ url: 'http://sitea.com/index.html', depth: 1 });
    assert.sameDeepMembers(resourcesToAdd, expectedValidUrls);
  });

  it('extract unique urls - include title selector', () => {
    plugin = new ExtractUrlsPlugin({ selectorPairs: [ { urlSelector: 'a', titleSelector: 'h1.title' } ] });

    stubQuerySelectorAll.withArgs('a').returns([
      { href: 'http://sitea.com/page1.html', innerText: 'export' },
      { href: 'http://sitea.com/page2.html', innerText: 'export' },
    ]);

    stubQuerySelectorAll.withArgs('h1.title').returns([
      { innerText: 'page1 title' },
      { innerText: 'page2 title' },
    ]);

    const expectedValidUrls = [
      {
        url: 'http://sitea.com/page1.html',
        parent: {
          linkText: 'export',
          title: 'page1 title',
        },
      },
      {
        url: 'http://sitea.com/page2.html',
        parent: {
          linkText: 'export',
          title: 'page2 title',
        },
      },
    ];
    // eslint-disable-next-line prefer-spread
    const { resourcesToAdd } = plugin.apply(site, <Resource>{ url: 'http://sitea.com/index.html', depth: 1 });
    assert.sameDeepMembers(resourcesToAdd, expectedValidUrls);
  });

  it('extract based on selectors returning empty result', () => {
    plugin = new ExtractUrlsPlugin({ selectorPairs: [ { urlSelector: 'a#id1' } ] });

    stubQuerySelectorAll.withArgs('a#id1').returns([]);

    const expectedValidUrls = [];
    // eslint-disable-next-line prefer-spread
    const { resourcesToAdd } = plugin.apply(site, <Resource>{ url: 'http://sitea.com/index.html', depth: 1 });
    assert.sameDeepMembers(resourcesToAdd, expectedValidUrls);
  });

  it('extract unique urls, cumulative apply', () => {
    plugin = new ExtractUrlsPlugin({ selectorPairs: [ { urlSelector: 'a' }, { urlSelector: 'img' } ] });

    // 1st apply
    stubQuerySelectorAll.withArgs('a').returns([
      { href: 'http://sitea.com/page1.html', innerText: 'page1' },
      { href: 'http://sitea.com/page1.html', innerText: 'page1' },
    ]);

    stubQuerySelectorAll.withArgs('img').returns([
      { src: 'http://sitea.com/img1.png', alt: 'img1' },
      { src: 'http://sitea.com/img1.png', alt: 'img1' },
    ]);

    let expectedValidUrls = [
      {
        url: 'http://sitea.com/page1.html',
        parent: {
          linkText: 'page1',
        },
      },
      {
        url: 'http://sitea.com/img1.png',
        parent: {
          imgAlt: 'img1',
        },
      },
    ];

    let { resourcesToAdd } = plugin.apply(site, <Resource>{ url: 'http://sitea.com/index.html', depth: 1 });
    assert.sameDeepMembers(resourcesToAdd, expectedValidUrls);

    // 2nd apply
    stubQuerySelectorAll.withArgs('a').returns([
      { href: 'http://sitea.com/page1.html', innerText: 'page1' },
      { href: 'http://sitea.com/page1.html', innerText: 'page1' },
      { href: 'http://sitea.com/page2.html', innerText: 'page2' },
      { href: 'http://sitea.com/page2.html', innerText: 'page2' },
    ]);

    stubQuerySelectorAll.withArgs('img').returns([
      { src: 'http://sitea.com/img1.png', alt: 'img1' },
      { src: 'http://sitea.com/img1.png', alt: 'img1' },
      { src: 'http://sitea.com/img2.png', alt: 'img2' },
      { src: 'http://sitea.com/img2.png', alt: 'img2' },
    ]);

    expectedValidUrls = [
      {
        url: 'http://sitea.com/page2.html',
        parent: {
          linkText: 'page2',
        },
      },
      {
        url: 'http://sitea.com/img2.png',
        parent: {
          imgAlt: 'img2',
        },
      },
    ];

    ({ resourcesToAdd } = plugin.apply(site, <Resource>{ url: 'http://sitea.com/index.html', depth: 1 }));
    assert.sameDeepMembers(resourcesToAdd, expectedValidUrls);
  });
});
