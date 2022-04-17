import { assert } from 'chai';
import { SinonSandbox, createSandbox, SinonStubbedInstance } from 'sinon';
import Scraper, { ScrapeEvent } from '../../../src/scraper/Scraper';
import Project from '../../../src/storage/base/Project';
import BrowserClient from '../../../src/browserclient/BrowserClient';
import Queue from '../../../src/storage/base/Queue';
import Resource from '../../../src/storage/base/Resource';
import Connection from '../../../src/storage/base/Connection';
import ConnectionManager from '../../../src/storage/ConnectionManager';

xdescribe('Scraper - Discovery', () => {
  let sandbox:SinonSandbox;
  let conn:SinonStubbedInstance<Connection>;
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
  });

  afterEach(() => {
    sandbox.restore();
  });

  /*
  Scraper - one project scrape at a time
  Concurrency, Discovery are complicated

  scrape(project)
  discover()
    - scrape project
    - ProjectScraped, ProjectError, DiscoveryComplete - call discover again

  */

  /*
  PROBLEMS:
  1) Project.getProjectToScrape
    - scraperA marks resourceA as in progress, resets it afterwards
    - scraperB marks resourceA as in progress, resets it afterwards
    - there's a single to-be-scraped resource available
        scraperA can succefully scrape it, only for scraperB to reset its status and try to re-scrape it by any available scrapers
    Sollution: getProjectToScrape does a single SQL, does
  2) After succesfully scraping a project in discovery mode
    - ProjectScraped is not invoked
    - we get multiple "discovering new projects"
  */

  // discover multiple projects 1 by one
  // no projects to discover, resume discovering
  // stop with discovery

  it('project success - resume discovery', async () => {
    const emptyProject:Project = sandbox.createStubInstance(Project);
    emptyProject.queue = queue;

    const getProjectToScrape = sandbox.stub()
      .onCall(0)
      .returns(emptyProject)
      .onCall(1)
      .returns(emptyProject)
      .onCall(2)
      .returns(null)
      .onCall(3)
      .returns(emptyProject);

    const connMng = sandbox.createStubInstance<ConnectionManager>(ConnectionManager);
    connMng.getProject.returns(<any>{ getProjectToScrape });
    // connMng.getProject.onCall(0).returns(<any>{ getProjectToScrape: sandbox.stub().returns(emptyProject) });
    // connMng.getProject.onCall(1).returns(<any>{ getProjectToScrape: sandbox.stub().returns(emptyProject) });
    // connMng.getProject.onCall(2).returns(<any>{ getProjectToScrape: sandbox.stub().returns(null) });
    // connMng.getProject.onCall(3).returns(<any>{ getProjectToScrape: sandbox.stub().returns(emptyProject) });

    // connMng.getProject.onCall(1).returns(null);
    // console.log('getProject');
    // console.log((await connMng.getProject()).getProjectToScrape());
    // console.log((await connMng.getProject()).getProjectToScrape());
    // console.log((await connMng.getProject()).getProjectToScrape());

    scraper.connectionMng = <any>connMng;
    // sandbox.stub(connMng, 'getProject').returns();

    //   Promise.resolve(null),
    // ]);
    // connMng.getProject.returns(Promise.resolve(emptyProject));

    // scraper.connectionMng = <any>sandbox.createStubInstance(
    //   ConnectionManager,
    //   {
    //     getProject: <any>sandbox.stub().returns({
    //       getProjectToScrape: sandbox.stub().returns({
    //         pluginOpts: [],
    //         initPlugins: sandbox.stub().returns([]),
    //         queue,
    //       }),
    //     }),
    //   },
    // );

    const eventChain: ScrapeEvent[] = [];

    const discoverAttempts = new Promise<void>(resolve => {
      let successNo = 0;
      scraper.on(ScrapeEvent.ProjectSelected, () => {
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ProjectScraped, () => {
        successNo += 1;
        eventChain.push(ScrapeEvent.ProjectScraped);
        if (successNo === 3) resolve();
      });
      scraper.on(ScrapeEvent.DiscoverComplete, () => {
        console.log('discovery complete');
        scraper.stop = true;
        eventChain.push(ScrapeEvent.DiscoverComplete);
      });
    });

    scraper.discover({}, {}, { discover: true, retry: 2 });

    await Promise.race([
      new Promise(resolve => setTimeout(resolve, 25 * 1000)),
      discoverAttempts,
    ]);

    console.log('DONE');

    clearTimeout(scraper.retryTimeout);
    // scraper.postScrape();
    // scraper.off();
    // scraper.removeAllListeners();

    console.log(eventChain);

    assert.sameMembers(
      [
        ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectScraped,
        ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectScraped,
        ScrapeEvent.DiscoverComplete,
        ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectScraped,
      ],
      eventChain,
    );
  });

  it('project error - resume discovery', async () => {
    queue.getResourcesToScrape.throwsException(new Error('unexpected concurrency error'));

    scraper.connectionMng = <any>sandbox.createStubInstance(
      ConnectionManager,
      {
        getProject: <any>sandbox.stub().returns({
          getProjectToScrape: sandbox.stub().returns({
            pluginOpts: [],
            initPlugins: sandbox.stub().returns([]),
            queue,
          }),
        }),
      },
    );

    const eventChain: ScrapeEvent[] = [];

    const discoverAttempts = new Promise<void>(resolve => {
      let errorNo = 0;
      scraper.on(ScrapeEvent.ProjectSelected, () => {
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ProjectError, () => {
        errorNo += 1;
        eventChain.push(ScrapeEvent.ProjectError);
        if (errorNo === 2) resolve();
      });
    });

    scraper.discover({}, {}, { discover: true, retry: 2 });

    await Promise.race([
      new Promise(resolve => setTimeout(resolve, 25 * 1000)),
      discoverAttempts,
    ]);

    clearTimeout(scraper.retryTimeout);
    scraper.removeAllListeners();

    assert.sameMembers(
      [ ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectError, ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectError ],
      eventChain,
    );
  });

  it('project error - stop discovery', async () => {
    queue.getResourcesToScrape.throwsException(new Error('unexpected concurrency error'));

    scraper.connectionMng = <any>sandbox.createStubInstance(
      ConnectionManager,
      {
        getProject: <any>sandbox.stub().returns({
          getProjectToScrape: sandbox.stub().returns({
            pluginOpts: [],
            initPlugins: sandbox.stub().returns([]),
            queue,
          }),
        }),
      },
    );

    const eventChain: ScrapeEvent[] = [];

    await new Promise<void>(resolve => {
      scraper.on(ScrapeEvent.ProjectSelected, () => {
        eventChain.push(ScrapeEvent.ProjectSelected);
      });
      scraper.on(ScrapeEvent.ProjectError, () => {
        eventChain.push(ScrapeEvent.ProjectError);
      });
      scraper.on(ScrapeEvent.DiscoverComplete, () => {
        eventChain.push(ScrapeEvent.DiscoverComplete);
        resolve();
      });
      scraper.discover({}, {}, { discover: true });
    });

    assert.sameMembers(
      [ ScrapeEvent.ProjectSelected, ScrapeEvent.ProjectError, ScrapeEvent.DiscoverComplete ],
      eventChain,
    );
  });
});
