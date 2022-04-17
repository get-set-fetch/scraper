import { assert } from 'chai';
import Sinon, { SinonSandbox, createSandbox, SinonStubbedInstance } from 'sinon';
import Scraper, { ScrapeEvent } from '../../../src/scraper/Scraper';
import Project from '../../../src/storage/base/Project';
import BrowserClient from '../../../src/browserclient/BrowserClient';
import Queue from '../../../src/storage/base/Queue';
import Connection from '../../../src/storage/base/Connection';
import ConnectionManager from '../../../src/storage/ConnectionManager';
import { Resource } from '../../../src';
import { ConcurrencyError, ConcurrencyLevel } from '../../../src/scraper/ConcurrencyManager';

describe('Scraper - Single Project', () => {
  let sandbox:SinonSandbox;
  let conn:SinonStubbedInstance<Connection>;
  let browserClient;
  let scraper:Scraper;
  let queue: SinonStubbedInstance<Queue>;

  const checkEntity = (reject : (err) => void, haystack, needle) => {
    try {
      assert.include(haystack, needle);
    }
    catch (err) {
      reject(err);
    }
  };

  beforeEach(() => {
    sandbox = createSandbox();
    conn = sandbox.stub<Connection>(<any>{
      open: () => null,
      close: () => null,
      config: { client: 'client' },
    });

    queue = sandbox.stub<Queue>(<any>{ getResourcesToScrape: () => [], updateStatus: () => null });

    browserClient = <BrowserClient>{};
    browserClient.launch = sandbox.stub();
    browserClient.close = sandbox.stub();
    scraper = new Scraper(conn, browserClient);
    scraper.browserClient = browserClient;
  });

  afterEach(async () => {
    await scraper.postScrapeProject();
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

  it('preChecks - concurrency using browser clients - condition not supported', () => {
    let err;

    scraper.concurrencyOpts = { domain: { maxRequests: 2, delay: 2000 } };
    try {
      scraper.preChecks();
    }
    catch (e) {
      err = e;
    }

    assert.isTrue(/maxRequests is not supported/.test(err));
  });

  it('preChecks - concurrency using browser clients - condition supported', () => {
    let err;

    scraper.concurrencyOpts = { domain: { delay: 2000 } };
    try {
      scraper.preChecks();
    }
    catch (e) {
      err = e;
    }

    assert.isUndefined(err);
  });

  it('preChecks - concurrency using dom clients - all conditions supported', async () => {
    let err;

    scraper.concurrencyOpts = { domain: { maxRequests: 2, delay: 2000 } };
    try {
      scraper.browserClient = null;
      await scraper.preChecks();
    }
    catch (e) {
      err = e;
    }

    assert.isUndefined(err);
  });

  it('init - do connManager.connec', async () => {
    await scraper.init();

    // called once for each model storage
    assert.strictEqual(conn.open.callCount, 3);
  }); // vladut iepurasul

  it('init - do browserClient.launch', async () => {
    scraper.browserClient.isLaunched = false;
    await scraper.init();

    assert.isTrue(browserClient.launch.calledOnce);
  });

  it('init - skip browserClient.launch', async () => {
    browserClient.isLaunched = true;
    await scraper.init();

    assert.isTrue(browserClient.launch.neverCalledWith());
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

    const connectionMng = sandbox.createStubInstance(ConnectionManager);
    connectionMng.getProject.returns(<any>Project);

    scraper.connectionMng = <any>connectionMng;

    const preScrapeProject = await scraper.initProject({
      name: 'a.com',
      pipeline: 'browser-static-content',
      pluginOpts: [ { name: 'ExtractUrlsPlugin' } ],
    });

    assert.isTrue(saveStub.calledOnce);
    assert.deepOwnInclude(preScrapeProject, expectedProject);
  });

  it('scrape - emit events - happy path', async () => {
    const resource = <Resource>{ url: 'http://siteA.com/resource.html' };

    queue.getResourcesToScrape
      .onCall(0)
      .returns(Promise.resolve([ resource ]))
      .returns(Promise.resolve([]));

    const project = Object.assign(sandbox.createStubInstance(Project), {
      name: 'projA',
      /*
      add a mock plugin with a bit of delay execution
      to make sure ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScraped are received in the correct order
      */
      initPlugins: () => [ { test: () => new Promise(resolve => setTimeout(resolve, 100, false)) } ],
      queue,
    });

    const eventChain: ScrapeEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      scraper.on(ScrapeEvent.ProjectSelected, eventProject => {
        checkEntity(reject, eventProject, project);
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ResourceSelected, (eventProject, eventResource) => {
        checkEntity(reject, eventProject, project);
        checkEntity(reject, eventResource, resource);
        eventChain.push(ScrapeEvent.ResourceSelected);
      });
      scraper.on(ScrapeEvent.ResourceScraped, (eventProject, eventResource) => {
        checkEntity(reject, eventProject, project);
        checkEntity(reject, eventResource, { ...resource, proxy: null, hostname: 'sitea.com' });
        eventChain.push(ScrapeEvent.ResourceScraped);
      });
      scraper.on(ScrapeEvent.ProjectScraped, eventProject => {
        checkEntity(reject, eventProject, project);
        eventChain.push(ScrapeEvent.ProjectScraped);
        resolve();
      });

      scraper.scrape(project);
    });

    assert.sameOrderedMembers(
      [ ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScraped, ScrapeEvent.ProjectScraped ],
      eventChain,
    );
  });

  it('scrape - emit events - concurrency check unknown error', async () => {
    const resource = <Resource>{ url: 'invalid_url' };

    queue.getResourcesToScrape
      .onCall(0)
      .returns(Promise.resolve([ resource ]))
      .returns(Promise.resolve([]));

    const project = Object.assign(sandbox.createStubInstance(Project), {
      initPlugins: () => [],
      name: 'projA',
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

      scraper.scrape(project);
    });

    assert.sameOrderedMembers(
      [ ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectScraped ],
      eventChain,
    );
  });

  it('scrape - emit events - concurrency check concurrency error', async () => {
    const resource = <Resource>{ url: 'http://sitea.com' };
    let addResourcesSpy: Sinon.SinonSpy;

    queue.getResourcesToScrape
      .onCall(0)
      .returns(Promise.resolve([ resource ]))
      .returns(Promise.resolve([]));

    const project = Object.assign(sandbox.createStubInstance(Project), {
      initPlugins: () => [],
      name: 'projA',
      queue,
    });

    const eventChain: ScrapeEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      scraper.on(ScrapeEvent.ProjectSelected, eventProject => {
        checkEntity(reject, eventProject, project);
        eventChain.push(ScrapeEvent.ProjectSelected);

        // stub concurrency.check to throw ConcurrencyError
        sandbox.stub(scraper.concurrency, 'check').onCall(0).throwsException(new ConcurrencyError(ConcurrencyLevel.Project));
        // monitor QueueBuffer.addResources
        addResourcesSpy = sandbox.spy(scraper.queueBuffer, 'addResources');
      });

      scraper.on(ScrapeEvent.ProjectScraped, eventProject => {
        checkEntity(reject, eventProject, project);
        eventChain.push(ScrapeEvent.ProjectScraped);
        resolve();
      });

      scraper.scrape(project);
    });

    assert.sameOrderedMembers(
      [ ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectScraped ],
      eventChain,
    );

    /*
    QueueBuffer.addResources is called 2 times with a non empty array value
    1st - fill buffer, 2nd - re-add resource to buffer due to ConcurrencyError
    */
    const filteredCalls = addResourcesSpy.getCalls().filter(call => call.args[0].length > 0);
    assert.strictEqual(filteredCalls.length, 2);
    assert.deepEqual(resource, filteredCalls[0].args[0][0]);
    assert.deepEqual(resource, filteredCalls[1].args[0][0]);
  });

  it('scrape - emit events - queueBuffer getResource error', async () => {
    const logErrorSpy = sandbox.spy(scraper.logger, 'error');

    queue.getResourcesToScrape.throwsException(new Error('BufferError'));

    const project = Object.assign(sandbox.createStubInstance(Project), {
      initPlugins: () => [],
      name: 'projA',
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
      scraper.on(ScrapeEvent.ResourceSelected, () => {
        eventChain.push(ScrapeEvent.ResourceSelected);
      });
      scraper.on(ScrapeEvent.ResourceScraped, () => {
        eventChain.push(ScrapeEvent.ResourceScraped);
      });

      scraper.scrape(project);
    });

    assert.sameOrderedMembers(
      [ ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectScraped ],
      eventChain,
    );

    /*
    only a single queueBuffer.getResource call,
    concurrency.isScrapingComplete will return positive since buffer is empty and not a single resource has started scraping
    */
    assert.strictEqual(logErrorSpy.getCalls().length, 1);
    logErrorSpy.getCalls().every(call => /BufferError/.test(call.args[0].message));
  });

  it('scrape - emit events - resource error', async () => {
    const resource = <Resource>{ url: 'http://siteA.com/resource.html' };

    queue.getResourcesToScrape
      .onCall(0)
      .returns(Promise.resolve([ resource ]))
      .returns(Promise.resolve([]));

    const project = Object.assign(sandbox.createStubInstance(Project), {
      name: 'projA',
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
