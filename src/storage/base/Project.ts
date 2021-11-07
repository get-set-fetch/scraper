import Plugin, { PluginOpts } from '../../plugins/Plugin';
import { LogWrapper } from '../../logger/Logger';
import { ModelCombination } from '../storage-utils';
import Storage from './Storage';
import Queue from './Queue';
import Resource, { ResourceQuery } from './Resource';
import Entity, { IStaticEntity } from './Entity';
import PluginStore, { StoreEntry } from '../../pluginstore/PluginStore';

export default abstract class Project extends Entity {
  queue: Queue;
  logger: LogWrapper;

  id: number;
  name: string;

  // stored as json string, initialized as PluginOpts[]
  pluginOpts: PluginOpts[];

  // initialized based on pluginOpts
  plugins: Plugin[];

  // populated based on countResources, usefull info to have when serializing to plugin exection in DOM
  resourceCount:number;

  get Constructor():typeof Project & IStaticProject {
    return (<typeof Project & IStaticProject> this.constructor);
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

  abstract getResource(url: string):Promise<Resource>;
  abstract getResources():Promise<Resource[]>;
  abstract getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]>;
  abstract createResource(resource: Partial<Resource>):Resource;

  abstract initQueue():Promise<void>;
  abstract initResource():Promise<void>;

  abstract update():Promise<void>;

  get dbCols() {
    return [ 'id', 'name', 'pluginOpts' ];
  }

  toJSON() {
    return (<IStaticProject> this.constructor).storage.toJSON(this);
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

export interface IStaticProject extends IStaticEntity {
  storage: Storage;
  models: ModelCombination;

  new(kwArgs: Partial<Project>): Project;
  init():Promise<void>;
  get(nameOrId: string | number):Promise<Project>;
  getAll():Promise<any[]>;
  getProjectToScrape():Promise<Project>;
}
