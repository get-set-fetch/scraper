import Resource, { ResourceQuery } from '../base/Resource';
import KnexStorage from './KnexStorage';

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
        builder.integer('siteId');
        builder.string('url');
        builder.integer('depth');
        builder.dateTime('scrapedAt');
        builder.boolean('scrapeInProgress');
        builder.string('contentType');

        this.storage.jsonCol(builder, 'content');
        this.storage.jsonCol(builder, 'parent');
        this.storage.jsonCol(builder, 'actions');

        this.storage.binaryCol(builder, 'data');
      },
    );
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

  static getAll(siteId: number) {
    return this.builder.where({ siteId });
  }

  static async getResource(siteId:number, url: string):Promise<Resource> {
    const rawResource = await this.builder.where({ siteId, url }).first();
    return rawResource ? new this.storage.Resource(rawResource) : undefined;
  }

  static delAll():Promise<void> {
    return this.builder.del();
  }

  // find a resource to crawl and set its scrapeInProgress flag
  static async getResourceToCrawl(siteId:number):Promise<Resource> {
    let resource:Resource = null;

    await this.storage.knex.transaction(async trx => {
      // block SELECT FOR UPDATE execution of other concurrent transactions till the current one issues a COMMIT
      const rawResource = await this.builder
        .transacting(trx).forUpdate()
        // try to find a resource matching {siteId, scrapeInProgress : false, scrapedAt: undefined}
        .where({ siteId, scrapeInProgress: false, scrapedAt: null })
        .first();

      if (rawResource) {
        resource = new this.storage.Resource(rawResource);
        resource.scrapeInProgress = true;
        await this.builder.transacting(trx).where('id', resource.id).update('scrapeInProgress', true);
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

  update():Promise<void> {
    return this.Constructor.builder.where('id', this.id).update(this.toJSON());
  }

  del() {
    return this.Constructor.builder.where('id', this.id).del();
  }

  toJSON() {
    return this.Constructor.storage.toJSON(this);
  }
}
