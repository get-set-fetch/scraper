/* eslint-disable no-await-in-loop */
import Resource, { ResourceQuery } from '../base/Resource';
import Site from '../base/Site';
import KnexStorage from './KnexStorage';

export default class KnexSite extends Site {
  static storage:KnexStorage;

  static get builder() {
    return this.storage.knex('sites');
  }

  static async init(storage: KnexStorage):Promise<void> {
    this.storage = storage;

    const schemaBuilder = storage.knex.schema;
    const tablePresent = await schemaBuilder.hasTable('sites');
    if (tablePresent) return;

    await schemaBuilder.createTable(
      'sites',
      builder => {
        builder.increments('id').primary();
        builder.string('name');
        builder.string('url');

        this.storage.jsonCol(builder, 'pluginOpts');
      },
    );
  }

  static async get(nameOrId: number | string):Promise<Site> {
    const colName = Number.isInteger(nameOrId) ? 'id' : 'name';
    const rawSite = await this.builder.where({ [colName]: nameOrId }).first();
    return rawSite ? new this.storage.Site(rawSite) : undefined;
  }

  static getAll() {
    return this.builder.select();
  }

  static delAll():Promise<void> {
    return this.builder.del();
  }

  get Constructor():typeof KnexSite {
    return (<typeof KnexSite> this.constructor);
  }

  async countResources():Promise<number> {
    const [ result ] = await this.Constructor.storage.Resource.builder.where('siteId', this.id).count('id', { as: 'count' });
    return typeof result.count === 'string' ? parseInt(result.count, 10) : result.count;
  }

  async save():Promise<number> {
    // save the site
    const result:number[] = await (
      this.Constructor.storage.capabilities.returning
        ? this.Constructor.builder.insert(this.toJSON()).returning('id')
        : this.Constructor.builder.insert(this.toJSON())
    );
    [ this.id ] = result;

    // save the site url as a new resource, scraping will start with this resource
    const resource = new this.Constructor.storage.Resource({ siteId: this.id, url: this.url });
    await resource.save();

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
    query.where = { ...query.where, siteId: this.id };
    return this.Constructor.storage.Resource.getPagedResources(query);
  }

  getResourceToCrawl() {
    return this.Constructor.storage.Resource.getResourceToCrawl(this.id);
  }

  createResource(resource: Partial<Resource>) {
    return new this.Constructor.storage.Resource({ ...resource, siteId: this.id });
  }

  async saveResources(resources: Partial<Resource>[]) {
    for (let i = 0; i < resources.length; i += 1) {
      const resource = new this.Constructor.storage.Resource(
        Object.assign(resources[i], { siteId: this.id }),
      );
      await resource.save();
    }
  }

  toJSON() {
    return this.Constructor.storage.toJSON(this);
  }
}
