/* eslint-disable no-await-in-loop */
import Resource, { ResourceQuery } from '../base/Resource';
import Project from '../base/Project';
import KnexStorage from './KnexStorage';

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
        builder.string('url');

        this.storage.jsonCol(builder, 'pluginOpts');
      },
    );
  }

  static async get(nameOrId: number | string):Promise<Project> {
    const colName = Number.isInteger(nameOrId) ? 'id' : 'name';
    const rawProject = await this.builder.where({ [colName]: nameOrId }).first();
    return rawProject ? new this.storage.Project(rawProject) : undefined;
  }

  static getAll() {
    return this.builder.select();
  }

  static delAll():Promise<void> {
    return this.builder.del();
  }

  get Constructor():typeof KnexProject {
    return (<typeof KnexProject> this.constructor);
  }

  async countResources():Promise<number> {
    const [ result ] = await this.Constructor.storage.Resource.builder.where('projectId', this.id).count('id', { as: 'count' });
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

    // save the project url as a new resource, scraping will start with this resource
    const resource = new this.Constructor.storage.Resource({ projectId: this.id, url: this.url });
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
    query.where = { ...query.where, projectId: this.id };
    return this.Constructor.storage.Resource.getPagedResources(query);
  }

  getResourceToCrawl() {
    return this.Constructor.storage.Resource.getResourceToCrawl(this.id);
  }

  createResource(resource: Partial<Resource>) {
    return new this.Constructor.storage.Resource({ ...resource, projectId: this.id });
  }

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
