/* eslint-disable no-prototype-builtins */
/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
import { JSONSchema7 } from 'json-schema';
import SchemaHelper from '../schema/SchemaHelper';
import Project from '../storage/base/Project';
import Resource from '../storage/base/Resource';
import BrowserClient from '../browserclient/BrowserClient';

export type PluginOpts = {
  name: string;
  domRead?: boolean;
  domWrite?: boolean;
  [key: string]: any;

  // position options within a plugin list
  before?: string;
  replace?: string;
  after?: string;
}

export default abstract class Plugin {
  static get schema() {
    return {};
  }

  opts: Partial<PluginOpts>;

  constructor(opts = {}) {
    const { schema } = <typeof Plugin> this.constructor;
    this.opts = SchemaHelper.instantiate(schema, opts);
  }

  abstract test(project: Project, resource: Resource): Promise<boolean> | boolean;
  abstract apply(project: Project, resource: Resource, client: BrowserClient): Promise<void | Partial<Resource>> | void | Partial<Resource>;
}

export interface IPlugin {
  new(kwArgs: Partial<PluginOpts>): Plugin;
  schema: JSONSchema7
}
