import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import Scraper from '../../../src/scraper/Scraper';
import Project from '../../../src/storage/base/Project';
import BrowserClient from '../../../src/browserclient/BrowserClient';
import Storage from '../../../src/storage/base/Storage';

describe('Scraper', () => {
  let sandbox:SinonSandbox;
  let storage;
  let browserClient;
  let scraper:Scraper;

  beforeEach(() => {
    sandbox = createSandbox();
    storage = <Storage>{};
    storage.connect = sandbox.stub();
    storage.Project = <Project>{};
    browserClient = <BrowserClient>{};
    browserClient.launch = sandbox.stub();
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

    const saveStub = sandbox.stub();
    storage.Project = sandbox.stub().callsFake(
      () => ({ save: saveStub, ...expectedProject }),
    );

    const preScrapeProject = await scraper.initProject({
      url: 'http://a.com/index.html',
      scenario: 'static',
      pluginOpts: [ { name: 'pluginA' } ],
    });

    assert.isTrue(saveStub.calledOnce);
    assert.deepOwnInclude(preScrapeProject, expectedProject);
  });
});
