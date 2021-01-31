/* eslint-disable max-classes-per-file */
import { SchemaType } from '../../schema/SchemaHelper';
import Plugin from '../Plugin';
import Project from '../../storage/base/Project';
import Resource from '../../storage/base/Resource';
import BrowserClient from '../../browserclient/BrowserClient';
import { DomStabilityStatus, waitForDomStability } from '../utils';
import * as MimeTypes from '../../export/MimeTypes.json';
import { getLogger } from '../../logger/Logger';

class FetchError extends Error {
  status:number;
  redirectStatus:number;
  redirectUrl: string;

  constructor(status: number, redirectStatus?:number, redirectUrl?:string) {
    super();
    this.status = status;
    this.redirectStatus = redirectStatus;
    this.redirectUrl = redirectUrl;
  }
}

/** Opens html resources in a browser tab. Downloads binary resources. */
export default class FetchPlugin extends Plugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Fetch Plugin',
      description: 'depending on resource type (binary, html), either downloads or opens in the scraping tab the resource url.',
      properties: {
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

  logger = getLogger('FetchPlugin');
  opts: SchemaType<typeof FetchPlugin.schema>;

  constructor(opts:SchemaType<typeof FetchPlugin.schema> = {}) {
    super(opts);
  }

  test(project: Project, resource: Resource) {
    if (!resource || !resource.url) return false;

    // only fetch a resource that hasn't been fetched yet
    if (resource.contentType) return false;

    // only http/https supported
    const { protocol } = new URL(resource.url);
    return protocol === 'http:' || protocol === 'https:';
  }

  async apply(project: Project, resource: Resource, client: BrowserClient):Promise<Partial<Resource>> {
    let result:Partial<Resource>;

    try {
      // url is of html mime type, loaded it in a browser tab
      if (await this.isHtml(resource, client)) {
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
      if (err instanceof FetchError) {
        const { status, redirectStatus, redirectUrl } = err;
        /*
        redirect detected
        for the current resource return redirect status
        also add the final url as a new resource to be scraped
        don't return contentType as many plugin use it as testing condition and we don't want the original redirect url to be scraped
        */
        if (redirectStatus) {
          return {
            status: redirectStatus,
            resourcesToAdd: [ { url: redirectUrl } ],
          };
        }

        /*
        all other fetch errors
        don't return contentType as many plugin use it as testing condition and we don't want the original redirect url to be scraped
        */
        return {
          status,
        };
      }

      // errors not related to fetch status code
      throw err;
    }

    return result;
  }

  /**
   * 2xx and 304 (Not Modified) are valid
   * @param status response status code
   */
  isStatusValid(status:number) {
    return Math.floor(status / 100) === 2 || status === 304;
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

    this.logger.trace(headers, 'retrieved fetch headers');

    // don't have access to initial redirect status can't chain back to the original redirect one, always put 301
    if (redirected) {
      throw new FetchError(status, 301, url);
    }

    // don't proceed further unless we have a valid status
    if (!this.isStatusValid(status)) {
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
    const response = await client.goto(resource.url, { waitUntil: 'networkidle0' });
    const redirectResponse = await client.getRedirectResponse(response.request());

    if (redirectResponse) {
      throw new FetchError(response.status(), redirectResponse.status(), response.url());
    }

    if (!this.isStatusValid(response.status())) {
      throw new FetchError(response.status());
    }

    // what follows is status 2xx handling
    const contentType:string = await client.evaluate(() => document.contentType);

    if (/html/.test(contentType) && this.opts.stabilityCheck > 0) {
      const stabilityStatus:DomStabilityStatus = await client.evaluate(waitForDomStability, { stabilityCheck: this.opts.stabilityCheck, stabilityTimeout: this.opts.stabilityTimeout });
      if (stabilityStatus !== DomStabilityStatus.Stable) {
        throw new Error(`DOM not stable after stabilityTimeout of ${this.opts.stabilityTimeout}`);
      }
    }

    return { contentType, status: response.status() };
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
