import Entity, { IEntity } from './Entity';

export interface IResourceParent {
  linkText?: string;
  imgAlt?: string;
  title?: string;
}

export default abstract class Resource extends Entity {
  id: number;
  siteId: number;
  url: string;
  actions: string[];

  depth: number;
  scrapedAt: Date;
  scrapeInProgress: boolean;

  contentType: string;
  content: string[][];
  data: Uint8Array;

  parent: IResourceParent;

  // not stored, populated by the ExtractUrlsPlugin and saved as new resources by the InsertResourcesPlugin
  resourcesToAdd: Partial<Resource>[];

  /*
  not stored, in case of redirect the resource is updated with the final url,
  need to save a separate "empty" resource with the initial url to avoid re-scraping it
  */
  redirectOrigin: string;

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
    return [ 'id', 'siteId', 'url', 'actions', 'depth', 'scrapedAt', 'scrapeInProgress', 'contentType', 'content', 'data', 'parent' ];
  }
}

export type ResourceQuery = {
  offset: number;
  limit: number;
  where: {
    siteId: number;
    [prop: string]: string|number;
  },
  whereNotNull: string[],
  cols: string[];
}

export interface IStaticResource extends IEntity {
  new(kwArgs: Partial<Resource>): Resource;
  getResource(siteId:number, url: string):Promise<Resource>;
  getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]>;
  getAll(siteId: number):Promise<any[]>;
  getResourceToCrawl(siteId:number):Promise<Resource>;
}
