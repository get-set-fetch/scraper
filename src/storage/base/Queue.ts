import { createReadStream } from 'fs';
import { pipeline, Writable } from 'stream';
import { LogWrapper, getLogger } from '../../logger/Logger';
import Resource, { IResourceParent } from './Resource';
import { getUrlColIdx, normalizeUrl } from '../../plugins/url-utils';
import Project from './Project';
import Connection from './Connection';

export type QueueEntry = {
  id: string | number;
  url: string;

  /** Initial urls with depth 0 are kept and used as starting points for each (re)scrape. */
  depth: number;

  /**
   * Not yet scraped urls have NULL status.
   * Scrape in progress is denoted by status = 1.
   * Succesfull scraping updates status to the http(s) response status.
   * Failed scraping updates status to the http(s) 3xx, 4xx, 5xx response status (if present) or 500 with an additional custom error code.
   * DNS errors, network timeouts, connection reset are considered 500 server errors.
   * Urls with error status codes can be re-scraped.
   */
  status: number;

  /**
   * Custom error codes in addition or outside http response status thrown by plugin execution like connection or parsing errors.
   */
  error?: string;

  parent?: IResourceParent;
}

/**
 * API targets CRUD at db table queue level with each project having its own queue.
 * It does not target individual queue entries.
 * The queue table has the <QueueEntry> columns.
 */
export default class Queue {
  static storage:IQueueStorage;
  static ExtResource:typeof Resource;

  logger: LogWrapper = getLogger('Queue');

  /**
   * Find a resource to scrape and update its queue status
   * @returns - null if no to-be-scraped resource has been found
   */
  async getResourcesToScrape(limit:number = 10):Promise<Resource[]> {
    const queueEntries:QueueEntry[] = await this.Constructor.storage.getResourcesToScrape(limit);

    if (queueEntries && queueEntries.length > 0) {
      return queueEntries
        .map(queueEntry => new (this.Constructor.ExtResource)({
          queueEntryId: queueEntry.id,
          url: queueEntry.url,
          depth: queueEntry.depth,
          parent: queueEntry.parent,
        }));
    }

    return [];
  }

  async add(entries: Partial<QueueEntry>[], chunkSize:number = 1000):Promise<void> {
    if (entries.length === 0) return;

    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const serializedEntries = chunk.map(
        (entry:QueueEntry) => Object.assign(entry, { parent: entry.parent ? JSON.stringify(entry.parent) : entry.parent }),
      );

      // eslint-disable-next-line no-await-in-loop
      await this.Constructor.storage.add(serializedEntries);
    }
  }

  async filterNewUrls(urls: string[]):Promise<string[]> {
    const existingEntries:Partial<QueueEntry>[] = await this.Constructor.storage.filterExistingEntries(urls);
    const existingUrls = existingEntries.map(queueEntry => queueEntry.url);
    return urls.filter(url => !existingUrls.includes(url));
  }

  updateStatus(id: number | string, status: number, error?: string):Promise<void> {
    return this.Constructor.storage.updateStatus(id, status, error);
  }

  count() {
    return this.Constructor.storage.count();
  }

  getAll():Promise<QueueEntry[]> {
    return this.Constructor.storage.getAll();
  }

  get Constructor():typeof Queue {
    return (<typeof Queue> this.constructor);
  }

  /**
   * Assumes resources contain only url and optionally depth.
   * @param resources - resources to be saved
   * @param chunkSize - number of resources within a transaction
   */
  async normalizeAndAdd(resources: {url: string, depth?: number}[], chunkSize:number = 1000):Promise<void> {
    const toBeInserted: typeof resources = [];

    resources.forEach(resource => {
      try {
        toBeInserted.push({
          url: normalizeUrl(resource.url),
          depth: resource.depth || 0,
        });
      }
      catch (err) {
        this.logger.error(err);
      }
    });

    if (toBeInserted.length > 0) {
      this.logger.info(`add ${toBeInserted.length} urls`);
      await this.add(toBeInserted, chunkSize);
    }
  }

  /**
   * Creates a stream pipeline from a reable file stream to a db writable stream. Attempts to keep memory usage down.
   * Input file contains an url per line.
   * @param resourcePath - input filepath
   * @param chunkSize - number of resources within a transaction
   */
  async addFromFile(resourcePath: string, chunkSize:number = 1000):Promise<void> {
    let urlCount:number = 0;

    let urls: {url: string}[] = [];

    /*
      reading chunk by chunk, partialLine represents the last read line which can be incomplete
      parse it only on final when we have guarantee of its completness
      */
    let partialLine:string = '';
    let urlIdx:number;

    this.logger.info(`inserting urls from ${resourcePath}`);
    await new Promise<void>((resolve, reject) => {
      const readStream = createReadStream(resourcePath);

      const writeStream = new Writable({
        write: async (chunk, encoding, done) => {
          try {
            const chunkContent:string = partialLine + Buffer.from(chunk).toString('utf-8');
            const chunkLines = chunkContent.split(/\r?\n/);
            partialLine = chunkLines.pop();

            if (chunkLines.length > 0) {
              // find out on what position on the csv row is the url
              if (urlIdx === undefined) {
                urlIdx = getUrlColIdx(chunkLines[0]);
              }

              chunkLines.forEach(line => {
                const rawUrl = line.split(',')[urlIdx];
                try {
                  urls.push({ url: normalizeUrl(rawUrl) });
                }
                catch (err) {
                  this.logger.error(err);
                }
              });

              if (urls.length >= chunkSize) {
                await this.normalizeAndAdd(urls, chunkSize);
                urlCount += urls.length;
                this.logger.info(`${urlCount} total urls inserted`);
                urls = [];
              }
            }
          }
          catch (err) {
            this.logger.error(err);
          }

          done();
        },

        final: async done => {
          try {
            // try to retrieve a new resources from the now complete last read line
            if (partialLine.length > 0) {
              // find out on what position on the csv row is the url
              if (urlIdx === undefined) {
                urlIdx = getUrlColIdx(partialLine);
              }

              const rawUrl = partialLine.split(',')[urlIdx];
              try {
                urls.push({ url: normalizeUrl(rawUrl) });
              }
              catch (err) {
                this.logger.error(err);
              }

              // insert pending resources
              if (urls.length > 0) {
                await this.normalizeAndAdd(urls, chunkSize);
                urlCount += urls.length;
                this.logger.info(`${urlCount} total resources inserted`);
              }
            }
          }
          catch (err) {
            this.logger.error(err);
            reject(err);
          }
          done();
        },
      });

      const onComplete = async err => {
        if (err) {
          this.logger.error(err);
          reject(err);
        }
        else {
          resolve();
        }
      };

      pipeline(readStream, writeStream, onComplete);
    });

    this.logger.info(`inserting resources from ${resourcePath} done`);
  }
}

export interface IQueueStorage {
  conn: Connection;

  init(project:Project):Promise<void>;
  add(entries: QueueEntry[]):Promise<void>;
  getAll():Promise<QueueEntry[]>;
  count():Promise<number>;
  updateStatus(id: number | string, status: number, error?: string):Promise<void>;
  getResourcesToScrape(limit:number):Promise<QueueEntry[]>;
  filterExistingEntries(urls: string[]):Promise<Partial<QueueEntry>[]>;
  drop():Promise<void>;
}
