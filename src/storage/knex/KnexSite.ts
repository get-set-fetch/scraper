/* eslint-disable no-await-in-loop */
import { QueryBuilder } from 'knex';
import Resource, { IResourceContent } from '../base/Resource';
import Site from '../base/Site';
import KnexResource from './KnexResource';
import KnexStorage from './KnexStorage';

export default class KnexSite extends Site {
  static get builder():QueryBuilder {
    return KnexStorage.knex('sites');
  }

  static async init():Promise<void> {
    const schemaBuilder = KnexStorage.knex.schema;

    const tablePresent = await schemaBuilder.hasTable('sites');
    if (tablePresent) return;

    await schemaBuilder.createTable(
      'sites',
      builder => {
        builder.increments('id').primary();
        builder.string('name');
        builder.string('url');
        builder.string('pluginOpts');
      },
    );
  }

  static async get(nameOrId: number | string):Promise<Site> {
    const colName = Number.isInteger(nameOrId) ? 'id' : 'name';
    const rawSite = await KnexSite.builder.where({ [colName]: nameOrId }).first();
    return rawSite ? new KnexSite(rawSite) : undefined;
  }

  static getAll() {
    return KnexSite.builder.select();
  }

  static delAll():Promise<void> {
    return KnexSite.builder.del();
  }

  async countResources():Promise<number> {
    const [ result ] = await KnexResource.builder.where('siteId', this.id).count('id', { as: 'count' });
    return result.count;
  }

  async save():Promise<number> {
    let result:number[];

    // save the site
    const { config } = KnexStorage.knex.client;
    if (config.client === 'sqlite3') {
      result = await KnexSite.builder.insert(this.toJSON());
    }
    else {
      result = await KnexSite.builder.insert(this.toJSON()).returning('id');
    }
    [ this.id ] = result;

    // save the site url as a new resource, scraping will start with this resource
    const resource = new KnexResource({ siteId: this.id, url: this.url });
    await resource.save();

    return this.id;
  }

  update():Promise<void> {
    return KnexSite.builder.where('id', this.id).update(this.toJSON());
  }

  del() {
    return KnexSite.builder.where('id', this.id).del();
  }

  getResource(url: string) {
    return KnexResource.getResource(this.id, url);
  }

  async getResources() {
    const rawResources = await KnexResource.getAll(this.id);
    return rawResources.map(rawResource => new KnexResource(rawResource));
  }

  async getContent():Promise<IResourceContent[]> {
    const rawResources = await KnexResource.getAll(this.id);
    return rawResources.map(rawResource => JSON.parse(rawResource.content) as IResourceContent);
  }

  getResourceToCrawl() {
    return KnexResource.getResourceToCrawl(this.id);
  }

  createResource(resource: Partial<Resource>) {
    return new KnexResource({ ...resource, siteId: this.id });
  }

  async saveResources(resources: Partial<Resource>[]) {
    for (let i = 0; i < resources.length; i += 1) {
      const knexResource = new KnexResource(
        Object.assign(resources[i], { siteId: this.id }),
      );
      await knexResource.save();
    }
  }
}
