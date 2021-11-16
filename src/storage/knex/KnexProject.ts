/* eslint-disable no-await-in-loop */
import { getLogger } from '../../logger/Logger';
import Project, { IStaticProject } from '../base/Project';
import { IStaticQueue } from '../base/Queue';
import Resource, { IStaticResource, ResourceQuery } from '../base/Resource';
import ModelStorage, { ModelCombination } from '../ModelStorage';
import KnexStorage from './KnexStorage';

export default class KnexProject extends Project {
  static storage: KnexStorage;
  static models: ModelCombination;

  static get builder() {
    return this.storage.knex('projects');
  }

  static async init():Promise<void> {
    const schemaBuilder = this.storage.knex.schema;
    const tablePresent = await schemaBuilder.hasTable('projects');
    if (tablePresent) return;

    await schemaBuilder.createTable(
      'projects',
      builder => {
        builder.increments('id').primary();
        builder.string('name').unique();

        this.storage.jsonCol(builder, 'pluginOpts');
      },
    );
  }

  static async get(nameOrId: number | string) {
    const colName = Number.isInteger(nameOrId) ? 'id' : 'name';
    const rawProject = await this.builder.where({ [colName]: nameOrId }).first();

    if (rawProject) {
      // each project instance has its own model storage linkage
      const modelStorage:ModelStorage = new ModelStorage(this.storage);
      const { Project: ExtProject } = await modelStorage.getModels();
      const project = new (<IStaticProject>ExtProject)(rawProject);
      await project.initQueue();
      await project.initResource();
      return project;
    }

    return undefined;
  }

  static getAll() {
    return this.builder.select();
  }

  static async delAll():Promise<void> {
    const rawProjects = await this.getAll();

    // delete projects one by one, since we also need to drop Queue and Resource tables linked to them
    // individual Project.get links the retrieve project to its Queue and Resource tables
    await Promise.all(rawProjects.map(async rawProject => {
      const p:Project = await this.get(rawProject.id);
      return p.del();
    }));
  }

  static async getProjectToScrape() {
    let project: Project;
    const projects:Project[] = await this.getAll();

    for (let i = 0; i < projects.length; i += 1) {
      const candidateProject = await this.get(projects[i].id);
      const [ resource ] = await candidateProject.queue.getResourcesToScrape(1);
      if (resource) {
        await candidateProject.queue.updateStatus(resource.queueEntryId, null);
        project = candidateProject;
        break;
      }
    }

    return project;
  }

  logger = getLogger('KnexProject');

  get Constructor():typeof KnexProject {
    return (<typeof KnexProject> this.constructor);
  }

  async save():Promise<number> {
    // save the project
    const result:number[] = await (
      this.Constructor.storage.capabilities.returning
        ? this.Constructor.builder.insert(this.toJSON()).returning('id')
        : this.Constructor.builder.insert(this.toJSON())
    );
    [ this.id ] = result;

    // init its scraping queue and resource tables
    await this.initQueue();
    await this.initResource();

    return this.id;
  }

  update():Promise<void> {
    return this.Constructor.builder.where('id', this.id).update(this.toJSON());
  }

  async del():Promise<void> {
    await this.Constructor.builder.where('id', this.id).del();
    await this.Constructor.models.Resource.drop();
    await this.Constructor.models.Queue.drop();
  }

  getResource(url: string) {
    return this.Constructor.models.Resource.getResource(url);
  }

  async getResources() {
    const rawResources = await this.Constructor.models.Resource.getAll();
    return rawResources.map(rawResource => new (<IStaticResource> this.Constructor.models.Resource)(rawResource));
  }

  async getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]> {
    return this.Constructor.models.Resource.getPagedResources(query);
  }

  createResource(resource: Partial<Resource>) {
    return new (<IStaticResource> this.Constructor.models.Resource)({ ...resource });
  }

  async initQueue() {
    const ExtQueue:IStaticQueue = this.Constructor.models.Queue;
    ExtQueue.projectId = this.id;
    await ExtQueue.init();

    this.queue = new ExtQueue();
  }

  async initResource() {
    const ExtResource:IStaticResource = this.Constructor.models.Resource;
    ExtResource.projectId = this.id;
    await ExtResource.init();
  }
}
