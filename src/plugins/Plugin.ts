/* eslint-disable no-prototype-builtins */
/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
import { JSONSchema7 } from 'json-schema';
import SchemaHelper from '../schema/SchemaHelper';
import Site from '../storage/base/Site';
import Resource from '../storage/base/Resource';
import BrowserClient from '../browserclient/BrowserClient';

export interface IPluginOpts {
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

  opts: Partial<IPluginOpts>;

  constructor(opts = {}) {
    const { schema } = <typeof Plugin> this.constructor;
    this.opts = SchemaHelper.instantiate(schema, opts);
  }

  abstract test(site: Site, resource: Resource): Promise<boolean> | boolean;
  abstract apply(site: Site, resource: Resource, client: BrowserClient): Promise<void | Partial<Resource>> | void | Partial<Resource>;
}

export interface IPlugin {
  new(kwArgs: Partial<IPluginOpts>): Plugin;
  schema: JSONSchema7
}
