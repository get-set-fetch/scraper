/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
import { URL } from 'url';
import BrowserClient from '../browserclient/BrowserClient';
import Project from '../storage/base/Project';
import Resource from '../storage/base/Resource';
import Plugin, { PluginOpts } from '../plugins/Plugin';
import PluginStore from '../pluginstore/PluginStore';
import { getLogger } from '../logger/Logger';
import Storage from '../storage/base/Storage';
import { scenarios, mergePluginOpts } from '../scenarios/scenarios';
import Exporter, { ExportOptions } from '../export/Exporter';
import CsvExporter from '../export/CsvExporter';
import ZipExporter from '../export/ZipExporter';
import { decode } from '../confighash/config-hash';
import { IDomClientConstructor } from '../domclient/DomClient';

export type ScrapingConfig = {
  url: string,
  scenario: string,
  pluginOpts: PluginOpts[]
}

/**
 * Executes defined scraping plugins against to be scraped resources.
 * Storage agnostic.
 * Browser client agnostic.
 * Will connect to db if provided storage not already connected.
 * Will open browser client if provided browser client not already opened.
 */
export default class Scraper {
  logger = getLogger('Scraper');

  storage: Storage;
  browserClient:BrowserClient;
  domClientConstruct: IDomClientConstructor;
  project: Project;

  constructor(storage: Storage, client:BrowserClient|IDomClientConstructor) {
    this.storage = storage;
    if (!client) {
      const err = new Error('A browser or DOM client need to be provided');
      this.logger.error(err);
      throw err;
    }

    if (client instanceof BrowserClient) {
      this.browserClient = client;
    }
    else {
      this.domClientConstruct = client;
    }
  }

  /**
   * Pre-scrape preparations regarding PluginStore, storage and browser client.
   * Making sure default plugins are registered, a connection to a database is opened, a browser is launched.
   */
  async preScrape():Promise<void> {
    if (PluginStore.store.size === 0) {
      await PluginStore.init();
      this.logger.info(`PluginStore initialized, ${PluginStore.store.size} plugins found`);
    }

    if (!this.storage.isConnected) {
      await this.storage.connect();
      this.logger.info('Storage connected');
    }

    if (this.browserClient && !this.browserClient.isLaunched) {
      await this.browserClient.launch();
    }
  }

  /**
   * If scrapingConfig is a project return it without modifications.
   * If it's a scraping configuration or a deflated scraping configuration construct a new project based on start url.
   * Project name resolves to the start url hostname.
   * @param scrapingConfig - project, scraping configuration or base64 deflated scraping configuration
   */
  async initProject(scrapingConfig: Project|ScrapingConfig|string):Promise<Project> {
    const { Project } = this.storage;

    if (scrapingConfig instanceof Project) {
      return <Project>scrapingConfig;
    }

    const scrapeDef:ScrapingConfig = typeof scrapingConfig === 'string' ? decode(scrapingConfig) : scrapingConfig;
    if (scrapeDef.scenario && !scenarios[scrapeDef.scenario]) {
      throw new Error(`Scenario ${scrapeDef.scenario} not found. Available scenarios are:  ${Object.keys(scenarios).join(', ')}`);
    }

    const projectName = new URL(scrapeDef.url).hostname;
    let project = await Project.get(projectName);
    if (project) {
      this.logger.info(`Existing project ${project.name} detected.`);
      return project;
    }

    project = new Project({
      name: projectName,
      url: scrapeDef.url,
      pluginOpts: scenarios[scrapeDef.scenario]
        ? mergePluginOpts(scenarios[scrapeDef.scenario].defaultPluginOpts, scrapeDef.pluginOpts)
        : scrapeDef.pluginOpts,
    });
    await project.save();
    this.logger.info(`new Project ${project.name} saved`);

    return project;
  }

  /**
   * Cleanup actions after scraping completes.
   * Closes the browser but keeps the storage connection open as scraping is often followed by data export actions.
   */
  async postScrape() {
    if (this.browserClient && this.browserClient.isLaunched) {
      await this.browserClient.close();
    }
  }

  /**
   * Scrapes available resources from the provided project. If a scraping configuration is provided creates a project first.
   * @param project - project, scraping configuration or base64 deflated scraping configuration
   */
  async scrape(project: Project):Promise<Project>
  async scrape(scrapingConfig: ScrapingConfig):Promise<Project>
  async scrape(scrapeHash: string):Promise<Project>
  async scrape(scrapingConfig: Project|ScrapingConfig|string):Promise<Project|void> {
    try {
      await this.preScrape();
    }
    catch (err) {
      this.logger.error(err);
      // no project > no scrape process > abort
      return this.postScrape();
    }

    this.logger.debug(this.project, 'Scraping project');
    try {
      this.project = await this.initProject(scrapingConfig);
      this.project.plugins = this.project.initPlugins();

      const domPlugins = this.project.plugins.filter(plugin => plugin.opts.domRead || plugin.opts.domWrite);
      if (domPlugins.length > 0 && !this.browserClient) {
        throw new Error(`Attempting to run plugins in browser DOM (${domPlugins.map(plugin => plugin.constructor.name).join(', ')}) without a browser`);
      }
    }
    catch (err) {
      this.logger.error(err);
      // no plugins > no scrape process > abort
      return this.postScrape();
    }

    /*
    scrapeResource always starts by retrieving a (static) resource from db
    in case of dynamic actions, each valid dynamic action found will create a dynamic resource
    scrapeResource will be triggered again with the newly created dynamic resource
    only a single dynamic action (from a single plugin) can be triggered in a scrapeResource call

    when scrapeResource returns null => there are no more resources to be scraped in db, stop scraping
    */
    let resource: Resource;
    do {
      resource = await this.scrapeResource(this.project);
    }
    while (resource);

    await this.postScrape();

    return this.project;
  }

  /**
   * Sequentially executes the project plugins against the current resource.
   * It usually starts with an available resource being selected from db and ends with the resource being updated with the scraped content.
   * @param project - current scraping project
   * @param resource - current scraping resource
   */
  async scrapeResource(project: Project, resource: Resource = null):Promise<Resource> {
    // dynamic resource, a resource that was modified by a dynamic action: scroll, click, ..
    if (resource && resource.actions) {
      this.logger.info('Started re-scraping a dynamic resource from project %s, url %s, dynamic action %s', project.name, resource.url, resource.actions);
    }
    else {
      this.logger.info('Started scraping a new resource from project %s', project.name);
    }

    let pluginIdx: number;
    try {
      /*
      will execute the plugins in the order they are defined
      apply each plugin to the current (project, resource) pair
      */
      for (pluginIdx = 0; pluginIdx < project.plugins.length; pluginIdx += 1) {
        const result = await this.executePlugin(project, resource, project.plugins[pluginIdx]);

        /*
        a plugin result can represent:
        - a new static resource: Resource from the db not yet scraped (ex: SelectResourcePlugin)
        - additional data/content to be merged with the current resource (ex: ExtractUrlsPlugin, ExtractHtmlContentPlugin, ...)
        */
        this.logger.debug(result || {}, 'Plugin result');

        // current plugin did not returned a result, move on to the next one
        if (!result) continue;

        // a new static resource has been selected for scraping
        if (result instanceof Resource) {
          resource = result;
        }
        // new content has been generated to be merged wih the current resource
        else {
          Object.assign(resource, result);
        }
      }

      if (resource) {
        this.logger.debug(resource, 'Resource successfully scraped');
        this.logger.info('Resource successfully scraped %s', resource.url);
      }
      else {
        this.logger.info('No scrapable resource found for project %s', project.name);
      }
    }
    catch (err) {
      this.logger.error(
        err,
        'Crawl error for project %s , Plugin %s against resource %s',
        project.name, project.plugins[pluginIdx].constructor.name, resource ? resource.url : '',
      );

      /*
      manually update the resource, this resets the scrapeInProgress flag and adds scrapedAt date
      selecting new resources for scraping takes scrapedAt in consideration (right now only resources with scrapedAt undefined qualify)
      because of the above behavior, we don't attempt to scrape a resource that throws an error over and over again

      in future a possible approach will be just resetting the scrapeInProgress flag
        - next scrape operation will attempt to scrape it again, but atm this will just retry the same resource over and over again
        - there is no mechanism to escape the retry loop
      resource.scrapeInProgress = false;
      await resource.update(false);
      */
      if (resource) {
        /*
        unknown error occured,
        add scrapedAt field to the current resource so it won't be scraped again, possibly ending in an infinite loop retrying again and again
        */
        await resource.update();
      }
    }

    /*
    resource is a dynamic one, successfully modified by a dynamic action: scroll, click, ..
    scrape the newly generated content by re-triggering the scrape plugins
    */
    if (
      resource
      && resource.actions
      && resource.actions.length > 0
    ) {
      const dynamicResource:Resource = (
        ({ url, depth, contentType, parent, actions }) => project.createResource({ url, depth, contentType, parent, actions })
      )(resource);
      return this.scrapeResource(project, dynamicResource);
    }

    /*
    scraping of the current resource is complete
    resource can be:
    - null (no more resources to scrap)
    - static
    - dynamic with no more dynamic actions available
    */
    return resource;
  }

  /**
   * Executes the current plugin in either node.js or browser environment.
   * @param project - current scraping project
   * @param resource - current scraping resource
   * @param plugin - current scraping plugin
   */
  async executePlugin(project: Project, resource: Resource, plugin: Plugin):Promise<void | Partial<Resource>> {
    this.logger.debug(
      'Executing plugin %s using options %o , against resource %o',
      plugin.constructor.name, plugin.opts, resource,
    );

    if (plugin.opts && (plugin.opts.domRead || plugin.opts.domWrite)) {
      return resource && /html/.test(resource.contentType) ? this.executePluginInDom(project, resource, plugin) : null;
    }

    // test if plugin is aplicable
    const isApplicable = await plugin.test(project, resource);
    this.logger.debug(
      'Plugin %s isApplicable: %s',
      plugin.constructor.name, isApplicable,
    );
    if (isApplicable) {
      return plugin.apply(project, resource, this.browserClient || this.domClientConstruct);
    }

    return null;
  }

  /*
  async run the plugin in DOM
  use a block declaration in order not to polute the global namespace
  avoiding conflicts, thus redeclaration errors
  */
  async executePluginInDom(project: Project, resource: Resource, plugin: Plugin):Promise<void | Partial<Resource>> {
    // scraper doesn't rely on a browser client but a nodejs dom client, can't inject js in clients like cheerio
    if (!this.browserClient) {
      throw new Error('browserClient unavailable');
    }

    // plugins running in DOM assume a valid resource has already been fetched
    if (!resource) return null;

    const pluginClsName = plugin.constructor.name;
    const pluginInstanceName = `inst${pluginClsName}`;
    const pluginCode = PluginStore.get(pluginClsName).bundle;

    this.logger.debug('injecting plugin in browser tab: %s', pluginClsName);
    const code = `
     {
       (async function() {
         try {
           // instantiate plugin instance, one time only, multiple plugin invocations will retain the previous plugin state
           if (!window.${pluginInstanceName}) {
             ${pluginCode}
             window.${pluginInstanceName} = new ${pluginClsName}(${JSON.stringify(plugin.opts)})
           }

           // execute plugin
           let result;
           const isApplicable = await window.${pluginInstanceName}.test(${JSON.stringify((await project.toExecJSON()))}, ${JSON.stringify(resource.toExecJSON())});
           if (isApplicable) {
             result = await window.${pluginInstanceName}.apply(${JSON.stringify(project)}, ${JSON.stringify(resource.toExecJSON())});
           }

           return result;
         }
         catch(err) {
           return {err: JSON.stringify(err, Object.getOwnPropertyNames(err))};
         }
       })();
     }
   `;

    const result = await this.browserClient.evaluate(code);

    if (result && result.err) {
      throw Error(result.err);
    }

    return result;
  }

  /**
   *
   * @param filepath - location to store the content, relative to the current working directory. Missing directories will not be created.
   * @param opts - export options pertinent to the selected export type. Type is required.
   */
  async export(filepath: string, opts: ExportOptions):Promise<void> {
    let exporter: Exporter;

    if (!(opts && opts.type)) {
      this.logger.error('specify an export type');
      return;
    }

    switch (opts.type) {
      case 'csv':
        exporter = new CsvExporter(this.project, filepath, opts);
        break;
      case 'zip':
        exporter = new ZipExporter(this.project, filepath, opts);
        break;
      default:
        this.logger.error(`unsupported export type ${opts.type}`);
        return;
    }

    await exporter.export();
  }
}
