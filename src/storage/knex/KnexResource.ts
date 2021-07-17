import Resource, { ResourceQuery } from '../base/Resource';
import KnexStorage from './KnexStorage';

/** @see {@link Resource} */
export default class KnexResource extends Resource {
  static storage:KnexStorage;

  static get builder() {
    return this.storage.knex('resources');
  }

  static async init(storage: KnexStorage):Promise<void> {
    this.storage = storage;

    const schemaBuilder = storage.knex.schema;
    const tablePresent = await schemaBuilder.hasTable('resources');
    if (tablePresent) return;

    await schemaBuilder.createTable(
      'resources',
      builder => {
        builder.increments('id').primary();
        builder.integer('projectId');
        builder.string('url');
        builder.integer('depth').defaultTo(0);
        builder.dateTime('scrapedAt');
        builder.boolean('scrapeInProgress').defaultTo(false);
        builder.integer('status');
        builder.string('contentType');

        this.storage.jsonCol(builder, 'content');
        this.storage.jsonCol(builder, 'parent');
        this.storage.jsonCol(builder, 'actions');

        this.storage.binaryCol(builder, 'data');
      },
    );

    /*
    pg optimizations
    1. create index for getResourceToScrape:
    */
    if (storage.client === 'pg') {
      await storage.knex.raw('CREATE INDEX resources_toscrape_idx ON resources ("projectId") WHERE ("scrapeInProgress" = false) AND ("scrapedAt" IS NULL);');
    }
  }

  static async get(resourceId:number):Promise<Resource> {
    const rawResource = await this.builder.where({ id: resourceId }).first();
    return rawResource ? new this.storage.Resource(rawResource) : undefined;
  }

  static async getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]> {
    const { cols, where, whereNotNull, offset, limit } = query;

    let queryBuilder = this.builder.select(cols || [ 'url', 'content' ]).where(where);
    if (offset !== undefined) {
      queryBuilder = queryBuilder.offset(offset);
    }
    if (limit !== undefined) {
      queryBuilder = queryBuilder.limit(limit);
    }
    if (whereNotNull) {
      whereNotNull.forEach(notNullCol => {
        queryBuilder = queryBuilder.whereNotNull(notNullCol);
      });
    }

    const rawResources:any[] = await queryBuilder;

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

  static getAll(projectId: number) {
    return this.builder.where({ projectId });
  }

  static async getResource(projectId:number, url: string):Promise<Resource> {
    const rawResource = await this.builder.where({ projectId, url }).first();
    return rawResource ? new this.storage.Resource(rawResource) : undefined;
  }

  static delAll():Promise<void> {
    return this.builder.del();
  }

  /**
   * Find a resource to scrape and set its scrapeInProgress flag
   * @param projectId - which project to extract the resource from
   * @returns - null if no to-be-scraped resource has been found
   */
  static async getResourceToScrape(projectId:number):Promise<Resource> {
    let resource:Resource = null;

    // pg optimization
    if (this.storage.client === 'pg') {
      const query = this.storage.knex.raw(
        `
          update "resources" set "scrapeInProgress" = true
          where "id" = (
            select "id" from "resources" 
            where "projectId" = ? and "scrapeInProgress" = false and "scrapedAt" is null 
            limit 1 
            for update skip locked
          )
          returning "id", "url", "depth";
        `,
        projectId,
      );

      const result = await query;

      if (result.rows && result.rows.length === 1) {
        const [ rawResource ] = await result.rows;
        return new this.storage.Resource({ ...rawResource, projectId, scrapeInProgress: true, scrapedAt: null });
      }

      return null;
    }

    // generic approach
    await this.storage.knex.transaction(async trx => {
      const rawResource = await this.builder
        .transacting(trx)
        .where({ projectId, scrapeInProgress: false, scrapedAt: null })
        .first()
        .forUpdate();

      if (rawResource) {
        await this.builder.transacting(trx).where('id', rawResource.id).update('scrapeInProgress', true);
        await trx.commit();
        resource = new this.storage.Resource(rawResource);
        resource.scrapeInProgress = true;
      }
    });

    return resource;
  }

  get Constructor():typeof KnexResource {
    return (<typeof KnexResource> this.constructor);
  }

  async save():Promise<number> {
    const result:number[] = await (
      this.Constructor.storage.capabilities.returning
        ? this.Constructor.builder.insert(this.toJSON()).returning('id')
        : this.Constructor.builder.insert(this.toJSON())
    );
    [ this.id ] = result;

    return this.id;
  }

  async update():Promise<void> {
    await this.Constructor.builder.where('id', this.id).update(this.toJSON());
  }

  del() {
    return this.Constructor.builder.where('id', this.id).del();
  }

  toJSON() {
    return this.Constructor.storage.toJSON(this);
  }
}
