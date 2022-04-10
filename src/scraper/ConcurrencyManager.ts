/* eslint-disable max-classes-per-file */
/* eslint-disable consistent-return */
import Project from '../storage/base/Project';
import { getLogger } from '../logger/Logger';
import Resource, { Proxy } from '../storage/base/Resource';

export const enum ConcurrencyLevel {
  Project = 'project', Proxy = 'proxy', Domain = 'domain', Session = 'session'
}

export class ConcurrencyError extends Error {
  level: ConcurrencyLevel;

  constructor(level: ConcurrencyLevel) {
    super();
    this.level = level;
  }
}

export type ConcurrencyOptionsEntry = {
  maxRequests: number;
  /**
   * Minimum delay between initiating a resource scrape process
   */
  delay: number;
}

export type ConcurrencyOptions = {
  [key in 'project' | 'proxy' | 'domain' | 'session']?: Partial<ConcurrencyOptionsEntry>;
} & {
  proxyPool: Proxy[];
}

export type StatusEntry = {
  lastStartTime: number;
  requests: number;
}

/**
 * Keeps granular tracking of in-progress parallel requests
 */
export type Status = {
  /**
   * time - last request time across all proxies, domains, sessions for the target project
   * requests - total in-progress parallel requests
   */
  project: StatusEntry;

  /**
   * keys are constructed from proxy.hostname + proxy.port
   * proxy.time - last request using this proxy
   * proxy.requests - in-progress parallel requests using this proxy
   */
  proxy: {
    [key: string]: StatusEntry;
  },

  /**
   * keys are constructed from target url hostname
   * hostname.time - last request for this domain
   * hostname.requests - in-progress parallel requests for this domain
   */
  domain: {
    [key: string]: StatusEntry;
  }

  /**
   * keys are constructed from proxy.hostname + proxy.port + target url hostname
   * session.time - last request from this session
   * session.requests - in-progress parallel requests in this session
   */
  session: {
    [key: string]: StatusEntry;
  }
}

/**
 * Responsible for selecting resources to be scraped based on project, proxy, domain and session concurrency options.
 */
export default class ConcurrencyManager {
  /**
   * by default:
   * - scrape each hostname sequentially with a 1s delay
   * - use each proxy sequentially with a 0.5s delay
   */
  static DEFAULT_OPTS: Partial<ConcurrencyOptions> = {
    domain: {
      maxRequests: 1,
      delay: 1000,
    },
    proxy: {
      maxRequests: 1,
      delay: 500,
    },
  };

  logger = getLogger('ConcurrencyManager');

  opts: ConcurrencyOptions;
  status: Status;

  /**
   * Current proxy index
   */
  proxyIdx: number;

  /**
   * If set no new resources are selected to be scraped.
   * Once all in-progress scraping completes, a "project-stopped" event is dispathed.
   */
  stop: boolean;

  /**
   * Serves two purposes
   * - to-be-scraped resources are retrieved in bulk with queue entry status set to 1 (scrape in progress)
   * - non-eligible buffered resources (due to concurrency conditions) don't have the in-progress status reverted,
   *  they remain in buffer surely to become eligible in the future
   */
  resourceBuffer: Resource[];

  resourceBufferSize: number;

  error: Error;

  /**
   * Prevents parallel project.queue.getResourcesToScrape calls
   */
  refillBufferInProgress: boolean;

  /**
   * Only used when logging is set to trace mode.
   * Keeps a map of scrape-in-progress resources: key: url, value: start time (ms).
   */
  inProgressUrls:Map<string, number>;

  constructor(opts: Partial<ConcurrencyOptions> = {}) {
    this.opts = {
      // concurrency conditions at project/proxy/domain/session level
      project: opts.project || {},
      proxy: Object.assign(ConcurrencyManager.DEFAULT_OPTS.proxy, opts.proxy),
      domain: Object.assign(ConcurrencyManager.DEFAULT_OPTS.domain, opts.domain),
      session: opts.session,

      /*
      Proxies are used in a round-robin manner skiping unavailable ones.
      By default it contains a null entry meaning no proxy to be used.
      */
      proxyPool: opts.proxyPool || [ null ],
    };

    // if missing compute project.maxRequests based on number of proxies and proxy.maxRequests
    if (!this.opts.project.maxRequests) {
      this.opts.project.maxRequests = this.opts.proxy.maxRequests * this.opts.proxyPool.length;
    }
    this.logger.info(this.opts, 'concurrency options:');

    /*
    compute buffer size based on project.maxRequests, enforce a minimum buffer size
    multiplier value of 2 is kind of arbitrary:
      - too little and scraping may briefly pause due to an empty buffer
      - too large and we needlessly mark to-be-scraped resources as in progress so that other scraper instances can't touch them
    */
    this.resourceBufferSize = Math.max(this.opts.project.maxRequests * 2, 10);

    this.status = {
      project: {
        lastStartTime: null,
        requests: 0,
      },
      proxy: {},
      domain: {},
      session: {},
    };

    this.resourceBuffer = [];

    this.resourceScraped = this.resourceScraped.bind(this);
    this.resourceError = this.resourceError.bind(this);

    if (this.logger.level === 'trace') {
      this.inProgressUrls = new Map();
    }
  }

  /**
   * Interval to check for a new to-be-scraped resource availability
   */
  getCheckInterval() {
    // check interval is resolved as the minimum enforced delay (if defined) at project/proxy/domain/session level
    return Math.min(
      ...Array.from(Object.keys(this.opts))
        .filter(key => this.opts[key] && this.opts[key].delay)
        .map(key => this.opts[key].delay),
    );
  }

  /**
   * Scraping is complete:
   * A) when there are no scrape-in-progress resources and buffer is empty
   * not good enough, in a distributed environment there may be scrape-in-progress resources on other scraper instances
   * B) when there are no scrape-in-progress resources AND buffer is empty for a 'considerable' amount of time
   * 'considerable' amount of time can be something like 3 standard deviations above the mean resource scrape time
   *  mean resource scrape time is not computed atm, a hardcoded value is presently used
   */
  isScrapingComplete(): boolean {
    // no results found, check if scraping is complete
    if (this.resourceBuffer.length === 0) {
      // no more scrape-in-progress resources
      if (this.status.project.requests === 0) {
        /*
        buffer was empty for more than it takes to scrape a resource in a worst case scenario
        any other distributed scraper instances have also finished scraping
        there are no scrape-in-progress resources capable of discovering new to-be-scraped resources
        */
        if (this.status.project.lastStartTime) {
          const maxResourceScrapeTime = 1 * 1000;
          if (Date.now() - this.status.project.lastStartTime > maxResourceScrapeTime) {
            return true;
          }
        }
        // scraping hasn't start for any resource, the buffer is empty even after the 1st attempt to fill it
        else {
          return true;
        }
      }
    }

    return false;
  }

  async refillBuffer(project:Project):Promise<void> {
    // buffer is only filled sequentially
    if (this.refillBufferInProgress) return;

    try {
      this.refillBufferInProgress = true;
      const toBeScrapedResources = await project.queue.getResourcesToScrape(this.resourceBufferSize - this.resourceBuffer.length);
      this.resourceBuffer.push(...toBeScrapedResources);
      this.refillBufferInProgress = false;
    }
    catch (err) {
      /*
      parent call doesn't wait for this async to finish thus can't catch it, store err separately
      can't recover from not being able to refill the buffer
      fatal flag will cause scraping to stop AFTER currently scrape-in-progress resources are scraped
      */
      this.error = Object.assign(err, { fatal: true });
    }
  }

  /**
   * Under existing concurrency conditions:
   * return a resource if one is available
   * return null if there are no more resources to be scraped
   * return ConcurrencyError when concurrency conditions are not met
   */
  async getResourceToScrape(project: Project): Promise<Resource> {
    // project conditions don't allow it
    if (!this.conditionsMet(this.status.project, this.opts.project)) throw new ConcurrencyError(ConcurrencyLevel.Project);

    // abort if no proxy is available based on proxy conditions
    let proxy = this.getNextAvailableProxy();
    if (proxy === undefined) throw new ConcurrencyError(ConcurrencyLevel.Proxy);

    /*
    get a to-be-scraped resource

    in a worst case scenario scraping will not proceed at full capacity
    since we have available proxies but are throttled by domain/session concurrency conditions
    this is possible when we scrape from multiple domains and getResourcesToScrape keeps retrieving resources from a single domain

    this won't be a problem when:
    - scraping a single domain
    - scraping lots of domains with few resources per domain

    can be partially mitigated by keeping an in-memory resource buffer allowing to test all entries for met concurrency conditions
    */
    let resource;

    // stop signal has been received, gracefully stop scraping, allow all scrape-in-progress resources to be scraped
    if (this.stop) {
      resource = null;

      if (this.resourceBuffer.length > 0) {
        // re-make to-be-scraped buffered resources eligible for scraping by reseting their status flag
        await Promise.all(this.resourceBuffer.map(resource => project.queue.updateStatus(resource.queueEntryId, null)));
        this.resourceBuffer = [];
      }

      // all scrape-in-progress resources have been scraped
      if (this.status.project.requests === 0) {
        return null;
      }
    }
    // normal scraping
    else {
      /*
      stop signal was received due to buffer error in an independent async call, throw the error up
      parent scraper will catch any errors and stop the process via concurrency.stop = true
      */
      if (this.error) throw (this.error);

      // attemp to re-fill buffer before it's completely empty
      if (this.resourceBuffer.length < this.resourceBufferSize / 2) {
        // buffer needs to be refilled now, can't refill it independently, we risk isScrapingComplete condition to pass
        if (this.resourceBuffer.length === 0) {
          await this.refillBuffer(project);
          // take advantage of waiting for refillBuffer, directly thrown the error if one was caught
          // avoid isScrapingComplete returning true on empty buffer due to refillBuffer error
          if (this.error) throw (this.error);
        }
        // refill buffer independently
        else {
          this.refillBuffer(project);
        }
      }

      if (this.isScrapingComplete()) {
        return null;
      }

      // in the future, don't just retrieve the 1st resource, attempt to search for one meeting the concurrency conditions
      resource = this.resourceBuffer.length > 0 ? this.resourceBuffer.shift() : null;
    }

    /*
    either:
    - no resource available right now, but there may be more as in-progress scraping completes
    - project was stopped, only wait for in-progress scraping to complete
    */
    if (!resource) {
      throw new ConcurrencyError(ConcurrencyLevel.Project);
    }

    // domain thresholds don't allow it
    const { hostname } = new URL(resource.url);
    if (!this.conditionsMet(this.status.domain[hostname], this.opts.domain)) {
      // new resource is not meeting concurrency conditions, postpone its scraping, re-add it to the buffer
      this.resourceBuffer.push(resource);

      throw new ConcurrencyError(ConcurrencyLevel.Domain);
    }

    // session thresholds with the current proxy don't allow it, try to find a new proxy
    if (!this.conditionsMet(this.status.session[this.sessionId(proxy, hostname)], this.opts.session)) {
      proxy = this.getNextAvailableSessionProxy(hostname);
    }
    // abort if no proxy is available based on session thresholds
    if (proxy === undefined) {
      // new resource is not meeting concurrency conditions, postpone its scraping, re-add it to the buffer
      this.resourceBuffer.push(resource);

      throw new ConcurrencyError(ConcurrencyLevel.Session);
    }

    // proxy meeting the concurrency conditions found
    resource.proxy = proxy;

    // update status
    this.addResource(proxy, hostname);
    this.logger.debug({ proxy, url: resource.url }, 'resource added to concurrency status');

    if (this.logger.level === 'trace') {
      this.inProgressUrls.set(resource.url, Date.now());
      this.logger.trace(`In-Progress URLs: ${Array.from(this.inProgressUrls.entries()).join(';')}`);
    }

    return resource;
  }

  sessionId(proxy: Proxy, hostname: string): string {
    return `${this.proxyId(proxy)}-${hostname}`;
  }

  proxyId(proxy): string {
    return proxy ? `${proxy.host}-${proxy.port}` : 'none';
  }

  getNextProxy(): Proxy {
    if (this.proxyIdx === undefined || this.proxyIdx === this.opts.proxyPool.length - 1) {
      this.proxyIdx = 0;
    }
    else {
      this.proxyIdx += 1;
    }

    return this.opts.proxyPool[this.proxyIdx];
  }

  getNextAvailableProxy(): Proxy {
    let proxy: Proxy;
    let checkCount: number = 0;

    do {
      const candidateProxy = this.getNextProxy();
      proxy = this.conditionsMet(this.status.proxy[this.proxyId(candidateProxy)], this.opts.proxy) ? candidateProxy : undefined;
      checkCount += 1;
    }
    // loop ONCE through registered proxies and try to find an available one
    while (proxy === undefined && checkCount < this.opts.proxyPool.length);

    return proxy;
  }

  getNextAvailableSessionProxy(hostname: string): Proxy {
    let proxy: Proxy;
    let checkCount: number = 0;

    do {
      const candidateProxy = this.getNextProxy();
      proxy = this.conditionsMet(this.status.proxy[this.proxyId(candidateProxy)], this.opts.proxy)
        && this.conditionsMet(this.status.session[this.sessionId(candidateProxy, hostname)], this.opts.session)
        ? candidateProxy : undefined;

      checkCount += 1;
    }
    // loop ONCE through registered proxies and try to find an available one
    while (proxy === undefined && checkCount < this.opts.proxyPool.length);

    return proxy;
  }

  conditionsMet(status: StatusEntry, opts: Partial<ConcurrencyOptionsEntry>) {
    // no recorded requests for the current status, no threshold to compare against
    if (!status) return true;

    // no concurrency conditions defined at current level, no threshold to enforce
    if (!opts) return true;

    // max number of allowed parallel requests reached
    if (opts.maxRequests && status.requests >= opts.maxRequests) return false;

    // still need to wait before making a new request
    if (opts.delay && (Date.now() - status.lastStartTime) < opts.delay) return false;

    return true;
  }

  addResource(proxy: Proxy, hostname: string) {
    this.status.project = this.addResourceToStatus(this.status.project);
    this.status.proxy[this.proxyId(proxy)] = this.addResourceToStatus(this.status.proxy[this.proxyId(proxy)]);
    this.status.domain[hostname] = this.addResourceToStatus(this.status.domain[hostname]);
    this.status.session[this.sessionId(proxy, hostname)] = this.addResourceToStatus(this.status.session[this.sessionId(proxy, hostname)]);
  }

  addResourceToStatus(status: StatusEntry) {
    if (!status) {
      return {
        lastStartTime: Date.now(),
        requests: 1,
      };
    }

    return {
      lastStartTime: Date.now(),
      requests: status.requests + 1,
    };
  }

  removeResource(proxy: Proxy, hostname: string) {
    this.status.project = this.removeResourceFromStatus(this.status.project);
    this.status.proxy[this.proxyId(proxy)] = this.removeResourceFromStatus(this.status.proxy[this.proxyId(proxy)]);
    this.status.domain[hostname] = this.removeResourceFromStatus(this.status.domain[hostname]);
    this.status.session[this.sessionId(proxy, hostname)] = this.removeResourceFromStatus(this.status.session[this.sessionId(proxy, hostname)]);
  }

  removeResourceFromStatus(status: StatusEntry) {
    return {
      lastStartTime: status.lastStartTime,
      requests: status.requests - 1,
    };
  }

  /**
   * Resource succesfully scraped. Update concurrency status accordingly.
   * @param project
   * @param resource
   */
  resourceScraped(project: Project, resource: Resource) {
    const { hostname } = new URL(resource.url);
    this.removeResource(resource.proxy, hostname);

    this.logger.debug({ proxy: resource.proxy, url: resource.url }, 'resource scraped and removed from concurrency status');
    if (this.logger.level === 'trace') {
      this.inProgressUrls.delete(resource.url);
    }
  }

  /**
   * This should identify if the error is related to proxy: not working, blocked by captcha, ...
   * A no longer working proxy should be removed from the proxy pool.
   * Atm, it just updates concurrency status. It doesn't affect the proxy pool.
   * @param project
   * @param resource
   */
  resourceError(project: Project, resource: Resource) {
    const { hostname } = new URL(resource.url);
    this.removeResource(resource.proxy, hostname);

    this.logger.debug({ proxy: resource.proxy, url: resource.url }, 'resource scraped in error and removed from concurrency status');
    if (this.logger.level === 'trace') {
      this.inProgressUrls.delete(resource.url);
    }
  }
}
