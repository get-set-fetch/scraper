import Entity, { IEntity } from './Entity';

export interface IResourceContent {
  [key: string]: string[]
}

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
  content: IResourceContent;
  blob: Blob;

  // stored as json string, initialized as IResourceParent[]
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
  }

  get dbCols() {
    return [ 'id', 'siteId', 'url', 'depth', 'scrapedAt', 'scrapeInProgress', 'contentType', 'content', 'blob', 'parent' ];
  }
}

export interface IStaticResource extends IEntity {
  new(kwArgs: Partial<Resource>): Resource;
  getResource(siteId:number, url: string):Promise<Resource>;
  getAll(siteId: number):Promise<any[]>;
  getResourceToCrawl(siteId:number):Promise<Resource>;
}
