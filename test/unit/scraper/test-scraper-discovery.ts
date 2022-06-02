import { assert } from 'chai';
import { SinonSandbox, createSandbox, SinonStubbedInstance } from 'sinon';
import Scraper, { ScrapeEvent } from '../../../src/scraper/Scraper';
import Project from '../../../src/storage/base/Project';
import BrowserClient from '../../../src/browserclient/BrowserClient';
import Queue from '../../../src/storage/base/Queue';
import Resource from '../../../src/storage/base/Resource';
import Connection from '../../../src/storage/base/Connection';
import ConnectionManager from '../../../src/storage/ConnectionManager';
import { PluginStore } from '../../../src';

describe('Scraper - Discovery', () => {
  let sandbox:SinonSandbox;
  let conn:SinonStubbedInstance<Connection>;
  let browserClient;
  let scraper:Scraper;
  let queue: SinonStubbedInstance<Queue>;

  beforeEach(() => {
    sandbox = createSandbox();
    conn = sandbox.stub<Connection>(<any>{
      open: () => null,
      close: () => null,
      config: { client: 'client' },
    });

    queue = sandbox.createStubInstance(Queue, { getResourcesToScrape: Promise.resolve([]) });

    browserClient = <BrowserClient>{};
    browserClient.launch = sandbox.stub();
    scraper = new Scraper(conn, browserClient);
    scraper.browserClient = browserClient;

    sandbox.stub(PluginStore, 'init');

    // don't pollute output with expected errors
    sandbox.stub(scraper.logger);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('retry discovery - no valid projects found', async () => {
    const connMng = sandbox.createStubInstance<ConnectionManager>(ConnectionManager);
    connMng.getProject.returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: null }) });

    scraper.connectionMng = connMng as any;

    const eventChain: ScrapeEvent[] = [];
    scraper.on(ScrapeEvent.ProjectSelected, () => {
      eventChain.push(ScrapeEvent.ProjectSelected);
    });
    scraper.on(ScrapeEvent.ProjectScraped, () => {
      eventChain.push(ScrapeEvent.ProjectScraped);
    });
    scraper.on(ScrapeEvent.DiscoveryCompleted, () => {
      eventChain.push(ScrapeEvent.DiscoveryCompleted);
    });

    // three DiscoverComplete events are triggered in a 5s interval at 0, 2, 4 seconds
    scraper.discover({}, {}, { discover: true, retry: 2 });
    await new Promise(resolve => setTimeout(resolve, 5 * 1000));

    // stop re-discovery
    clearTimeout(scraper.discoverTimeout);

    assert.sameMembers(
      [
        ScrapeEvent.DiscoveryCompleted,
        ScrapeEvent.DiscoveryCompleted,
        ScrapeEvent.DiscoveryCompleted,
      ],
      eventChain,
    );
  });

  it('resume discovery - multiple projects scraped succesfully', async () => {
    const resource = <Resource>{ url: 'https://sitea.com' };

    const validProject:Project = Object.assign(
      sandbox.createStubInstance(Project, {
        /*
        add a mock plugin with a bit of delay execution
        to make sure ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScraped are received in the correct order
        */
        initPlugins: Promise.resolve([ { test: () => new Promise(resolve => setTimeout(resolve, 100, false)) } as any ]),
      }),
      {
        name: 'projA',
        queue,
      },
    );

    const connMng = sandbox.createStubInstance<ConnectionManager>(ConnectionManager);
    connMng.getProject.onCall(0).returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: validProject, resources: [ resource ] }) });
    connMng.getProject.onCall(1).returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: validProject, resources: [ resource ] }) });
    connMng.getProject.onCall(2).returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: null }) });

    scraper.connectionMng = <any>connMng;

    const eventChain: ScrapeEvent[] = [];

    const discoveryComplete = new Promise<void>(resolve => {
      scraper.on(ScrapeEvent.ProjectSelected, () => {
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ResourceSelected, () => {
        eventChain.push(ScrapeEvent.ResourceSelected);
      });
      scraper.on(ScrapeEvent.ResourceScraped, () => {
        eventChain.push(ScrapeEvent.ResourceScraped);
      });
      scraper.on(ScrapeEvent.ProjectScraped, () => {
        eventChain.push(ScrapeEvent.ProjectScraped);
      });
      scraper.on(ScrapeEvent.ProjectError, () => {
        eventChain.push(ScrapeEvent.ProjectError);
      });
      scraper.on(ScrapeEvent.DiscoveryCompleted, () => {
        eventChain.push(ScrapeEvent.DiscoveryCompleted);
        resolve();
      });
    });

    scraper.discover({}, {}, { discover: true });
    await discoveryComplete;

    assert.sameMembers(
      [
        ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScraped, ScrapeEvent.ProjectScraped,
        ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScraped, ScrapeEvent.ProjectScraped,
        ScrapeEvent.DiscoveryCompleted,
      ],
      eventChain,
    );
  });

  it('resume discovery - multiple projects scraped succesfully with ResourceSelectError events', async () => {
    const resource = <Resource>{ url: 'invalid_url' };

    const validProject:Project = Object.assign(
      sandbox.createStubInstance(Project, {
        /*
        add a mock plugin with a bit of delay execution
        to make sure ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScraped are received in the correct order
        */
        initPlugins: Promise.resolve([ { test: () => new Promise(resolve => setTimeout(resolve, 100, false)) } as any ]),
      }),
      {
        name: 'projA',
        queue,
      },
    );

    const connMng = sandbox.createStubInstance<ConnectionManager>(ConnectionManager);
    connMng.getProject.onCall(0).returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: validProject, resources: [ resource ] }) });
    connMng.getProject.onCall(1).returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: validProject, resources: [ resource ] }) });
    connMng.getProject.onCall(2).returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: null }) });

    scraper.connectionMng = <any>connMng;

    const eventChain: ScrapeEvent[] = [];

    const discoveryComplete = new Promise<void>(resolve => {
      scraper.on(ScrapeEvent.ProjectSelected, () => {
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ResourceSelected, () => {
        eventChain.push(ScrapeEvent.ResourceSelected);
      });
      scraper.on(ScrapeEvent.ResourceScraped, () => {
        eventChain.push(ScrapeEvent.ResourceScraped);
      });
      scraper.on(ScrapeEvent.ResourceScrapeError, () => {
        eventChain.push(ScrapeEvent.ResourceScrapeError);
      });
      scraper.on(ScrapeEvent.ResourceSelectError, () => {
        eventChain.push(ScrapeEvent.ResourceSelectError);
      });
      scraper.on(ScrapeEvent.ProjectScraped, () => {
        eventChain.push(ScrapeEvent.ProjectScraped);
      });
      scraper.on(ScrapeEvent.DiscoveryCompleted, () => {
        eventChain.push(ScrapeEvent.DiscoveryCompleted);
        resolve();
      });
    });

    scraper.discover({}, {}, { discover: true });
    await discoveryComplete;

    assert.sameMembers(
      [
        ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelectError, ScrapeEvent.ProjectScraped,
        ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelectError, ScrapeEvent.ProjectScraped,
        ScrapeEvent.DiscoveryCompleted,
      ],
      eventChain,
    );
  });

  it('resume discovery - multiple projects scraped succesfully with ResourceScrapeError events', async () => {
    const resource = <Resource>{ url: 'https://sitea.com' };

    const validProject:Project = Object.assign(
      sandbox.createStubInstance(Project, {
        /*
        add a mock plugin with a bit of delay execution
        to make sure ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScraped are received in the correct order
        */
        initPlugins: Promise.resolve([
          {
            test: () => new Promise(resolve => setTimeout(resolve, 100, true)),
            apply: () => {
              throw new Error('PluginError');
            },
          } as any,
        ]),
      }),
      {
        name: 'projA',
        queue,
      },
    );

    const connMng = sandbox.createStubInstance<ConnectionManager>(ConnectionManager);
    connMng.getProject.onCall(0).returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: validProject, resources: [ resource ] }) });
    connMng.getProject.onCall(1).returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: validProject, resources: [ resource ] }) });
    connMng.getProject.onCall(2).returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: null }) });

    scraper.connectionMng = <any>connMng;

    const eventChain: ScrapeEvent[] = [];

    const discoveryComplete = new Promise<void>(resolve => {
      scraper.on(ScrapeEvent.ProjectSelected, () => {
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ResourceSelected, () => {
        eventChain.push(ScrapeEvent.ResourceSelected);
      });
      scraper.on(ScrapeEvent.ResourceScraped, () => {
        eventChain.push(ScrapeEvent.ResourceScraped);
      });
      scraper.on(ScrapeEvent.ResourceScrapeError, () => {
        eventChain.push(ScrapeEvent.ResourceScrapeError);
      });
      scraper.on(ScrapeEvent.ResourceSelectError, () => {
        eventChain.push(ScrapeEvent.ResourceSelectError);
      });
      scraper.on(ScrapeEvent.ProjectScraped, () => {
        eventChain.push(ScrapeEvent.ProjectScraped);
      });
      scraper.on(ScrapeEvent.DiscoveryCompleted, () => {
        eventChain.push(ScrapeEvent.DiscoveryCompleted);
        resolve();
      });
    });

    scraper.discover({}, {}, { discover: true });
    await discoveryComplete;

    assert.sameMembers(
      [
        ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScrapeError, ScrapeEvent.ProjectScraped,
        ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScrapeError, ScrapeEvent.ProjectScraped,
        ScrapeEvent.DiscoveryCompleted,
      ],
      eventChain,
    );
  });

  it('stop discovery - outside discovery workflow', async () => {
    const connMng = sandbox.createStubInstance<ConnectionManager>(ConnectionManager);
    connMng.getProject.returns(<any>{ getProjectToScrape: sandbox.stub().returns({ project: null, resources: [] }) });

    scraper.connectionMng = <any>connMng;
    const cleanupSpy = sandbox.spy(scraper, 'cleanup');

    const eventChain: ScrapeEvent[] = [];

    const discoverIntrerrupted = new Promise(resolve => {
      scraper.on(ScrapeEvent.ProjectSelected, () => {
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ResourceSelected, () => {
        eventChain.push(ScrapeEvent.ResourceSelected);
      });
      scraper.on(ScrapeEvent.ResourceScraped, () => {
        eventChain.push(ScrapeEvent.ResourceScraped);
      });
      scraper.on(ScrapeEvent.ResourceScrapeError, () => {
        eventChain.push(ScrapeEvent.ResourceScrapeError);
      });
      scraper.on(ScrapeEvent.ResourceSelectError, () => {
        eventChain.push(ScrapeEvent.ResourceSelectError);
      });
      scraper.on(ScrapeEvent.ProjectScraped, () => {
        eventChain.push(ScrapeEvent.ProjectScraped);
      });
      scraper.on(ScrapeEvent.DiscoveryCompleted, () => {
        eventChain.push(ScrapeEvent.DiscoveryCompleted);
        setImmediate(scraper.gracefullStopHandler.bind(scraper), 0, 'SIGINT');
        setTimeout(resolve, 1500);
      });
    });

    scraper.discover({}, {}, { discover: true, retry: 10 });
    await discoverIntrerrupted;

    // one from postDiscover, wait, one from gracefullStopHandler
    assert.strictEqual(cleanupSpy.callCount, 2);
    assert.sameMembers(
      [
        ScrapeEvent.DiscoveryCompleted,
      ],
      eventChain,
    );
  });

  it('stop discovery - inside discovery workflow', async () => {
    const resource = <Resource>{ url: 'https://sitea.com' };

    const validProject:Project = Object.assign(
      sandbox.createStubInstance(Project, {
        initPlugins: Promise.resolve([
          {
            test: () => new Promise(resolve => setTimeout(resolve, 200, true)),
            apply: () => ({}),
          } as any,
        ]),
      }),
      {
        name: 'projA',
        queue,
      },
    );

    const connMng = sandbox.createStubInstance<ConnectionManager>(ConnectionManager);
    connMng.getProject.returns(<any>{
      getProjectToScrape: sandbox.stub().returns(
        { project: validProject, resources: [ resource ] },
      ),
    });

    scraper.connectionMng = <any>connMng;
    const cleanupSpy = sandbox.spy(scraper, 'cleanup');

    const eventChain: ScrapeEvent[] = [];

    const discoverIntrerrupted = new Promise(resolve => {
      scraper.on(ScrapeEvent.ProjectSelected, () => {
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ResourceSelected, () => {
        eventChain.push(ScrapeEvent.ResourceSelected);
        setImmediate(scraper.gracefullStopHandler.bind(scraper), 0, 'SIGINT');
        setTimeout(resolve, 1500);
      });
      scraper.on(ScrapeEvent.ResourceScraped, () => {
        eventChain.push(ScrapeEvent.ResourceScraped);
      });
      scraper.on(ScrapeEvent.ResourceScrapeError, () => {
        eventChain.push(ScrapeEvent.ResourceScrapeError);
      });
      scraper.on(ScrapeEvent.ResourceSelectError, () => {
        eventChain.push(ScrapeEvent.ResourceSelectError);
      });
      scraper.on(ScrapeEvent.ProjectScraped, () => {
        eventChain.push(ScrapeEvent.ProjectScraped);
      });
      scraper.on(ScrapeEvent.DiscoveryCompleted, () => {
        eventChain.push(ScrapeEvent.DiscoveryCompleted);
      });
    });

    scraper.discover({}, {}, { discover: true, retry: 10 });
    await discoverIntrerrupted;

    assert.isTrue(cleanupSpy.calledOnce);
    assert.sameMembers(
      [
        ScrapeEvent.ProjectSelected, ScrapeEvent.ResourceSelected, ScrapeEvent.ResourceScraped, ScrapeEvent.ProjectScraped,
      ],
      eventChain,
    );
  });
});
