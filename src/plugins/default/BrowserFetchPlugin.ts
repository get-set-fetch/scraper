import { SchemaType } from '../../schema/SchemaHelper';
import Project from '../../storage/base/Project';
import Resource from '../../storage/base/Resource';
import BrowserClient from '../../browserclient/BrowserClient';
import { DomStabilityStatus, waitForDomStability } from '../dom-utils';
import * as MimeTypes from '../../export/MimeTypes.json';
import { getLogger } from '../../logger/Logger';
import BaseFetchPlugin, { FetchError } from './BaseFetchPlugin';

/** Opens html resources in a browser tab. Downloads binary resources. */
export default class BrowserFetchPlugin extends BaseFetchPlugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Browser Fetch Plugin',
      description: 'depending on resource type (binary, html), either downloads or opens in the scrape tab the resource url.',
      properties: {
        gotoOptions: {
          type: 'object',
          description: 'navigation parameters',
          properties: {
            timeout: {
              description: 'maximum navigation time in milliseconds',
              type: 'integer',
              default: 30000,
            },
            waitUntil: {
              description: 'when to consider navigation succeeded',
              type: 'string',
              default: 'domcontentloaded',
            },
          },
        },
        stabilityCheck: {
          type: 'integer',
          default: 0,
          title: 'Stability Check',
          description: 'Considers the page loaded and ready to be scraped when there are no more DOM changes within the specified amount of time (milliseconds). Only applies to html resources. Useful for bypassing preloader content.',
        },
        stabilityTimeout: {
          type: 'integer',
          default: 0,
          title: 'Max Stability Waiting Time',
          description: 'Maximum waiting time (miliseconds) for achieving DOM stability in case of a continuously updated DOM (ex: timers, countdowns).',
        },
      },
    } as const;
  }

  logger = getLogger('BrowserFetchPlugin');
  opts: SchemaType<typeof BrowserFetchPlugin.schema>;

  constructor(opts:SchemaType<typeof BrowserFetchPlugin.schema> = {}) {
    super(opts);
  }

  async apply(project: Project, resource: Resource, client: BrowserClient):Promise<Partial<Resource>> {
    let result:Partial<Resource>;

    try {
      // url is of html mime type, loaded it in a browser tab
      if (await this.isHtml(resource, client)) {
        this.logger.debug('resource determined to be html');
        result = await this.openInTab(resource, client);
      }
      /*
      url is of non html mime type,
      download it and store it as Uint8Array compatible with both nodejs and browser env
      */
      else {
        result = await this.fetch(resource, client);
      }
    }
    catch (err) {
      return this.fetchErrResult(err);
    }

    return result;
  }

  // fetch resource via builtin fetch
  async fetch(resource: Resource, client: BrowserClient, opts:RequestInit = {}):Promise<Partial<Resource>> {
    /*
    trying to load a resource from a different domain, CORS is in effect
    open the external url in a new browser tab
    only afterwards attempt to fetch it now that we're on the same domain
    this will request the resource twice, hopefully the 2nd time will be cached ...
    open just the external hostname as the full external url may trigger a browser download, not supported in chrome headless
    */

    if (this.isCorsActive(client.getUrl(), resource.url)) {
      await client.goto(new URL('/', resource.url).toString(), { waitUntil: 'load' });
    }

    const { binaryString, headers, status, redirected, url }:
    {binaryString: string, headers: {[key: string]: string}, status:number, redirected: boolean, url: string} = await client.evaluate(
      ({ url, opts }:{url: string, opts:RequestInit}) => new Promise(async (resolve, reject) => {
        try {
          const response = await fetch(url, { method: 'GET', credentials: 'include', ...opts });
          const { status, headers, redirected, url: finalUrl } = response;

          // Headers instance toJSON() produces an empty obj, manually serialize
          const headerObj = Array.from(headers.keys()).reduce(
            (acc, k) => Object.assign(acc, { [k.toLowerCase()]: headers.get(k) }),
            {},
          );
          const isHtml = /html/.test(headerObj['content-type']);

          if (!isHtml) {
            const blob = await response.blob();
            const reader = new FileReader();
            reader.readAsBinaryString(blob);
            reader.onload = () => {
              resolve({ binaryString: reader.result, headers: headerObj, status, redirected, url: finalUrl });
            };
            reader.onerror = () => {
              throw Error('error reading binary string');
            };
          }
          else {
            resolve({ headers: headerObj, status, redirected, url: finalUrl });
          }
        }
        catch (err) {
          reject(err);
        }
      }),
      { url: resource.url, opts },
    );

    this.logger.trace({ redirected, status, headers }, 'retrieved fetch headers');

    // don't have access to initial redirect status can't chain back to the original redirect one, always put 301
    if (redirected) {
      throw new FetchError(301, url);
    }

    // don't proceed further unless we have a valid status
    if (!this.isValidStatus(status)) {
      throw new FetchError(status);
    }

    const result:Partial<Resource> = {
      status,
      contentType: headers['content-type'],
    };

    if (binaryString) {
      result.data = Buffer.from(binaryString, 'binary');
    }

    return result;
  }

  async openInTab(resource: Resource, client:BrowserClient):Promise<Partial<Resource>> {
    const response = await client.goto(resource.url, this.opts.gotoOptions);
    const redirectResponse = await client.getRedirectResponse(response.request());

    this.logger.debug({ status: response.status() }, 'openInTab response');

    /*
    if the url has no extension, fetch HEADER was invoked to determine contentType, opening the html resource in tab will result in 304
    add the extra status to the allowed ones
    */
    if (!this.isValidStatus(response.status(), [ 304 ])) {
      throw new FetchError(response.status());
    }

    // what follows is status 2xx handling
    const contentType:string = await client.evaluate(() => document.contentType);

    if (/html/.test(contentType) && this.opts.stabilityCheck > 0) {
      const stabilityStatus:DomStabilityStatus = await client.evaluate(waitForDomStability, { stabilityCheck: this.opts.stabilityCheck, stabilityTimeout: this.opts.stabilityTimeout });
      if (stabilityStatus === DomStabilityStatus.Unstable) {
        throw new Error(`DOM not stable after stabilityTimeout of ${this.opts.stabilityTimeout}`);
      }
    }

    const result:Partial<Resource> = {
      status: response.status(),
      contentType,
    };

    /*
    both puppeteer and playwright follow redirects automatically
    puppeteer can control/abort redirects via page.setRequestInterception
    playwright can't: https://github.com/microsoft/playwright/issues/3993
    the redirect origin needs to be saved as an already scraped resource so we don't keep visiting it
    current valid resource will have the its url updated to the last redirect location
    */
    if (redirectResponse) {
      result.resourcesToAdd = [ {
        status: redirectResponse.status(),
        url: redirectResponse.url(),
      } ];
      result.url = response.url();
    }

    return result;
  }

  isCorsActive(originUrl: string, toBeFetchedUrl: string):boolean {
    return new URL(originUrl).hostname !== new URL(toBeFetchedUrl).hostname;
  }

  getExtension(urlStr: string) {
    const { pathname } = new URL(urlStr);
    const extensionMatch = /^.*\.(.+)$/.exec(pathname);

    return extensionMatch ? extensionMatch[1] : null;
  }

  async isHtml(resource: Resource, client:BrowserClient):Promise<boolean> {
    const ext = this.getExtension(resource.url);

    let isHtml:boolean;

    // try to determine if resource is scrapable (html content) based on extension type
    if (ext) {
      if (/htm/.test(ext)) {
        isHtml = true;
      }
      else if (Object.values(MimeTypes).includes(ext)) {
        isHtml = false;
      }
    }

    // extension type is missing from url or not present in the list of registered MimeTypes
    if (isHtml === undefined) {
      // just fetch the headers, returned contentType will be used to determine if resource is an html one
      const { contentType } = await this.fetch(resource, client, { method: 'HEAD' });
      isHtml = /htm/.test(contentType);
    }

    return isHtml;
  }
}
