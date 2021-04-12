/* eslint-disable no-prototype-builtins */
/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
import { JSONSchema7 } from 'json-schema';
import SchemaHelper from '../schema/SchemaHelper';
import Project from '../storage/base/Project';
import Resource from '../storage/base/Resource';
import BrowserClient from '../browserclient/BrowserClient';
import { IDomClientConstructor } from '../domclient/DomClient';

export type PluginOpts = {
  name: string;
  domRead?: boolean;
  domWrite?: boolean;
  [key: string]: unknown;

  // position options within a plugin list
  before?: string;
  replace?: string;
  after?: string;
}

/** All plugins should extend this class implementing the test and apply methods. */
export default abstract class Plugin {
  static get schema() {
    return {};
  }

  opts: Partial<PluginOpts>;

  constructor(opts:Partial<PluginOpts> = {}) {
    const { schema } = <typeof Plugin> this.constructor;
    this.opts = SchemaHelper.instantiate(schema, opts);
  }

  /**
   * Relevant for a pipeline plugin responsible for actual content scraping.
   * @returns keys the scraped data will be exported under
   */
  getContentKeys():string[] {
    return undefined;
  }

  /**
   * Tests if the plugin should be executed or not against the current resource.
   * @param project - current scrape project
   * @param resource - current scrape resource
   */
  abstract test(project: Project, resource: Resource): Promise<boolean> | boolean;

  /**
   * Executes the plugin against the current resource, either in node.js or browser environment.
   * The result will be merged into the currently scraped resource at scraper level.
   * @param project - current scrape project
   * @param resource - current scrape resource
   * @param client - current browser client
   */
  abstract apply(project: Project, resource: Resource, client: BrowserClient|IDomClientConstructor): Promise<void | Partial<Resource>> | void | Partial<Resource>;
}

export interface IPlugin {
  new(kwArgs: Partial<PluginOpts>): Plugin;
  schema: JSONSchema7;
}
