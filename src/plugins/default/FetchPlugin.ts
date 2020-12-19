import { SchemaType } from '../../schema/SchemaHelper';
import Plugin from '../Plugin';
import Site from '../../storage/base/Site';
import Resource from '../../storage/base/Resource';
import BrowserClient from '../../browserclient/BrowserClient';

export default class FetchPlugin extends Plugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Fetch Plugin',
      description: 'depending on resource type (binary, html), either downloads or opens in the scraping tab the resource url.',
      properties: {
        stabilityTimeout: {
          type: 'integer',
          default: 0,
          title: 'Stability Timeout',
          description: 'Considers the page loaded and ready to be scraped when there are no more DOM changes within the specified amount of time (milliseconds). Only applies to html resources. Useful for bypassing preloader content.',
        },
        maxStabilityWaitingTime: {
          type: 'integer',
          default: 0,
          title: 'Max Stability Waiting Time',
          description: 'Maximum waiting time (miliseconds) for achieving DOM stability in case of a continuously updated DOM (ex: timers, countdowns).',
        },
      },
    } as const;
  }

  opts: SchemaType<typeof FetchPlugin.schema>;

  constructor(opts:SchemaType<typeof FetchPlugin.schema> = {}) {
    super(opts);
  }

  test(site: Site, resource: Resource) {
    if (!resource || !resource.url) return false;

    // only fetch a resource that hasn't been fetched yet
    if (resource.contentType) return false;

    // only http/https supported
    const { protocol } = new URL(resource.url);
    return protocol === 'http:' || protocol === 'https:';
  }

  apply(site: Site, resource: Resource, client: BrowserClient) {
    // url appears to be of html mime type, loaded it in a browser tab
    if (this.probableHtmlMimeType(resource.url)) {
      return this.openInTab(site, resource, client);
    }

    // url appears to be a non html mime type, download it and store it as blob
    return this.fetch(resource, client);
  }

  // fetch resource via builtin fetch
  fetch(resource: Resource, client: BrowserClient):Promise<Partial<Resource>> {
    return client.evaluate(
      (url: string) => new Promise(async (resolve, reject) => {
        try {
          const response = await fetch(url, { method: 'GET', credentials: 'include' });
          if (response.blob) {
            const blob = await response.blob();
            resolve({ blob, contentType: blob.type });
          }
        }
        catch (err) {
          reject(err);
        }
      }),
      resource.url,
    );
  }

  async openInTab(site: Site, resource: Resource, client:BrowserClient):Promise<Partial<Resource>> {
    const response = await client.goto(resource.url, { waitUntil: 'networkidle0' });

    // to do add response status handling, 4xx, 5xx, for now assume it's 200
    const contentType:string = await client.evaluate(() => document.contentType);

    if (/html/.test(contentType) && this.opts.stabilityTimeout > 0) {
      await client.evaluate(this.waitForDomStability, this.opts.stabilityTimeout, this.opts.maxStabilityWaitingTime);
    }

    // in case of redirects also return the updated resource url
    return response.url() === resource.url
      ? { contentType }
      : { contentType, url: response.url(), redirectOrigin: resource.url };
  }

  probableHtmlMimeType(urlStr: string) {
    const { pathname } = new URL(urlStr);
    const extensionMatch = /^.*\.(.+)$/.exec(pathname);

    // no extension found, most probably html
    if (!extensionMatch) {
      return true;
    }

    // extension found, test it against most probable extensions of html compatible mime types
    const ext = extensionMatch[1];
    return /htm|php/.test(ext);
  }

  waitForDomStability(timeout: number, maxWaitingTime: number):Promise<void> {
    return new Promise(resolve => {
      const startTime = Date.now();

      const waitResolve = observer => {
        observer.disconnect();
        resolve();
      };

      let timeoutId;
      const observer = new MutationObserver((mutationList, observer) => {
        for (let i = 0; i < mutationList.length; i += 1) {
          // we only care if new nodes have been added
          if (mutationList[i].type === 'childList') {
            /*
            we've waited for stability to be reached long enough,
            don't reset the timer again and allow waitForDomStability to resolve
            */
            if (maxWaitingTime > 0 && Date.now() - startTime > maxWaitingTime) {
              return;
            }

            // restart the countdown timer
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(waitResolve, timeout, observer);
            break;
          }
        }
      });

      timeoutId = setTimeout(waitResolve, timeout, observer);

      // start observing document.body
      observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    });
  }
}
