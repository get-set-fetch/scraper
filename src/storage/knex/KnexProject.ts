/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
import { createReadStream } from 'fs';
import { pipeline, Writable } from 'stream';

import { Knex } from 'knex';
import Resource, { ResourceQuery } from '../base/Resource';
import Project from '../base/Project';
import KnexStorage from './KnexStorage';
import { getLogger } from '../../logger/Logger';
import { getUrlColIdx, normalizeUrl } from '../../plugins/url-utils';

/** @see {@link Project} */
export default class KnexProject extends Project {
  static storage:KnexStorage;

  static get builder() {
    return this.storage.knex('projects');
  }

  static async init(storage: KnexStorage):Promise<void> {
    this.storage = storage;

    const schemaBuilder = storage.knex.schema;
    const tablePresent = await schemaBuilder.hasTable('projects');
    if (tablePresent) return;

    await schemaBuilder.createTable(
      'projects',
      builder => {
        builder.increments('id').primary();
        builder.string('name');

        this.storage.jsonCol(builder, 'pluginOpts');
      },
    );

    // https://www.postgresql.org/message-id/20050810133157.GA46247@winnie.fuhr.org
    // https://www.citusdata.com/blog/2016/10/12/count-performance/
    if (this.storage.client === 'pg') {
      await this.storage.knex.raw(`
        CREATE FUNCTION count_estimate(query text) RETURNS integer AS $$
        DECLARE
            rec   record;
            rows  integer;
        BEGIN
            FOR rec IN EXECUTE 'EXPLAIN ' || query LOOP
                rows := substring(rec."QUERY PLAN" FROM ' rows=([[:digit:]]+)');
                EXIT WHEN rows IS NOT NULL;
            END LOOP;
        
        
            RETURN rows;
        END;
        $$ LANGUAGE plpgsql VOLATILE STRICT;
      `);
    }
  }

  static async get(nameOrId: number | string):Promise<Project> {
    const colName = Number.isInteger(nameOrId) ? 'id' : 'name';
    const rawProject = await this.builder.where({ [colName]: nameOrId }).first();
    return rawProject ? new this.storage.Project(rawProject) : undefined;
  }

  static getAll() {
    return this.builder.select();
  }

  static async delAll():Promise<void> {
    // since we're deleting all projects, it's safe to also delete all resources linked to them
    await this.storage.knex('resources').del();
    return this.builder.del();
  }

  static async getProjectToScrape() {
    const resourceToScrape:Resource = await this.storage.knex('resources').where({ scrapeInProgress: false, scrapedAt: null }).first();
    return resourceToScrape ? this.get(resourceToScrape.projectId) : null;
  }

  logger = getLogger('KnexProject');

  get Constructor():typeof KnexProject {
    return (<typeof KnexProject> this.constructor);
  }

  /**
   * Uses count(*) for exact counting. Just for postgresql uses ANALYZE output for count estimation.
   * Estimation is orders of magnitude faster than exact count.
   * @param estimate - whether to make an estimation or an exact count
   * @returns
   */
  async countResources(estimate?:boolean):Promise<number> {
    const { knex } = this.Constructor.storage;

    let selectCount:Knex.QueryBuilder;

    if (estimate && this.Constructor.storage.client === 'pg') {
      selectCount = (await knex.raw(`SELECT count_estimate('SELECT 1 FROM resources WHERE "projectId" = ${this.id}') as "count"`)).rows;
    }
    else {
      // regular table storage scan
      selectCount = this.Constructor.storage.Resource.builder.where('projectId', this.id).count('*', { as: 'count' });
    }

    const [ result ] = await selectCount;
    return typeof result.count === 'string' ? parseInt(result.count, 10) : result.count;
  }

  async countUnscrapedResources():Promise<number> {
    const [ result ] = await this.Constructor.storage.Resource.builder.where(
      { projectId: this.id, scrapedAt: null, scrapeInProgress: false },
    ).count('id', { as: 'count' });
    return typeof result.count === 'string' ? parseInt(result.count, 10) : result.count;
  }

  async save():Promise<number> {
    // save the project
    const result:number[] = await (
      this.Constructor.storage.capabilities.returning
        ? this.Constructor.builder.insert(this.toJSON()).returning('id')
        : this.Constructor.builder.insert(this.toJSON())
    );
    [ this.id ] = result;

    return this.id;
  }

  update():Promise<void> {
    return this.Constructor.builder.where('id', this.id).update(this.toJSON());
  }

  del() {
    return this.Constructor.builder.where('id', this.id).del();
  }

  getResource(url: string) {
    return this.Constructor.storage.Resource.getResource(this.id, url);
  }

  async getResources() {
    const rawResources = await this.Constructor.storage.Resource.getAll(this.id);
    return rawResources.map(rawResource => new this.Constructor.storage.Resource(rawResource));
  }

  async getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]> {
    // eslint-disable-next-line no-param-reassign
    query.where = { ...query.where, projectId: this.id };
    return this.Constructor.storage.Resource.getPagedResources(query);
  }

  getResourceToScrape() {
    return this.Constructor.storage.Resource.getResourceToScrape(this.id);
  }

  createResource(resource: Partial<Resource>) {
    return new this.Constructor.storage.Resource({ ...resource, projectId: this.id });
  }

  /**
   * Assumes resources contain only url and optionally depth.
   * All json and binary fields are undefined requiring no tranformation (JSON.strinfigy, Buffer.from, ...)
   * @param resources - resources to be saved
   * @param chunkSize - number of resources within a transaction
   */
  async batchInsertResources(resources: {url: string, depth?: number}[], chunkSize:number = 1000) {
    // assign projectId in place for faster processing
    resources.forEach(resource => {
      // eslint-disable-next-line no-param-reassign
      (<Resource>resource).projectId = this.id;

      try {
        resource.url = normalizeUrl(resource.url);
      }
      catch (err) {
        this.logger.error(err);
        delete resource.url;
      }
    });

    await this.Constructor.storage.knex.batchInsert('resources', resources.filter(resource => resource.url), chunkSize);
  }

  /**
   * Creates a stream pipeline from a reable file stream to a db writable stream. Attempts to keep memory usage down.
   * Input file contains an url per line.
   * @param resourcePath - input filepath
   * @param chunkSize - number of resources within a transaction
   */
  async batchInsertResourcesFromFile(resourcePath: string, chunkSize:number = 1000) {
    let resourceCount:number = 0;
    let resources: {url: string, projectId: number}[] = [];

    /*
    reading chunk by chunk, partialLine represents the last read line which can be incomplete
    parse it only on final when we have guarantee of its completness
    */
    let partialLine:string = '';
    let urlIdx:number;

    this.logger.info(`inserting resources from ${resourcePath}`);
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
                  const url = normalizeUrl(rawUrl);
                  resources.push({ url, projectId: this.id });
                }
                catch (err) {
                  this.logger.error(err);
                }
              });

              if (resources.length >= chunkSize) {
                await this.Constructor.storage.knex.batchInsert('resources', resources, chunkSize);
                resourceCount += resources.length;
                this.logger.info(`${resourceCount} total resources inserted`);
                resources = [];
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
                const url = normalizeUrl(rawUrl);
                resources.push({ url, projectId: this.id });
              }
              catch (err) {
                this.logger.error(err);
              }

              // insert pending resources
              if (resources.length > 0) {
                await this.Constructor.storage.knex.batchInsert('resources', resources, chunkSize);
                resourceCount += resources.length;
                this.logger.info(`${resourceCount} total resources inserted`);
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
   * Each resource is further transformed based on sql dialect requirements (JSON.strinfigy, Buffer.from, ...)
   * @param resources - resources to be saved
   */
  async saveResources(resources: Partial<Resource>[]) {
    for (let i = 0; i < resources.length; i += 1) {
      const resource = new this.Constructor.storage.Resource(
        Object.assign(resources[i], { projectId: this.id }),
      );
      await resource.save();
    }
  }

  toJSON() {
    return this.Constructor.storage.toJSON(this);
  }
}
