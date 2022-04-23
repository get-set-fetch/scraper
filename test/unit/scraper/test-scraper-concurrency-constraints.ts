import { assert } from 'chai';
import { SinonSandbox, createSandbox, SinonStubbedInstance } from 'sinon';
import Scraper, { ScrapeEvent } from '../../../src/scraper/Scraper';
import Project from '../../../src/storage/base/Project';
import BrowserClient from '../../../src/browserclient/BrowserClient';
import Queue from '../../../src/storage/base/Queue';
import Resource from '../../../src/storage/base/Resource';
import Connection from '../../../src/storage/base/Connection';

describe('Scraper - Concurrency Constraints', () => {
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

    queue = sandbox.stub<Queue>(<any>{ getResourcesToScrape: () => [], updateStatus: () => null });

    browserClient = <BrowserClient>{};
    browserClient.launch = sandbox.stub();
    scraper = new Scraper(conn, browserClient);
    scraper.browserClient = browserClient;
  });

  afterEach(() => {
    sandbox.restore();
  });

  xit('scrape - reach concurrency constraints but dont exceed them', async () => {
    const debug = false;
    const maxRequests = 30;
    const delay = 5;

    const validResource = {
      queueId: 10,
      url: 'http://siteA.com/resource.html',
      proxy: null,
    };

    const invalidResource = {
      queueId: 10,
      url: 'http://siteA.com/invalid.html',
      proxy: null,
    };

    const getResourceArr = (len: number, nullPos: number[]) => {
      const arr = new Array(len);
      arr.fill(validResource);
      for (let i = 0; i < nullPos.length; i += 1) {
        arr[i] = invalidResource;
      }

      return arr;
    };

    const toScrapeResources: ((limit:number) => Promise<Resource[]>)[] = [
      limit => new Promise(resolve => setTimeout(resolve, 150, getResourceArr(limit, [ 1, 5, 8 ]))),
      limit => new Promise(resolve => setTimeout(resolve, 150, getResourceArr(limit, [ 1, 5, 7, 9 ]))),
      limit => new Promise(resolve => setTimeout(resolve, 150, getResourceArr(limit, [ 2 ]))),
      limit => new Promise(resolve => setTimeout(resolve, 150, getResourceArr(limit, [ 2, 4, 5 ]))),
      limit => new Promise(resolve => setTimeout(resolve, 150, getResourceArr(limit, [ 2 ]))),
      limit => new Promise(resolve => setTimeout(resolve, 150, getResourceArr(limit, [ 2 ]))),
    ];

    for (let i = 0; i < toScrapeResources.length; i += 1) {
      queue.getResourcesToScrape.onCall(i).callsFake(toScrapeResources[i]);
    }
    queue.getResourcesToScrape.callsFake(limit => new Promise(resolve => setTimeout(resolve, 150, [])));

    const project = Object.assign(sandbox.createStubInstance(Project), {
      pluginOpts: [],
      initPlugins: () => [
        {
          test: () => true,
          apply: (project, resource) => new Promise(
            (resolve, reject) => (/invalid/.test(resource.url) ? setTimeout(reject, 400) : setTimeout(resolve, 500)),
          ),
        },
      ],
      queue,
    });

    let startTime;
    let lastStartTime:number;
    let lastScrapeInProgress:number = 0;
    const scrapeInProgress:number[] = [];

    const concurencyErrors: Error[] = [];

    await new Promise<void>((resolve, reject) => {
      scraper.on(ScrapeEvent.ProjectSelected, eventProject => {
        startTime = Date.now();
      });
      scraper.on(ScrapeEvent.ProjectScraped, eventProject => {
        resolve();
      });
      scraper.on(ScrapeEvent.ResourceSelected, (eventProject, eventResource) => {
        const currTime = Date.now() - startTime;

        // keep an error of 5ms
        if (
          lastStartTime && currTime - lastStartTime > delay * 2 + 1
          && lastScrapeInProgress !== maxRequests
        ) {
          const errMsg = `!! large gap detected between scraping consecutive resources, gap: ${currTime - lastStartTime}, lastScrapeInProgress: ${lastScrapeInProgress}`;
          if (debug) console.log(errMsg);
          concurencyErrors.push(
            new Error(errMsg),
          );
        }
        lastStartTime = currTime;
        lastScrapeInProgress += 1;
        scrapeInProgress.push(lastScrapeInProgress);

        if (debug) console.log(`ResourceSelected bufferLen: ${scraper.queueBuffer.resources.length} | scrapeInProgressResourceNo: ${lastScrapeInProgress} | + ${Date.now() - startTime}`);
      });
      scraper.on(ScrapeEvent.ResourceScraped, (eventProject, eventResource) => {
        /*
        only now can new resources be scraped, till now maxRequests was at maximum, and new resource scraping was halted
        update lastStartTime to count for it, since the gap between start times can be larger than {delay}
        */
        if (lastScrapeInProgress === maxRequests) {
          lastStartTime = Date.now() - startTime;
        }
        lastScrapeInProgress -= 1;
        scrapeInProgress.push(lastScrapeInProgress);

        if (debug) console.log(`ResourceScraped bufferLen: ${scraper.queueBuffer.resources.length} | scrapeInProgressResourceNo: ${lastScrapeInProgress} | + ${Date.now() - startTime}`);
      });
      scraper.on(ScrapeEvent.ResourceScrapeError, (eventProject, eventResource) => {
        /*
        only now can new resources be scraped, till now maxRequests was at maximum, and new resource scraping was halted
        update lastStartTime to count for it, since the gap between start times can be larger than {delay}
        */
        if (lastScrapeInProgress === maxRequests) {
          lastStartTime = Date.now() - startTime;
        }

        lastScrapeInProgress -= 1;
        scrapeInProgress.push(lastScrapeInProgress);
        if (debug) console.log(`ResourceError bufferLen: ${scraper.queueBuffer.resources.length} | scrapeInProgressResourceNo: ${lastScrapeInProgress} | + ${Date.now() - startTime}`);
      });

      // concurrency options are only supported on non-browser clients
      delete scraper.browserClient;
      scraper.scrape(
        project,
        {
          proxy: { maxRequests, delay },
          domain: { maxRequests, delay },
          session: { maxRequests, delay },
        },
      );
    });

    if (concurencyErrors.length > 0) {
      console.log(concurencyErrors.map(err => err.message).join('\n'));
      throw new Error('concurrency errors detected');
    }

    /*
    except for scrape starting and ending where in-progress resources increment and respectively decrement
    in progress resources should be near maxRequests maximum
    */
    const middleInProgress = scrapeInProgress.slice(maxRequests, -maxRequests);
    const invalidInProgressCount = middleInProgress.filter(count => count < maxRequests - 5);
    assert.isEmpty(invalidInProgressCount);

    // respect maxRequests, reach it but don't exceed it
    assert.strictEqual(Math.max(...scrapeInProgress), maxRequests);

    // last scrape-in-progress count should be 0
    assert.strictEqual(scrapeInProgress[scrapeInProgress.length - 1], 0);
  });
});
