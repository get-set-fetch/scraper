import { LogWrapper, getLogger } from '../../logger/Logger';
import Connection from './Connection';
import Entity from './Entity';
import Project from './Project';
import { QueueEntry } from './Queue';

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
export default class Resource extends Entity {
  static storage:IResourceStorage;

  static async get(resourceId:string | number):Promise<Resource> {
    const rawResource = await this.storage.get(resourceId);
    return rawResource ? new this(rawResource) : undefined;
  }

  static getAll():Promise<Resource[]> {
    return this.storage.getAll();
  }

  static async getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]> {
    const rawResources:any[] = await this.storage.getPagedResources(query);

    // json value returned as string not obj, parse the content string into proper json obj
    if (rawResources.length > 0 && typeof rawResources[0].content === 'string') {
      return rawResources.map(rawResource => Object.assign(rawResource, { content: JSON.parse(rawResource.content) }));
    }

    // json value returned as string not obj, parse the parent string into proper json obj
    if (rawResources.length > 0 && typeof rawResources[0].parent === 'string') {
      return rawResources.map(rawResource => Object.assign(rawResource, { parent: JSON.parse(rawResource.parent) }));
    }

    // no conversion required
    return rawResources;
  }

  static async getResource(url: string):Promise<Resource> {
    const rawResource = await this.storage.getResource(url);
    return rawResource ? new this(rawResource) : undefined;
  }

  static delAll():Promise<void> {
    return this.storage.delAll();
  }

  static count() {
    return this.storage.count();
  }

  logger: LogWrapper = getLogger('Resource');

  url: string;
  actions: string[];

  depth: number;
  scrapedAt: Date;

  /** response status code */
  status: number;

  /** response content-type */
  contentType: string;

  /**
   * Stores text based content.
   * Data rows with each row containing one or multiple entries.
   * Usually each entry corresponds to content from a CSS selector.
   */
  content: string[][];

  /** Stores binary content. */
  data: Uint8Array;

  parent: IResourceParent;

  /** not stored, populated by the ExtractUrlsPlugin and saved as new resources by the InsertResourcesPlugin */
  resourcesToAdd: Partial<QueueEntry>[];

  /** not stored, populated by ConcurrencyManager based on the available proxy pool. If present, plugins should use this proxy when making requests. */
  proxy: Proxy;

  /** not stored, provides a link to the corresponding scrape queue entry */
  queueEntryId: number | string;

  get Constructor():typeof Resource {
    return (<typeof Resource> this.constructor);
  }

  constructor(kwArgs: Partial<Resource> = {}) {
    super(kwArgs);

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
    return [ 'id', 'url', 'actions', 'depth', 'scrapedAt', 'status', 'contentType', 'content', 'data', 'parent' ];
  }

  toJSON() {
    return this.Constructor.storage.toJSON(this);
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

  async save() {
    this.id = await this.Constructor.storage.save(this);
    return this.id;
  }

  del():Promise<void> {
    return this.Constructor.storage.del(this.id);
  }
}

export type ResourceQuery = {
  offset: number;
  limit: number;
  where: Partial<{
    [prop: string]: string|number;
  }>,
  whereIn: {
    [prop: string]: string[]|number[];
  }
  whereNotNull: string[],
  cols: string[];
}

export interface IResourceStorage {
  conn: Connection;

  init(project:Project):Promise<void>;
  save(resource: Resource):Promise<number>;
  get(id: string | number):Promise<Entity>;
  getResource(url: string):Promise<Resource>;
  getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]>
  getAll():Promise<Resource[]>;
  count():Promise<number>;
  delAll():Promise<void>;
  del(id: string | number):Promise<void>;
  drop():Promise<void>;
  toJSON(entity);
}
