import Entity, { IEntity } from './Entity';
import Plugin, { IPluginOpts } from '../../plugins/Plugin';
import Resource, { IResourceContent } from './Resource';
import PluginStore from '../../pluginstore/PluginStore';

export default abstract class Site extends Entity {
  id: number;
  name: string;
  url: string;

  // stored as json string, initialized as IPluginOpts[]
  pluginOpts: IPluginOpts[];

  // initialized based on pluginOpts
  plugins: Plugin[];

  // populated based on countResources, usefull info to have when serializing to plugin exection in DOM
  resourceCount:number;

  constructor(kwArgs: Partial<Site> = {}) {
    super(kwArgs);

    if (typeof kwArgs.pluginOpts === 'string') {
      this.pluginOpts = JSON.parse(kwArgs.pluginOpts);
    }
  }

  initPlugins():Plugin[] {
    return this.pluginOpts.map((pluginOpt:IPluginOpts) => {
      const PluginCls = PluginStore.get(pluginOpt.name).Cls;
      return new PluginCls(pluginOpt);
    });
  }

  abstract countResources():Promise<number>;

  abstract getResourceToCrawl():Promise<Resource>;

  abstract getResource(url: string):Promise<Resource>;

  abstract getResources():Promise<Resource[]>;

  abstract getPagedContent(offset:number, limit: number):Promise<Partial<Resource>[]>;

  abstract saveResources(resources: Partial<Resource>[]):Promise<void>;

  abstract createResource(resource: Partial<Resource>):Resource;

  get dbCols() {
    return [ 'id', 'name', 'url', 'pluginOpts' ];
  }

  async toJSONAsync() {
    const jsonObj = this.toJSON();
    const resourceCount = await this.countResources();
    return { ...jsonObj, resourceCount };
  }
}

export interface IStaticSite extends IEntity {
  new(kwArgs: Partial<Site>): Site;
  get(nameOrId: string | number):Promise<Site>;
  getAll():Promise<any[]>;
}
