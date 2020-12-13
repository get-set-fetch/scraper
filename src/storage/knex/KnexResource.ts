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
        builder.string('content');
        builder.binary('blob');
        builder.string('parent');
      },
    );
  }

  static async get(resourceId:number):Promise<Resource> {
    const rawResource = await KnexResource.builder.where({ id: resourceId }).first();
    return rawResource ? new KnexResource(rawResource) : undefined;
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
    let result:number[];

    const { config } = KnexStorage.knex.client;

    // save the resource not using returning for sqlite since it does not support it
    if (config.client === 'sqlite3') {
      result = await KnexResource.builder.insert(this.toJSON());
    }
    else {
      result = await KnexResource.builder.insert(this.toJSON()).returning('id');
    }

    return result[0];
  }

  update():Promise<void> {
    return KnexResource.builder.where('id', this.id).update(this.toJSON());
  }

  del() {
    return KnexResource.builder.where('id', this.id).del();
  }
}
