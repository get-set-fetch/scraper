import { QueryBuilder } from 'knex';
import Resource from '../base/Resource';
import KnexStorage from './KnexStorage';

export default class KnexResource extends Resource {
  static get builder():QueryBuilder {
    return KnexStorage.knex('resources');
  }

  static async init():Promise<void> {
    const schemaBuilder = KnexStorage.knex.schema;

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

        if (KnexStorage.capabilities.jsonb) {
          builder.jsonb('content');
          builder.jsonb('parent');
          builder.jsonb('actions');
        }
        else if (KnexStorage.capabilities.json) {
          builder.json('content');
          builder.json('parent');
          builder.json('actions');
        }
        else {
          builder.string('content');
          builder.string('parent');
          builder.string('actions');
        }

        builder.binary('blob');
      },
    );
  }

  static async get(resourceId:number):Promise<Resource> {
    const rawResource = await KnexResource.builder.where({ id: resourceId }).first();
    return rawResource ? new KnexResource(rawResource) : undefined;
  }

  static async getPagedContent(siteId: number, offset: number, limit: number):Promise<Partial<Resource>[]> {
    const rawResources:any[] = await KnexResource.builder.select('url', 'content').where({ siteId }).offset(offset).limit(limit);

    // json value returned as string not obj, parse the content string into proper json obj
    if (rawResources.length > 0 && typeof rawResources[0].content === 'string') {
      return rawResources.map(rawResource => Object.assign(rawResource, { content: JSON.parse(rawResource.content) }));
    }

    // no conversion required
    return rawResources;
  }

  static getAll(siteId: number) {
    return KnexResource.builder.where({ siteId });
  }

  static async getResource(siteId:number, url: string):Promise<Resource> {
    const rawResource = await KnexResource.builder.where({ siteId, url }).first();
    return rawResource ? new KnexResource(rawResource) : undefined;
  }

  static delAll():Promise<void> {
    return KnexResource.builder.del();
  }

  // find a resource to crawl and set its scrapeInProgress flag
  static async getResourceToCrawl(siteId:number):Promise<KnexResource> {
    let resource:KnexResource = null;

    await KnexStorage.knex.transaction(async trx => {
      // block SELECT FOR UPDATE execution of other concurrent transactions till the current one issues a COMMIT
      const rawResource = await KnexResource.builder
        .transacting(trx).forUpdate()
        // try to find a resource matching {siteId, scrapeInProgress : false, scrapedAt: undefined}
        .where({ siteId, scrapeInProgress: false, scrapedAt: null })
        .first();

      if (rawResource) {
        resource = new KnexResource(rawResource);
        resource.scrapeInProgress = true;
        await KnexResource.builder.transacting(trx).where('id', resource.id).update('scrapeInProgress', true);
      }
    });

    return resource;
  }

  async save():Promise<number> {
    const result:number[] = await (
      this.capabilities.returning
        ? KnexResource.builder.insert(this.toJSON()).returning('id')
        : KnexResource.builder.insert(this.toJSON())
    );
    [ this.id ] = result;

    return this.id;
  }

  update():Promise<void> {
    return KnexResource.builder.where('id', this.id).update(this.toJSON());
  }

  del() {
    return KnexResource.builder.where('id', this.id).del();
  }

  get capabilities() {
    return KnexStorage.capabilities;
  }
}
