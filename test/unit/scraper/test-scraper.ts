import { assert } from 'chai';
import { SinonSandbox, createSandbox, stub } from 'sinon';
import Scraper from '../../../src/scraper/Scraper';
import PuppeteerClient from '../../../src/browserclient/PuppeteerClient';
import KnexStorage from '../../../src/storage/knex/KnexStorage';
import Project from '../../../src/storage/base/Project';
import KnexProject from '../../../src/storage/knex/KnexProject';

describe('Scraper', () => {
  let sandbox:SinonSandbox;
  let storage;
  let browserClient;
  let scraper:Scraper;

  beforeEach(() => {
    sandbox = createSandbox();
    storage = sandbox.createStubInstance(KnexStorage);
    storage.Project = KnexProject;
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

  it('initProject - return unmodified project', async () => {
    const project = sandbox.createStubInstance(Project);
    const preScrapeProject = await scraper.initProject(project);

    assert.strictEqual(preScrapeProject, project);
  });

  it('initProject - return new project', async () => {
    const expectedProject = {
      url: 'http://a.com/index.html',
      name: 'a.com',
      pluginOpts: [
        { name: 'pluginA' },
      ],
    };

    const saveStub = stub(KnexProject.prototype, 'save');
    const preScrapeProject = await scraper.initProject({
      url: 'http://a.com/index.html',
      scenario: 'static',
      pluginOpts: [ { name: 'pluginA' } ],
    });

    assert.isTrue(saveStub.calledOnce);
    assert.deepEqual(preScrapeProject, expectedProject);
  });
});
