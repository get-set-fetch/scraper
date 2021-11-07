/* eslint-disable no-param-reassign */
import { createReadStream } from 'fs';
import { pipeline, Writable } from 'stream';
import { Knex } from 'knex';
import { getUrlColIdx, normalizeUrl } from '../../plugins/url-utils';
import Queue, { IStaticQueue, QueueEntry } from '../base/Queue';
import KnexStorage from './KnexStorage';
import Resource, { IStaticResource } from '../base/Resource';
import { getLogger } from '../../logger/Logger';
import { ModelCombination } from '../storage-utils';

export default class KnexQueue extends Queue {
  static storage:KnexStorage;
  static models: ModelCombination;
  static projectId: number;

  static get tableName():string {
    if (!this.projectId) throw new Error('projectId not set');
    return `${this.projectId}-queue`;
  }

  static async init():Promise<void> {
    if (!this.projectId) throw new Error('projectId not set');

    const schemaBuilder = this.storage.knex.schema;
    const tablePresent = await schemaBuilder.hasTable(this.tableName);
    if (tablePresent) return;

    await schemaBuilder.createTable(
      this.tableName,
      builder => {
        builder.increments('id').primary();
        builder.string('url').index(`ix_${this.projectId}_url`).unique();
        builder.integer('depth').defaultTo(0);

        if (this.storage.client === 'pg') {
          builder.specificType('status', 'smallint');
        }
        else {
          builder.integer('status');
        }

        this.storage.jsonCol(builder, 'parent');
      },
    );

    /*
    pg optimizations
    - hash index on resource.url
        - starting with pg 10 hash indexes support Write-Ahead-Logging
        - it makes sense to do a hash index on url since we only check for equality (if an url already exists)
        - we can't use hash indexes with unique constraints though
        - unfortunately inserts with ignore on 'url' conflict are only possible with B-tree indexes
        - such inserts are used by the InsertResourcesPlugin to save new resources without pre-checking for already present urls
        - fallback to default B-tree indexes via knex.index()
    - HOT updates
        - are possible since variable length scraped content is stored in another table
        - don't have much impact since we need to rebuild the status index on update (status is the only queue column being updated)
    */
  }

  static async drop() {
    const hasTable = await this.storage.knex.schema.hasTable(this.tableName);
    if (hasTable) {
      // drop index
      await new Promise<void>(async (resolve, reject) => {
        try {
          await this.storage.knex.schema.table(
            this.tableName,
            async t => {
              await t.dropUnique([ 'url' ], `ix_${this.projectId}_url`);
              resolve();
            },
          );
        }
        catch (err) {
          reject(err);
        }
      });

      // drop table
      await this.storage.knex.schema.dropTable(this.tableName);
    }
  }

  logger = getLogger('KnexQueue');

  get Constructor():typeof KnexQueue & IStaticQueue {
    return (<typeof KnexQueue & IStaticQueue> this.constructor);
  }

  get builder() {
    return this.Constructor.storage.knex(this.Constructor.tableName);
  }

  getAll():Promise<QueueEntry[]> {
    return this.builder.select();
  }

  /**
   * Find a resource to scrape and update its queue status
   * @returns - null if no to-be-scraped resource has been found
   */
  async getResourcesToScrape(limit:number = 10):Promise<Resource[]> {
    let queueEntries:QueueEntry[];

    // pg optimization
    if (this.Constructor.storage.client === 'pg') {
      const query = this.Constructor.storage.knex.raw<{rows: QueueEntry[]}>(
        `
          update ?? set "status" = 1
          where "id" in (
            select "id" from ?? 
            where status is null
            limit ? 
            for update skip locked
          )
          returning "id", "url", "depth", "parent";
        `,
        [ this.Constructor.tableName, this.Constructor.tableName, limit ],
      );

      const result = await query;
      queueEntries = result.rows;
    }
    // generic approach
    else {
      await this.Constructor.storage.knex.transaction(async trx => {
        queueEntries = await this.builder
          .transacting(trx)
          .whereNull('status')
          .limit(limit)
          .forUpdate();

        if (queueEntries && queueEntries.length > 0) {
          await Promise.all(queueEntries.map(queueEntry => this.builder.transacting(trx).where('id', queueEntry.id).update('status', 1)));
        }
        await trx.commit();
      });
    }

    if (queueEntries && queueEntries.length > 0) {
      return queueEntries
        .map(queueEntry => new (<IStaticResource> this.Constructor.models.Resource)({
          queueEntryId: queueEntry.id,
          url: queueEntry.url,
          depth: queueEntry.depth,
          parent: queueEntry.parent,
        }));
    }

    return [];
  }

  /**
   * Assumes resources contain only url and optionally depth.
   * @param resources - resources to be saved
   * @param chunkSize - number of resources within a transaction
   */
  async batchInsertResources(resources: {url: string, depth?: number}[], chunkSize:number = 1000) {
    resources.forEach(resource => {
      try {
        resource.url = normalizeUrl(resource.url);
      }
      catch (err) {
        this.logger.error(err);
        delete resource.url;
      }
    });

    const toBeInserted = resources.filter(resource => resource.url);
    this.logger.info(`batchInsert ${toBeInserted.length} urls`);
    await this.Constructor.storage.knex.batchInsert(this.Constructor.tableName, toBeInserted, chunkSize);
  }

  /**
   * Creates a stream pipeline from a reable file stream to a db writable stream. Attempts to keep memory usage down.
   * Input file contains an url per line.
   * @param resourcePath - input filepath
   * @param chunkSize - number of resources within a transaction
   */
  async batchInsertResourcesFromFile(resourcePath: string, chunkSize:number = 1000) {
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
                await this.Constructor.storage.knex.batchInsert(this.Constructor.tableName, urls, chunkSize);
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
                await this.Constructor.storage.knex.batchInsert(this.Constructor.tableName, urls, chunkSize);
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

  /**
   * Number of unscraped resources linked to current project.
   * Uses count(*) for exact counting. Just for postgresql uses ANALYZE output for count estimation.
   * Estimation is orders of magnitude faster than exact count.
   * @param estimate - whether to make an estimation or an exact count
   * @returns
   */
  async countUnscrapedResources(estimate?:boolean):Promise<number> {
    let selectCount:Knex.QueryBuilder;

    if (estimate && this.Constructor.storage.client === 'pg') {
      selectCount = (await this.Constructor.storage.knex.raw(
        'SELECT count_estimate(\'SELECT 1 FROM ?? WHERE  "status" = NULL\') as "count"',
        this.Constructor.tableName,
      )).rows;
    }
    else {
      // regular table storage scan
      selectCount = this.builder.whereNull('status').count('id', { as: 'count' });
    }

    const [ result ] = await selectCount;
    return typeof result.count === 'string' ? parseInt(result.count, 10) : result.count;
  }

  /**
   * Number of total resources linked to current project.
   * Uses count(*) for exact counting. Just for postgresql uses ANALYZE output for count estimation.
   * Estimation is orders of magnitude faster than exact count.
   * @param estimate - whether to make an estimation or an exact count
   * @returns
   */
  async countResources(estimate?:boolean):Promise<number> {
    let selectCount:Knex.QueryBuilder;

    if (estimate && this.Constructor.storage.client === 'pg') {
      selectCount = (await this.Constructor.storage.knex.raw(
        'SELECT count_estimate(\'SELECT 1 FROM ??\') as "count"',
        this.Constructor.tableName,
      )).rows;
    }
    else {
      // regular table storage scan
      selectCount = this.builder.count('*', { as: 'count' });
    }

    const [ result ] = await selectCount;
    return typeof result.count === 'string' ? parseInt(result.count, 10) : result.count;
  }

  async updateStatus(id: number, status: number):Promise<void> {
    await this.builder.where('id', id).update({ status });
  }

  async add(entries: QueueEntry[]) {
    if (entries.length === 0) return;

    const serializedEntries = entries.map(
      (entry:QueueEntry) => Object.assign(entry, { parent: entry.parent ? JSON.stringify(entry.parent) : entry.parent }),
    );
    await this.builder.insert(serializedEntries).onConflict('url').ignore();
  }

  checkIfPresent(urls: string[]):Promise<Partial<QueueEntry>[]> {
    return this.builder.select('url').whereIn('url', urls);
  }
}
