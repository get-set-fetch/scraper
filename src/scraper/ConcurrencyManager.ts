/* eslint-disable max-classes-per-file */
/* eslint-disable consistent-return */
import { Project, Resource } from '..';
import { Proxy } from '../storage/base/Resource';

export const enum ConcurrencyLevel {
  Project = 'project', Proxy = 'proxy', Domain = 'domain', Session = 'session'
}

export class ConcurrencyError extends Error {
  level:ConcurrencyLevel;

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
  [key in 'project' | 'proxy' | 'domain' | 'session']?: ConcurrencyOptionsEntry;
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
   * - scrape each hostname sequentially with a 3s delay
   * - use each proxy sequentially with a 1s delay
   */
  static DEFAULT_OPTS:Partial<ConcurrencyOptions> = {
    domain: {
      maxRequests: 1,
      delay: 3000,
    },
    proxy: {
      maxRequests: 1,
      delay: 1000,
    },
  };

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
  stop:boolean;

  constructor(opts: Partial<ConcurrencyOptions> = {}) {
    this.opts = {
      // concurrency conditions at project/proxy/domain/session level
      project: opts.project,
      proxy: Object.assign(ConcurrencyManager.DEFAULT_OPTS.proxy, opts.proxy),
      domain: Object.assign(ConcurrencyManager.DEFAULT_OPTS.domain, opts.domain),
      session: opts.session,

      /*
      Proxies are used in a round-robin manner skiping unavailable ones.
      By default it contains a null entry meaning no proxy to be used.
      */
      proxyPool: opts.proxyPool || [ null ],
    };

    this.status = {
      project: {
        lastStartTime: 0,
        requests: 0,
      },
      proxy: {},
      domain: {},
      session: {},
    };
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
   * Under existing concurrency conditions:
   * return a resource if one is available
   * return null if there are no more resources to be scraped
   * return ConcurrencyError when concurrency conditions are not met
   */
  async getResourceToScrape(project:Project):Promise<Resource> {
    // project conditions don't allow it
    if (!this.conditionsMet(this.status.project, this.opts.project)) throw new ConcurrencyError(ConcurrencyLevel.Project);

    // abort if no proxy is available based on proxy conditions
    let proxy = this.getNextAvailableProxy();
    if (proxy === undefined) throw new ConcurrencyError(ConcurrencyLevel.Proxy);

    /*
    get a to-be-scraped resource

    in a worst case scenario scraping will not proceed at full capacity
    since we have available proxies but are throttled by domain/session concurrency conditions
    this is possible when we scrape from multiple domains and getResourceToScrape keeps retrieving resources from a single domain

    this won't be a problem when:
    - scraping a single domain
    - scraping lots of domains with few resources per domain

    this could be tweaked by:
      1) query sequentally possible to-be-scraped resources from different hostnames if no domain/proxy is available for the resource hostname
          - requires adding hostname as a db column to support query against it or endure some penalties querying using regexps
      2) retrieve at the same time multiple to-be-scraped resources (hopefully from different domains)
          - check if one can be scraped meeting the domain/session constraints
    */
    const resource = this.stop ? null : await project.getResourceToScrape();

    // no more resources available for scraping
    if (!resource) {
      // scraping project is complete, there is no in-progress scraping possibly adding new resources
      if (this.status.project.requests === 0) {
        return null;
      }

      /*
      either:
        - no resource available right now, but there may be more as in-progress scraping completes
        - project was stopped, only wait for in-progress scraping to complete
      */
      throw new ConcurrencyError(ConcurrencyLevel.Project);
    }

    // domain thresholds don't allow it
    const { hostname } = new URL(resource.url);
    if (!this.conditionsMet(this.status.domain[hostname], this.opts.domain)) {
      // re-make resource eligible for scraping by reseting the scrapeInProgress flag
      resource.scrapeInProgress = false;
      await resource.update();

      throw new ConcurrencyError(ConcurrencyLevel.Domain);
    }

    // session thresholds with the current proxy don't allow it, try to find a new proxy
    if (!this.conditionsMet(this.status.session[this.sessionId(proxy, hostname)], this.opts.session)) {
      proxy = this.getNextAvailableSessionProxy(hostname);
    }
    // abort if no proxy is available based on session thresholds
    if (proxy === undefined) {
      // re-make resource eligible for scraping by reseting the scrapeInProgress flag
      resource.scrapeInProgress = false;
      await resource.update();

      throw new ConcurrencyError(ConcurrencyLevel.Session);
    }

    // proxy meeting the concurrency conditions found
    resource.proxy = proxy;

    // update status
    this.addResource(proxy, hostname);

    return resource;
  }

  sessionId(proxy: Proxy, hostname: string):string {
    return `${this.proxyId(proxy)}-${hostname}`;
  }

  proxyId(proxy):string {
    return proxy ? `${proxy.host}-${proxy.port}` : 'none';
  }

  getNextProxy():Proxy {
    if (this.proxyIdx === undefined || this.proxyIdx === this.opts.proxyPool.length - 1) {
      this.proxyIdx = 0;
    }
    else {
      this.proxyIdx += 1;
    }

    return this.opts.proxyPool[this.proxyIdx];
  }

  getNextAvailableProxy():Proxy {
    let proxy:Proxy;
    let checkCount:number = 0;

    do {
      const candidateProxy = this.getNextProxy();
      proxy = this.conditionsMet(this.status.proxy[this.proxyId(candidateProxy)], this.opts.proxy) ? candidateProxy : undefined;
      checkCount += 1;
    }
    // loop ONCE through registed proxies and try to find an available one
    while (proxy === undefined && checkCount < this.opts.proxyPool.length
    );

    return proxy;
  }

  getNextAvailableSessionProxy(hostname: string):Proxy {
    let proxy:Proxy;
    let checkCount:number = 0;

    do {
      const candidateProxy = this.getNextProxy();
      proxy = this.conditionsMet(this.status.proxy[this.proxyId(candidateProxy)], this.opts.proxy)
      && this.conditionsMet(this.status.session[this.sessionId(candidateProxy, hostname)], this.opts.session)
        ? candidateProxy : undefined;

      checkCount += 1;
    }
    // loop ONCE through registerd proxies and try to find an available one
    while (proxy === undefined && checkCount < this.opts.proxyPool.length
    );

    return proxy;
  }

  conditionsMet(status: StatusEntry, opts: ConcurrencyOptionsEntry) {
    // no recorded requests for the current status, no threshold to compare against
    if (!status) return true;

    // no concurrency conditions defined at current level, no threshold to enforce
    if (!opts) return true;

    // max number of allowed parallel requests reached
    if (status.requests >= opts.maxRequests) return false;

    // still need to wait before making a new request
    if ((Date.now() - status.lastStartTime) < opts.delay) return false;

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
      lastStartTime: Date.now(),
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
  }
}
