import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import Scraper from '../../../src/scraper/Scraper';
import Project from '../../../src/storage/base/Project';
import BrowserClient from '../../../src/browserclient/BrowserClient';
import Storage from '../../../src/storage/base/Storage';
import ScrapeEvent from '../../../src/scraper/ScrapeEvents';

describe('Scraper', () => {
  let sandbox:SinonSandbox;
  let storage;
  let browserClient;
  let scraper:Scraper;

  const checkEntity = (reject : (err) => void, actual, expected) => {
    try {
      assert.strictEqual(actual, expected);
    }
    catch (err) {
      reject(err);
    }
  };

  beforeEach(() => {
    sandbox = createSandbox();
    storage = <Storage>{};
    storage.connect = sandbox.stub();
    storage.Project = <Project>{};
    browserClient = <BrowserClient>{};
    browserClient.launch = sandbox.stub();
    scraper = new Scraper(storage, browserClient);
    scraper.browserClient = browserClient;
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
    scraper.browserClient.isLaunched = false;
    await scraper.preScrape();

    assert.isTrue(browserClient.launch.calledOnce);
  });

  it('preScrape - skip browserClient.launch', async () => {
    browserClient.isLaunched = true;
    await scraper.preScrape();

    assert.isTrue(browserClient.launch.neverCalledWith());
  });

  it('preScrape - concurrency using browser clients - condition not supported', async () => {
    let err;

    try {
      await scraper.preScrape({ domain: { maxRequests: 2, delay: 2000 } });
    }
    catch (e) {
      err = e;
    }

    assert.isTrue(/maxRequests is not supported/.test(err));
  });

  it('preScrape - concurrency using browser clients - condition supported', async () => {
    let err;

    try {
      await scraper.preScrape({ domain: { delay: 2000 } });
    }
    catch (e) {
      err = e;
    }

    assert.isUndefined(err);
  });

  it('preScrape - concurrency using dom clients - all conditions supported', async () => {
    let err;

    try {
      scraper.browserClient = null;
      await scraper.preScrape({ domain: { maxRequests: 2, delay: 2000 } });
    }
    catch (e) {
      err = e;
    }

    assert.isUndefined(err);
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
    storage.Project.get = sandbox.stub();

    const preScrapeProject = await scraper.initProject({
      url: 'http://a.com/index.html',
      scenario: 'browser-static-content',
      pluginOpts: [ { name: 'ExtractUrlsPlugin' } ],
    });

    assert.isTrue(saveStub.calledOnce);
    assert.deepOwnInclude(preScrapeProject, expectedProject);
  });

  it('scrape - emit events - happy path', async () => {
    const resource = {
      url: 'http://siteA.com/resource.html',
      update: sandbox.stub(),
    };
    const project = Object.assign(sandbox.createStubInstance(Project), {
      pluginOpts: [],
      initPlugins: () => [],
      getResourceToScrape: sandbox.stub()
        .onCall(0)
        .returns(resource)
        .onCall(1)
        .returns(null),
    });

    const scrapeComplete = new Promise<void>(resolve => {
      scraper.on(ScrapeEvent.ProjectScraped, () => {
        resolve();
      });
    });

    const eventChain: ScrapeEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      scraper.on(ScrapeEvent.ProjectSelected, eventProject => {
        checkEntity(reject, eventProject, project);
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ProjectScraped, eventProject => {
        checkEntity(reject, eventProject, project);
        eventChain.push(ScrapeEvent.ProjectScraped);
        resolve();
      });
      scraper.on(ScrapeEvent.ResourceSelected, (eventProject, eventResource) => {
        checkEntity(reject, eventProject, project);
        checkEntity(reject, eventResource, resource);
        eventChain.push(ScrapeEvent.ResourceSelected);
      });
      scraper.on(ScrapeEvent.ResourceScraped, (eventProject, eventResource) => {
        checkEntity(reject, eventProject, project);
        checkEntity(reject, eventResource, resource);
        eventChain.push(ScrapeEvent.ResourceScraped);
      });

      scraper.scrape(project);
    });

    assert.sameOrderedMembers(
      [ ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScraped, ScrapeEvent.ProjectScraped ],
      eventChain,
    );
  });

  it('scrape - emit events - project error', async () => {
    const resource = {
      url: 'invalid_url',
      update: sandbox.stub(),
    };
    const project = Object.assign(sandbox.createStubInstance(Project), {
      pluginOpts: [],
      initPlugins: () => [],
      getResourceToScrape: sandbox.stub()
        .onCall(0)
        .returns(resource)
        .onCall(1)
        .returns(null),
    });

    const eventChain: ScrapeEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      scraper.on(ScrapeEvent.ProjectSelected, eventProject => {
        checkEntity(reject, eventProject, project);
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ProjectError, (eventProject, err) => {
        checkEntity(reject, eventProject, project);
        if (!/Invalid URL/.test(err)) reject(new Error('expected Invalid URL error'));
        eventChain.push(ScrapeEvent.ProjectError);
        resolve();
      });

      scraper.scrape(project);
    });

    assert.sameOrderedMembers(
      [ ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectError ],
      eventChain,
    );
  });

  it('scrape - emit events - resource error', async () => {
    const resource = {
      url: 'http://siteA.com/resource.html',
      update: sandbox.stub(),
    };
    const project = Object.assign(sandbox.createStubInstance(Project), {
      pluginOpts: [],
      initPlugins: () => [
        {
          test: () => true,
          apply: () => {
            throw new Error('CustomPluginError');
          },
        },
      ],
      getResourceToScrape: sandbox.stub()
        .onCall(0)
        .returns(resource)
        .onCall(1)
        .returns(null),
    });

    const eventChain: ScrapeEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      scraper.on(ScrapeEvent.ProjectSelected, eventProject => {
        checkEntity(reject, eventProject, project);
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ProjectScraped, eventProject => {
        checkEntity(reject, eventProject, project);
        eventChain.push(ScrapeEvent.ProjectScraped);
        resolve();
      });
      scraper.on(ScrapeEvent.ResourceSelected, (eventProject, eventResource) => {
        checkEntity(reject, eventProject, project);
        checkEntity(reject, eventResource, resource);
        eventChain.push(ScrapeEvent.ResourceSelected);
      });
      scraper.on(ScrapeEvent.ResourceError, (eventProject, eventResource, err) => {
        checkEntity(reject, eventProject, project);
        checkEntity(reject, eventResource, resource);
        if (!/CustomPluginError/.test(err)) reject(new Error('expected CustomPluginError'));
        eventChain.push(ScrapeEvent.ResourceError);
      });

      scraper.scrape(project);
    });

    assert.sameOrderedMembers(
      [ ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceError, ScrapeEvent.ProjectScraped ],
      eventChain,
    );
  });
});
