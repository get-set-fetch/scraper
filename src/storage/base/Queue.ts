import { LogWrapper } from '../../logger/Logger';
import { ModelCombination } from '../storage-utils';
import Resource, { IResourceParent } from './Resource';
import Storage from './Storage';

export type QueueEntry = {
  id?: number;
  url: string;

  /** Initial urls with depth 0 are kept and used as starting points for each (re)scrape. */
  depth: number;

  /**
   * Not yet scraped urls have NULL status.
   * Scrape in progress is denoted by status = 1.
   * Succesfull scraping updates status to the http(s) response status.
   * Failed scraping updates status to the http(s) response status or custom error code if blocking is detected.
   * Urls with error status codes can be re-scraped.
   */
  status: number;

  parent?: IResourceParent;
}

/**
 * API targets CRUD at db table queue level with each project having its own queue.
 * It does not target individual queue entries.
 * The queue table has the <QueueEntry> columns.
 */
export default abstract class Queue {
  logger: LogWrapper;

  abstract getResourcesToScrape(limit:number):Promise<Resource[]>;
  abstract batchInsertResources(resources: {url: string, depth?: number}[], chunkSize?:number):Promise<void>;
  abstract batchInsertResourcesFromFile(resourcePath: string, chunkSize?:number):Promise<void>;
  abstract add(entries: Partial<QueueEntry>[]):Promise<void>;
  abstract checkIfPresent(urls:string[]):Promise<Partial<QueueEntry>[]>;

  abstract count():Promise<number>;
  abstract updateStatus(id: number, status: number):Promise<void>;

  abstract getAll():Promise<QueueEntry[]>;

  get Constructor():typeof Queue & IStaticQueue {
    return (<typeof Queue & IStaticQueue> this.constructor);
  }
}

export interface IStaticQueue {
  storage: Storage;
  models: ModelCombination;
  projectId: number;

  new(): Queue;
  init():Promise<void>;

  drop():Promise<void>;
}
