/* eslint-disable @typescript-eslint/no-explicit-any */
import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import { Project, Resource } from '../../../src';
import ConcurrencyManager, { ConcurrencyError, ConcurrencyLevel } from '../../../src/scraper/ConcurrencyManager';
import { Proxy } from '../../../src/storage/base/Resource';

describe('ConcurrencyManager', () => {
  let sandbox:SinonSandbox;
  let concurrency:ConcurrencyManager;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('defaultOpts', () => {
    concurrency = new ConcurrencyManager();
    assert.deepEqual(
      {
        project: undefined,
        proxy: {
          maxRequests: 1,
          delay: 1000,
        },
        domain: {
          maxRequests: 1,
          delay: 3000,
        },
        session: undefined,
        proxyPool: [ null ],
      },
      concurrency.opts,
    );
  });

  it('getCheckInterval', () => {
    concurrency = new ConcurrencyManager({
      project: { delay: 100, maxRequests: 1 },
    });
    assert.strictEqual(concurrency.getCheckInterval(), 100);

    concurrency = new ConcurrencyManager({
      project: { delay: 300, maxRequests: 1 },
      session: { delay: 500, maxRequests: 1 },
    });
    assert.strictEqual(concurrency.getCheckInterval(), 300);
  });

  it('sessionId', () => {
    concurrency = new ConcurrencyManager();
    assert.strictEqual(concurrency.sessionId({ host: 'proxyA', port: 80 }, 'hostA'), 'proxyA-80-hostA');
    assert.strictEqual(concurrency.sessionId(null, 'hostA'), 'none-hostA');
  });

  it('proxyId', () => {
    concurrency = new ConcurrencyManager();
    assert.strictEqual(concurrency.proxyId({ host: 'proxyA', port: 80 }), 'proxyA-80');
    assert.strictEqual(concurrency.proxyId(null), 'none');
  });

  it('getNextProxy', () => {
    concurrency = new ConcurrencyManager({ proxyPool: [
      { host: 'proxyA', port: 80 },
      { host: 'proxyB', port: 81 },
    ] });
    assert.deepEqual({ host: 'proxyA', port: 80 }, concurrency.getNextProxy());
    assert.deepEqual({ host: 'proxyB', port: 81 }, concurrency.getNextProxy());
    assert.deepEqual({ host: 'proxyA', port: 80 }, concurrency.getNextProxy());
  });

  it('getNextAvailableProxy using proxyPool', () => {
    concurrency = new ConcurrencyManager({
      proxyPool: [
        { host: 'proxyA', port: 80 },
        { host: 'proxyB', port: 81 },
        { host: 'proxyC', port: 82 },
      ],
      proxy: {
        maxRequests: 2,
        delay: 500,
      },
    });

    // 2nd proxy is available, proxyIdx = undefined
    concurrency.status.proxy = {
      'proxyA-80': {
        lastStartTime: 100,
        requests: 5,
      },
      'proxyB-81': {
        lastStartTime: 100,
        requests: 1,
      },
      'proxyC-82': {
        lastStartTime: 100,
        requests: 0,
      },
    };
    assert.deepEqual({ host: 'proxyB', port: 81 }, concurrency.getNextAvailableProxy());

    // 1st proxy is available, proxyIdx = 1, need to re-check proxies from the start of proxy list
    concurrency.proxyIdx = 1;
    concurrency.status.proxy = {
      'proxyA-80': {
        lastStartTime: 100,
        requests: 1,
      },
      'proxyB-81': {
        lastStartTime: 100,
        requests: 3,
      },
      'proxyC-82': {
        lastStartTime: 100,
        requests: 5,
      },
    };
    assert.deepEqual({ host: 'proxyA', port: 80 }, concurrency.getNextAvailableProxy());

    // no proxy is available, proxyIdx = 1
    concurrency.proxyIdx = 1;
    concurrency.status.proxy = {
      'proxyA-80': {
        lastStartTime: 100,
        requests: 5,
      },
      'proxyB-81': {
        lastStartTime: 100,
        requests: 2,
      },
      'proxyC-82': {
        lastStartTime: 100,
        requests: 2,
      },
    };
    assert.isUndefined(concurrency.getNextAvailableProxy());
  });

  it('getNextAvailableProxy using no proxy', () => {
    concurrency = new ConcurrencyManager({
      proxy: {
        maxRequests: 2,
        delay: 500,
      },
    });

    // 1st proxy is available, it has a null value and key 'none' under status entries
    concurrency.status.proxy = {
      none: {
        lastStartTime: 100,
        requests: 1,
      },
    };
    assert.isNull(concurrency.getNextAvailableProxy());

    // no proxy is available
    concurrency.proxyIdx = 1;
    concurrency.status.proxy = {
      none: {
        lastStartTime: 100,
        requests: 5,
      },
    };
    assert.isUndefined(concurrency.getNextAvailableProxy());
  });

  it('getNextAvailableSessionProxy using proxyPool', () => {
    concurrency = new ConcurrencyManager({
      proxyPool: [
        { host: 'proxyA', port: 80 },
        { host: 'proxyB', port: 81 },
        { host: 'proxyC', port: 82 },
      ],
      session: {
        maxRequests: 2,
        delay: 500,
      },
    });

    // 2nd proxy is available, proxyIdx = undefined
    concurrency.status.session = {
      'proxyA-80-hostA': {
        lastStartTime: 100,
        requests: 5,
      },
      'proxyB-81-hostA': {
        lastStartTime: 100,
        requests: 1,
      },
      'proxyC-82-hostA': {
        lastStartTime: 100,
        requests: 0,
      },
    };
    assert.deepEqual({ host: 'proxyB', port: 81 }, concurrency.getNextAvailableSessionProxy('hostA'));

    // 1st proxy is available, proxyIdx = 1, need to re-check proxies from the start of proxy list
    concurrency.proxyIdx = 1;
    concurrency.status.session = {
      'proxyA-80-hostA': {
        lastStartTime: 100,
        requests: 1,
      },
      'proxyB-81-hostA': {
        lastStartTime: 100,
        requests: 3,
      },
      'proxyC-82-hostA': {
        lastStartTime: 100,
        requests: 5,
      },
    };
    assert.deepEqual({ host: 'proxyA', port: 80 }, concurrency.getNextAvailableSessionProxy('hostA'));

    // no proxy is available, proxyIdx = 1
    concurrency.proxyIdx = 1;
    concurrency.status.session = {
      'proxyA-80-hostA': {
        lastStartTime: 100,
        requests: 5,
      },
      'proxyB-81-hostA': {
        lastStartTime: 100,
        requests: 2,
      },
      'proxyC-82-hostA': {
        lastStartTime: 100,
        requests: 2,
      },
    };
    assert.isUndefined(concurrency.getNextAvailableSessionProxy('hostA'));
  });

  it('getNextAvailableSessionProxy using no proxy', () => {
    concurrency = new ConcurrencyManager({
      session: {
        maxRequests: 2,
        delay: 500,
      },
    });

    // 1st proxy is available, it has a null value and key 'none' under status entries
    concurrency.status.session = {
      'none-hostA': {
        lastStartTime: 100,
        requests: 1,
      },
    };
    assert.isNull(concurrency.getNextAvailableSessionProxy('hostA'));

    // no proxy is available
    concurrency.proxyIdx = 1;
    concurrency.status.session = {
      'none-hostA': {
        lastStartTime: 100,
        requests: 5,
      },
    };
    assert.isUndefined(concurrency.getNextAvailableSessionProxy('hostA'));
  });

  it('add/remove resource', () => {
    sandbox.stub(Date, 'now').returns(100);

    concurrency = new ConcurrencyManager();
    concurrency.addResource({ host: 'proxyA', port: 80 }, 'hostA');

    assert.deepEqual(
      concurrency.status,
      {
        project: {
          lastStartTime: 100,
          requests: 1,
        },
        proxy: {
          'proxyA-80': {
            lastStartTime: 100,
            requests: 1,
          },
        },
        domain: {
          hostA: {
            lastStartTime: 100,
            requests: 1,
          },
        },
        session: {
          'proxyA-80-hostA': {
            lastStartTime: 100,
            requests: 1,
          },
        },
      },
    );

    concurrency.removeResource({ host: 'proxyA', port: 80 }, 'hostA');

    assert.deepEqual(
      concurrency.status,
      {
        project: {
          lastStartTime: 100,
          requests: 0,
        },
        proxy: {
          'proxyA-80': {
            lastStartTime: 100,
            requests: 0,
          },
        },
        domain: {
          hostA: {
            lastStartTime: 100,
            requests: 0,
          },
        },
        session: {
          'proxyA-80-hostA': {
            lastStartTime: 100,
            requests: 0,
          },
        },
      },
    );
  });

  it('conditionsMet', async () => {
    concurrency = new ConcurrencyManager({ project: { delay: 300, maxRequests: 1 } });
    // 1st resource request
    assert.isTrue(concurrency.conditionsMet(concurrency.status.project, concurrency.opts.project));
    concurrency.addResource(null, 'hostA');

    // 2nd resource request, attempt to scrape in parallel
    assert.isFalse(concurrency.conditionsMet(concurrency.status.project, concurrency.opts.project));

    // 1st resource request complete, 2nd resource request meets concurrency maxRequests but not delay
    concurrency.removeResource(null, 'hostA');
    assert.isFalse(concurrency.conditionsMet(concurrency.status.project, concurrency.opts.project));

    // 1st resource request complete, 2nd resource request meets concurrency maxRequests and delay
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.isTrue(concurrency.conditionsMet(concurrency.status.project, concurrency.opts.project));
  });

  it('resourceScraped', async () => {
    sandbox.stub(Date, 'now').returns(100);
    const proxy:Proxy = { host: 'proxyA', port: 80 };

    concurrency = new ConcurrencyManager();
    concurrency.addResource(proxy, 'hosta.com');
    concurrency.resourceScraped(
      null,
      <Resource>{ url: 'http://hostA.com/resource.html', proxy },
    );

    assert.deepEqual(
      concurrency.status,
      {
        project: {
          lastStartTime: 100,
          requests: 0,
        },
        proxy: {
          'proxyA-80': {
            lastStartTime: 100,
            requests: 0,
          },
        },
        domain: {
          'hosta.com': {
            lastStartTime: 100,
            requests: 0,
          },
        },
        session: {
          'proxyA-80-hosta.com': {
            lastStartTime: 100,
            requests: 0,
          },
        },
      },
    );
  });

  it('resourceError', async () => {
    sandbox.stub(Date, 'now').returns(100);
    const proxy:Proxy = { host: 'proxyA', port: 80 };

    concurrency = new ConcurrencyManager();
    concurrency.addResource(proxy, 'hosta.com');
    concurrency.addResource(proxy, 'hosta.com');
    concurrency.resourceError(
      null,
      <Resource>{ url: 'http://hostA.com/resource.html', proxy },
    );

    assert.deepEqual(
      concurrency.status,
      {
        project: {
          lastStartTime: 100,
          requests: 1,
        },
        proxy: {
          'proxyA-80': {
            lastStartTime: 100,
            requests: 1,
          },
        },
        domain: {
          'hosta.com': {
            lastStartTime: 100,
            requests: 1,
          },
        },
        session: {
          'proxyA-80-hosta.com': {
            lastStartTime: 100,
            requests: 1,
          },
        },
      },
    );
  });

  it('getResourceToScrape, ConcurrencyError at Project level', async () => {
    concurrency = new ConcurrencyManager({ project: { maxRequests: 2, delay: 100 } });
    concurrency.status.project.requests = 2;

    let err;
    try {
      await concurrency.getResourceToScrape(null);
    }
    catch (e) {
      err = e;
    }
    assert.isTrue(err instanceof ConcurrencyError);
    assert.strictEqual(err.level, ConcurrencyLevel.Project);
  });

  it('getResourceToScrape, ConcurrencyError at Proxy level', async () => {
    concurrency = new ConcurrencyManager({ proxy: { maxRequests: 2, delay: 100 } });
    concurrency.status.proxy.none = {
      requests: 2,
      lastStartTime: 0,
    };

    let err;
    try {
      await concurrency.getResourceToScrape(null);
    }
    catch (e) {
      err = e;
    }
    assert.isTrue(err instanceof ConcurrencyError);
    assert.strictEqual(err.level, ConcurrencyLevel.Proxy);
  });

  it('getResourceToScrape, scraping complete', async () => {
    concurrency = new ConcurrencyManager({ proxy: { maxRequests: 2, delay: 100 } });
    concurrency.status.project.requests = 0;

    const projectGetResourceToScrapeStub = sandbox.stub().returns(null);

    const resource = await concurrency.getResourceToScrape(<any>{ getResourceToScrape: projectGetResourceToScrapeStub });
    assert.isTrue(projectGetResourceToScrapeStub.calledOnce);
    assert.isNull(resource);
  });

  it('getResourceToScrape, no available to-be-scraped resources', async () => {
    concurrency = new ConcurrencyManager({ proxy: { maxRequests: 2, delay: 100 } });
    concurrency.status.project.requests = 1;

    const projectGetResourceToScrapeStub = sandbox.stub().returns(null);

    let err;
    try {
      await concurrency.getResourceToScrape(<any>{ getResourceToScrape: projectGetResourceToScrapeStub });
    }
    catch (e) {
      err = e;
    }
    assert.isTrue(err instanceof ConcurrencyError);
    assert.strictEqual(err.level, ConcurrencyLevel.Project);

    assert.isTrue(projectGetResourceToScrapeStub.calledOnce);
  });

  it('getResourceToScrape, ConcurrencyError at Domain level', async () => {
    concurrency = new ConcurrencyManager({ domain: { maxRequests: 2, delay: 100 } });
    concurrency.status.domain['sitea.com'] = {
      requests: 2,
      lastStartTime: 0,
    };

    const resourceUpdateStub = sandbox.stub();
    const resourceStub = {
      url: 'http://siteA.com/resource.html',
      update: resourceUpdateStub,
      scrapeInProgress: true,
    };

    const projectGetResourceToScrapeStub = sandbox.stub().returns(resourceStub);

    let err;
    try {
      await concurrency.getResourceToScrape(<any>{ getResourceToScrape: projectGetResourceToScrapeStub });
    }
    catch (e) {
      err = e;
    }
    assert.isTrue(err instanceof ConcurrencyError);
    assert.strictEqual(err.level, ConcurrencyLevel.Domain);

    /*
    concurrency conditions at domain level prevent the newly found resource via project.getResourceToScrape to be scraped
    set the scrapeInProgress flag back to false and update the resource at db level
    resource will be eligible for scraping in the future
    */
    assert.isTrue(projectGetResourceToScrapeStub.calledOnce);
    assert.isFalse(resourceStub.scrapeInProgress);
    assert.isTrue(resourceUpdateStub.calledOnce);
  });

  it('getResourceToScrape, ConcurrencyError at Session level', async () => {
    concurrency = new ConcurrencyManager({ session: { maxRequests: 2, delay: 100 } });
    concurrency.status.session['none-sitea.com'] = {
      requests: 2,
      lastStartTime: 0,
    };

    const resourceUpdateStub = sandbox.stub();
    const resourceStub = {
      url: 'http://siteA.com/resource.html',
      update: resourceUpdateStub,
      scrapeInProgress: true,
    };

    const projectGetResourceToScrapeStub = sandbox.stub().returns(resourceStub);

    let err;
    try {
      await concurrency.getResourceToScrape(<any>{ getResourceToScrape: projectGetResourceToScrapeStub });
    }
    catch (e) {
      err = e;
    }
    assert.isTrue(err instanceof ConcurrencyError);
    assert.strictEqual(err.level, ConcurrencyLevel.Session);

    /*
    concurrency conditions at session level prevent the newly found resource via project.getResourceToScrape to be scraped
    set the scrapeInProgress flag back to false and update the resource at db level
    resource will be eligible for scraping in the future
    */
    assert.isTrue(projectGetResourceToScrapeStub.calledOnce);
    assert.isFalse(resourceStub.scrapeInProgress);
    assert.isTrue(resourceUpdateStub.calledOnce);
  });

  it('getResourceToScrape, resource found using no proxy', async () => {
    sandbox.stub(Date, 'now').returns(100);

    concurrency = new ConcurrencyManager();

    const resourceUpdateStub = sandbox.stub();
    const resourceStub = {
      url: 'http://siteA.com/resource.html',
      update: resourceUpdateStub,
      scrapeInProgress: true,
    };
    const projectGetResourceToScrapeStub = sandbox.stub().returns(resourceStub);

    const resource = await concurrency.getResourceToScrape(<any>{ getResourceToScrape: projectGetResourceToScrapeStub });
    assert.isNull(resource.proxy);
    assert.isTrue(resourceStub.scrapeInProgress);

    assert.isTrue(projectGetResourceToScrapeStub.calledOnce);
    assert.isTrue(resourceUpdateStub.notCalled);

    assert.deepEqual(
      concurrency.status,
      {
        project: {
          lastStartTime: 100,
          requests: 1,
        },
        proxy: {
          none: {
            lastStartTime: 100,
            requests: 1,
          },
        },
        domain: {
          'sitea.com': {
            lastStartTime: 100,
            requests: 1,
          },
        },
        session: {
          'none-sitea.com': {
            lastStartTime: 100,
            requests: 1,
          },
        },
      },
    );
  });

  it('getResourceToScrape, resource found using proxyPool', async () => {
    sandbox.stub(Date, 'now').returns(100);

    const proxy: Proxy = { host: 'proxyA', port: 80 };
    concurrency = new ConcurrencyManager({ proxyPool: [ proxy ] });

    const resourceUpdateStub = sandbox.stub();
    const resourceStub = {
      url: 'http://siteA.com/resource.html',
      update: resourceUpdateStub,
      scrapeInProgress: true,
    };
    const projectGetResourceToScrapeStub = sandbox.stub().returns(resourceStub);

    const resource = await concurrency.getResourceToScrape(<any>{ getResourceToScrape: projectGetResourceToScrapeStub });
    assert.deepEqual(resource.proxy, proxy);
    assert.isTrue(resourceStub.scrapeInProgress);

    assert.isTrue(projectGetResourceToScrapeStub.calledOnce);
    assert.isTrue(resourceUpdateStub.notCalled);

    assert.deepEqual(
      concurrency.status,
      {
        project: {
          lastStartTime: 100,
          requests: 1,
        },
        proxy: {
          'proxyA-80': {
            lastStartTime: 100,
            requests: 1,
          },
        },
        domain: {
          'sitea.com': {
            lastStartTime: 100,
            requests: 1,
          },
        },
        session: {
          'proxyA-80-sitea.com': {
            lastStartTime: 100,
            requests: 1,
          },
        },
      },
    );
  });
});
