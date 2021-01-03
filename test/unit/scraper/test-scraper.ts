import { assert } from 'chai';
import { SinonSandbox, createSandbox, stub } from 'sinon';
import Scraper from '../../../src/scraper/Scraper';
import PuppeteerClient from '../../../src/browserclient/PuppeteerClient';
import KnexStorage from '../../../src/storage/knex/KnexStorage';
import Site from '../../../src/storage/base/Site';
import KnexSite from '../../../src/storage/knex/KnexSite';

describe('Scraper', () => {
  let sandbox:SinonSandbox;
  let storage;
  let browserClient;
  let scraper:Scraper;

  beforeEach(() => {
    sandbox = createSandbox();
    storage = sandbox.createStubInstance(KnexStorage);
    storage.Site = KnexSite;
    browserClient = sandbox.createStubInstance(PuppeteerClient);
    scraper = new Scraper(storage, browserClient);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('preScrape - do storage.connect', async () => {
    storage.isConnected = false;
    await scraper.preScrape();

    assert.isTrue(storage.connect.calledOnce);
  });

  it('preScrape - skip storage.connect', async () => {
    storage.isConnected = true;
    await scraper.preScrape();

    assert.isTrue(storage.connect.neverCalledWith());
  }); // vladut iepurasul

  it('preScrape - do browserClient.launch', async () => {
    browserClient.isLaunched = false;
    await scraper.preScrape();

    assert.isTrue(browserClient.launch.calledOnce);
  });

  it('preScrape - skip browserClient.launch', async () => {
    browserClient.isLaunched = true;
    await scraper.preScrape();

    assert.isTrue(browserClient.launch.neverCalledWith());
  });

  it('initSite - return unmodified site', async () => {
    const site = sandbox.createStubInstance(Site);
    const preScrapeSite = await scraper.initSite(site);

    assert.strictEqual(preScrapeSite, site);
  });

  it('initSite - return new site', async () => {
    const expectedSite = {
      url: 'http://a.com/index.html',
      name: 'a.com',
      pluginOpts: [
        { name: 'pluginA' },
      ],
    };

    const saveStub = stub(KnexSite.prototype, 'save');
    const preScrapeSite = await scraper.initSite({
      url: 'http://a.com/index.html',
      scenario: 'static',
      pluginOpts: [ { name: 'pluginA' } ],
    });

    assert.isTrue(saveStub.calledOnce);
    assert.deepEqual(preScrapeSite, expectedSite);
  });
});
