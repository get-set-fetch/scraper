/* eslint-disable no-await-in-loop */
import { QueryBuilder } from 'knex';
import Resource, { ResourceQuery } from '../base/Resource';
import Site from '../base/Site';
import KnexResource from './KnexResource';
import KnexStorage, { jsonCol } from './KnexStorage';

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

        jsonCol(builder, 'pluginOpts');
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
    return this.capabilities.int8String ? parseInt(result.count, 10) : result.count;
  }

  async save():Promise<number> {
    // save the site
    const result:number[] = await (
      this.capabilities.returning
        ? KnexSite.builder.insert(this.toJSON()).returning('id')
        : KnexSite.builder.insert(this.toJSON())
    );
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

  async getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]> {
    // eslint-disable-next-line no-param-reassign
    query.where = { ...query.where, siteId: this.id };
    return KnexResource.getPagedResources(query);
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

  toJSON() {
    return KnexStorage.toJSON(this);
  }

  get capabilities() {
    return KnexStorage.capabilities;
  }
}
