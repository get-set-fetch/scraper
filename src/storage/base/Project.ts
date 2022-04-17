/* eslint-disable no-await-in-loop */
/* eslint-disable max-classes-per-file */
import Plugin, { PluginOpts } from '../../plugins/Plugin';
import { LogWrapper, getLogger } from '../../logger/Logger';
import Queue from './Queue';
import Resource, { ResourceQuery } from './Resource';
import Entity from './Entity';
import PluginStore, { StoreEntry } from '../../pluginstore/PluginStore';
import Connection from './Connection';

export default class Project extends Entity {
  static storage:IProjectStorage;
  static ExtQueue: typeof Queue;
  static ExtResource:typeof Resource;

  queue: Queue;
  logger: LogWrapper = getLogger('Project');

  name: string;

  // stored as json string, initialized as PluginOpts[]
  pluginOpts: PluginOpts[];

  // initialized based on pluginOpts
  plugins: Plugin[];

  // populated based on countResources, usefull info to have when serializing to plugin exection in DOM
  resourceCount:number;

  get Constructor():typeof Project {
    return (<typeof Project> this.constructor);
  }

  constructor(kwArgs: Partial<Project> = {}) {
    super(kwArgs);

    if (typeof kwArgs.pluginOpts === 'string') {
      this.pluginOpts = JSON.parse(kwArgs.pluginOpts);
    }
  }

  async initPlugins(browserClientPresent:boolean):Promise<Plugin[]> {
    // register project external plugins if available
    const externalPluginOpts = this.pluginOpts.filter(pluginOpts => pluginOpts.path);
    for (let i = 0; i < externalPluginOpts.length; i += 1) {
      if (!PluginStore.get(externalPluginOpts[i].name)) {
        // eslint-disable-next-line no-await-in-loop
        await PluginStore.addEntry(externalPluginOpts[i].path);
      }
    }

    const plugins = this.pluginOpts.map((pluginOpt:PluginOpts) => {
      const pluginStoreEntry:StoreEntry = PluginStore.get(pluginOpt.name);
      if (!pluginStoreEntry) {
        throw new Error(`Plugin ${pluginOpt.name} not registered`);
      }

      const PluginCls = pluginStoreEntry.Cls;
      if (!PluginCls) throw new Error(`missing class for plugin ${pluginOpt.name}`);

      return new PluginCls(pluginOpt);
    });

    const domPlugins = plugins.filter(plugin => plugin.opts && (plugin.opts.domRead || plugin.opts.domWrite));
    if (domPlugins.length > 0 && !browserClientPresent) {
      throw new Error(`Attempting to run plugins in browser DOM (${domPlugins.map(plugin => plugin.constructor.name).join(', ')}) without a browser`);
    }

    return plugins;
  }

  static async get(nameOrId: number | string) {
    const rawProject = await this.storage.get(nameOrId);

    if (rawProject) {
      // each project has its own static linkage, needs new class
      const ExtProject = class extends Project {};
      ExtProject.storage = this.storage;
      const project = new (ExtProject)(rawProject);
      await project.initResource(this.ExtResource.storage.conn);
      await project.initQueue(this.ExtQueue.storage.conn);
      return project;
    }

    return undefined;
  }

  getResource(url: string):Promise<Resource> {
    return this.Constructor.ExtResource.getResource(url);
  }

  async getResources():Promise<Resource[]> {
    const rawResources = await this.Constructor.ExtResource.getAll();
    return rawResources.map(rawResource => new (this.Constructor.ExtResource)(rawResource));
  }

  async getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]> {
    return this.Constructor.ExtResource.getPagedResources(query);
  }

  createResource(resource: Partial<Resource>) {
    return new (this.Constructor.ExtResource)({ ...resource });
  }

  async save():Promise<number> {
    this.id = await this.Constructor.storage.save(this);

    // init its scraping queue and resource tables
    await this.initResource(this.Constructor.ExtResource.storage.conn);
    await this.initQueue(this.Constructor.ExtQueue.storage.conn);

    return this.id;
  }

  async initQueue(queueConn:Connection):Promise<void> {
    const ExtQueue = class extends Queue {};
    ExtQueue.storage = queueConn.getQueueStorage();
    await ExtQueue.storage.init(this);

    this.Constructor.ExtQueue = ExtQueue;
    this.Constructor.ExtQueue.ExtResource = this.Constructor.ExtResource;
    this.queue = new ExtQueue();
  }

  async initResource(resourceConn:Connection):Promise<void> {
    const ExtResource = class extends Resource {};
    ExtResource.storage = resourceConn.getResourceStorage();
    await ExtResource.storage.init(this);

    this.Constructor.ExtResource = ExtResource;
  }

  async del():Promise<void> {
    await this.Constructor.storage.del(this.id);

    await this.Constructor.ExtResource.storage.drop();
    await this.Constructor.ExtQueue.storage.drop();
  }

  update():Promise<void> {
    return this.Constructor.storage.update(this);
  }

  static async delAll():Promise<void> {
    const rawProjects = await this.storage.getAll();

    // delete projects one by one, since we also need to drop Queue and Resource tables linked to them
    // individual Project.get links the retrieve project to its Queue and Resource tables
    await Promise.all(rawProjects.map(async rawProject => {
      const p:Project = await this.get(rawProject.id);
      return p.del();
    }));
  }

  static async getProjectToScrape():Promise<{project: Project, resources: Resource[]}> {
    const projects:Project[] = await this.storage.getAll();

    for (let i = 0; i < projects.length; i += 1) {
      const project = await this.get(projects[i].id);
      const resources = await project.queue.getResourcesToScrape(1);

      if (resources.length > 0) {
        return { project, resources };
      }
    }

    return { project: null, resources: [] };
  }

  get dbCols() {
    return [ 'id', 'name', 'pluginOpts' ];
  }

  toJSON() {
    return this.Constructor.storage.toJSON(this);
  }

  /**
   * Only serialize some properties when invoking plugins in DOM with a Project argument
   */
  async toExecJSON() {
    const jsonObj = { ...this.toJSON() };

    // plugins running in DOM don't need the project pluginOpts
    delete jsonObj.pluginOpts;

    return jsonObj;
  }
}

export interface IProjectStorage {
  conn: Connection;

  init():Promise<void>;
  save(project: Project):Promise<number>;
  get(nameOrId: string | number):Promise<Project>;
  getAll():Promise<Project[]>;
  update(project:Project):Promise<void>;
  del(id:string | number):Promise<void>;
  toJSON(entity);
}
