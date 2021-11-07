import { assert } from 'chai';
import { SinonSandbox, createSandbox, SinonStubbedInstance } from 'sinon';
import Scraper, { ScrapeEvent } from '../../../src/scraper/Scraper';
import Project from '../../../src/storage/base/Project';
import BrowserClient from '../../../src/browserclient/BrowserClient';
import Storage from '../../../src/storage/base/Storage';
import Queue from '../../../src/storage/base/Queue';
import ModelStorage from '../../../src/storage/ModelStorage';

describe('Scraper', () => {
  let sandbox:SinonSandbox;
  let storage:SinonStubbedInstance<Storage>;
  let browserClient;
  let scraper:Scraper;
  let queue: SinonStubbedInstance<Queue>;

  const checkEntity = (reject : (err) => void, actual, expected) => {
    try {
      assert.include(actual, expected);
    }
    catch (err) {
      reject(err);
    }
  };

  beforeEach(() => {
    sandbox = createSandbox();
    storage = sandbox.stub<Storage>(<any>{
      connect: () => null,
      close: () => null,
      config: { client: 'client' },
      toJSON: () => null,
    });

    queue = sandbox.stub<Queue>(<any>{ getResourcesToScrape: () => [], updateStatus: () => null });

    browserClient = <BrowserClient>{};
    browserClient.launch = sandbox.stub();
    scraper = new Scraper(storage, browserClient);
    scraper.browserClient = browserClient;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('isJSONConfig', async () => {
    assert.isTrue(scraper.isJSONConfig({ client: 'sqlite3' }));

    const ClassDef = class {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      foo() {}
    };
    assert.isFalse(scraper.isJSONConfig(ClassDef));
    assert.isFalse(scraper.isJSONConfig(new ClassDef()));
  });

  it('preScrape - do storage.connect', async () => {
    await scraper.preScrape();

    // called once for each model storage
    assert.strictEqual(storage.connect.callCount, 3);
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
      name: 'a.com',
      pluginOpts: [
        { name: 'pluginA' },
      ],
    };

    const saveStub = sandbox.stub();

    const Project = sandbox.stub().callsFake(
      () => ({ save: saveStub, ...expectedProject }),
    );
    Project.get = sandbox.stub();

    const modelStorage = sandbox.createStubInstance(ModelStorage);
    modelStorage.getModels.returns({ Project } as any);

    scraper.modelStorage = <any>modelStorage;

    const preScrapeProject = await scraper.initProject({
      name: 'a.com',
      pipeline: 'browser-static-content',
      pluginOpts: [ { name: 'ExtractUrlsPlugin' } ],
    });

    assert.isTrue(saveStub.calledOnce);
    assert.deepOwnInclude(preScrapeProject, expectedProject);
  });

  it('scrape - emit events - happy path', async () => {
    const resource = {
      queueId: 10,
      url: 'http://siteA.com/resource.html',
      proxy: null,
    };

    queue.getResourcesToScrape
      .onCall(0)
      .returns(Promise.resolve([ { queueId: 10, url: 'http://siteA.com/resource.html' } as any ]))
      .returns(Promise.resolve([]));

    const project = Object.assign(sandbox.createStubInstance(Project), {
      pluginOpts: [],
      initPlugins: () => [],
      queue,
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
    queue.getResourcesToScrape
      .onCall(0)
      .returns(Promise.resolve([ { queueId: 10, url: 'invalid_url' } as any ]))
      .returns(Promise.resolve([]));

    const project = Object.assign(sandbox.createStubInstance(Project), {
      pluginOpts: [],
      initPlugins: () => [],
      queue,
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
      queueId: 10,
      url: 'http://siteA.com/resource.html',
      proxy: null,
    };

    queue.getResourcesToScrape
      .onCall(0)
      .returns(Promise.resolve([ { queueId: 10, url: 'http://siteA.com/resource.html', update: sandbox.stub() } as any ]))
      .returns(Promise.resolve([]));

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
      queue,
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
