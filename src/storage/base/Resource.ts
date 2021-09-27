import Entity, { IStaticEntity } from './Entity';

export type IResourceParent = {
  linkText?: string;
  imgAlt?: string;
  title?: string;
}

export type Proxy = {
  host: string;
  port: number;
}

/** Each url (web page, image, API endpoint, ...) represents a Resource. */
export default abstract class Resource extends Entity {
  id: number;
  projectId: number;
  url: string;
  actions: string[];

  depth: number;
  scrapedAt: Date;
  scrapeInProgress: boolean;

  /** response status code */
  status: number;

  /** response content-type */
  contentType: string;

  /** Stores text based content.
   * Data rows with each row containing one or multiple entries.
   * Usually each entry corresponds to content from a CSS selector.
   */
  content: string[][];

  /** Stores binary content. */
  data: Uint8Array;

  parent: IResourceParent;

  /** not stored, populated by the ExtractUrlsPlugin and saved as new resources by the InsertResourcesPlugin */
  resourcesToAdd: Partial<Resource>[];

  /** not stored, populated by ConcurrencyManager based on the available proxy pool. If present, plugins should use this proxy when making requests. */
  proxy: Proxy;

  constructor(kwArgs: Partial<Resource> = {}) {
    super(kwArgs);

    if (!kwArgs.depth) {
      this.depth = 0;
    }

    this.scrapeInProgress = !!this.scrapeInProgress;

    if (kwArgs.scrapedAt && !(kwArgs.scrapedAt instanceof Date)) {
      this.scrapedAt = new Date(kwArgs.scrapedAt);
    }

    if (typeof kwArgs.content === 'string') {
      this.content = JSON.parse(kwArgs.content);
    }

    if (typeof kwArgs.parent === 'string') {
      this.parent = JSON.parse(kwArgs.parent);
    }

    if (typeof kwArgs.actions === 'string') {
      this.actions = JSON.parse(kwArgs.actions);
    }
  }

  get dbCols() {
    return [ 'id', 'projectId', 'url', 'actions', 'depth', 'scrapedAt', 'scrapeInProgress', 'status', 'contentType', 'content', 'data', 'parent' ];
  }

  /**
   * Only serialize some properties when invoking plugins in DOM with a Resource argument
   */
  toExecJSON() {
    const jsonObj = { ...this.toJSON() };

    /*
    plugins running in DOM don't need the resource binary content
    it's not worth passing it from node to DOM since it can take lots of memory
    */
    delete jsonObj.data;

    return jsonObj;
  }
}

export type ResourceQuery = {
  offset: number;
  limit: number;
  where: Partial<{
    projectId: number;
    [prop: string]: string|number;
  }>,
  whereNotNull: string[],
  cols: string[];
}

export interface IStaticResource extends IStaticEntity {
  new(kwArgs: Partial<Resource>): Resource;
  getResource(projectId:number, url: string):Promise<Resource>;
  getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]>;
  getAll(projectId: number):Promise<any[]>;
  getResourceToScrape(projectId:number):Promise<Resource>;
}
