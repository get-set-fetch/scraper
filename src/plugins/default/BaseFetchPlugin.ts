/* eslint-disable max-classes-per-file */
import { Project } from '../..';
import BrowserClient from '../../browserclient/BrowserClient';
import Resource from '../../storage/base/Resource';
import Plugin from '../Plugin';

export class FetchError extends Error {
  status:number;
  redirectUrl: string;

  constructor(status: number, redirectUrl?:string) {
    super();
    this.status = status;
    this.redirectUrl = redirectUrl;
  }
}

export default abstract class BaseFetchPlugin extends Plugin {
  /**
   * check against 2xx codes and an optional list of allowed status
   * @param status response status code
   */
  isValidStatus(status:number, allowedStatus: number[] = []) {
    return Math.floor(status / 100) === 2 || allowedStatus.includes(status);
  }

  /**
   *  check against 3xx codes
   * @param status response status code
   */
  isRedirectStatus(status:number) {
    return Math.floor(status / 100) === 3;
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
      result = await this.fetch(resource, client);
    }
    catch (err) {
      return this.fetchErrResult(err);
    }

    return result;
  }

  fetchErrResult(err:Error) {
    if (err instanceof FetchError) {
      const { status, redirectUrl } = err;
      /*
      redirect detected
      for the current resource return redirect status
      also add the final url as a new resource to be scraped
      don't return contentType as many plugin use it as testing condition and we don't want the original redirect url to be scraped
      */
      if (this.isRedirectStatus(status)) {
        return {
          status,
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

  /**
   * Extract just the content type, not the full header value
   * @param rawContentType : like 'text/html; charset=UTF-8'
   */
  getContentType(rawContentType: string):string {
    if (rawContentType) {
      const matchArr = rawContentType.match(/^[^;]+/);
      return matchArr ? matchArr[0] : null;
    }
    return null;
  }

  abstract fetch(resource: Resource, client?: BrowserClient, opts?:RequestInit);
}
