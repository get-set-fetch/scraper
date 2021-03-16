/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
import { URL } from 'url';
import EventEmitter from 'events';
import BrowserClient from '../browserclient/BrowserClient';
import Project, { IStaticProject } from '../storage/base/Project';
import Resource from '../storage/base/Resource';
import Plugin, { PluginOpts } from '../plugins/Plugin';
import PluginStore from '../pluginstore/PluginStore';
import { getLogger } from '../logger/Logger';
import Storage from '../storage/base/Storage';
import { pipelines, mergePluginOpts } from '../pipelines/pipelines';
import Exporter, { ExportOptions } from '../export/Exporter';
import CsvExporter from '../export/CsvExporter';
import ZipExporter from '../export/ZipExporter';
import { decode } from '../confighash/config-hash';
import { IDomClientConstructor } from '../domclient/DomClient';
import ScrapeEvent from './ScrapeEvent';
import ConcurrencyManager, { ConcurrencyError, ConcurrencyOptions } from './ConcurrencyManager';

export type ScrapingConfig = {
  url: string,
  pipeline: string,
  pluginOpts: PluginOpts[]
}

/**
 * Executes defined scraping plugins against to be scraped resources.
 * Storage agnostic.
 * Browser client agnostic.
 * Will connect to db if provided storage not already connected.
 * Will open browser client if provided browser client not already opened.
 */
export default class Scraper extends EventEmitter {
  logger = getLogger('Scraper');

  storage: Storage;
  browserClient:BrowserClient;
  domClientConstruct: IDomClientConstructor;

  project: Project;
  concurrency: ConcurrencyManager;
  checkTimeout: NodeJS.Timeout;

  constructor(storage: Storage, client:BrowserClient|IDomClientConstructor) {
    super();

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
   * Making sure default plugins are registered, a connection to a database is opened, a browser (if apllicable) is launched.
   */
  async preScrape(concurrencyOpts?: Partial<ConcurrencyOptions>):Promise<void> {
    if (PluginStore.store.size === 0) {
      await PluginStore.init();
      this.logger.info(`PluginStore initialized, ${PluginStore.store.size} plugins found`);
    }

    if (!this.storage.isConnected) {
      await this.storage.connect();
      this.logger.info('Storage connected');
    }

    if (this.concurrency) {
      throw new Error('scraping already in progress');
    }
    else {
      // only sequential scraping is supported for browser clients like Puppeteer, Playwright
      if (this.browserClient && concurrencyOpts && Object.keys(concurrencyOpts).find(
        level => concurrencyOpts[level] && concurrencyOpts[level].maxRequests && concurrencyOpts[level].maxRequests !== 1,
      )) {
        throw new Error('concurrency condition maxRequests is not supported on browser clients');
      }

      this.concurrency = new ConcurrencyManager(concurrencyOpts);
      // concurrencyManager needs to update its status based on resource error/complete
      this.on(ScrapeEvent.ResourceScraped, this.concurrency.resourceScraped.bind(this.concurrency));
      this.on(ScrapeEvent.ResourceError, this.concurrency.resourceError.bind(this.concurrency));
    }

    if (this.browserClient && !this.browserClient.isLaunched) {
      await this.browserClient.launch();
      this.logger.info('Browser launched');
    }
  }

  /**
   * If scrapingConfig is a project return it without modifications.
   * If it's a scraping configuration or a deflated scraping configuration construct a new project based on start url.
   * Project name resolves to the start url hostname.
   * @param scrapingConfig - project, scraping configuration or base64 deflated scraping configuration
   */
  async initProject(scrapingConfig: Project|ScrapingConfig|string):Promise<Project> {
    if (scrapingConfig instanceof Project) {
      return <Project>scrapingConfig;
    }

    const scrapeDef:ScrapingConfig = typeof scrapingConfig === 'string' ? decode(scrapingConfig) : scrapingConfig;
    if (scrapeDef.pipeline && !pipelines[scrapeDef.pipeline]) {
      throw new Error(`Pipeline ${scrapeDef.pipeline} not found. Available pipelines are:  ${Object.keys(pipelines).join(', ')}`);
    }

    const projectName = new URL(scrapeDef.url).hostname;
    let project = await this.storage.Project.get(projectName);
    if (project) {
      this.logger.info(`Existing project ${project.name} detected.`);
      return project;
    }

    project = new (<IStaticProject> this.storage.Project)({
      name: projectName,
      url: scrapeDef.url,
      pluginOpts: pipelines[scrapeDef.pipeline]
        ? mergePluginOpts(pipelines[scrapeDef.pipeline].defaultPluginOpts, scrapeDef.pluginOpts)
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

    // scraping stopped, if resumed a new concurrencyManager will be created
    if (this.concurrency) {
      clearInterval(this.checkTimeout);
      this.off(ScrapeEvent.ResourceScraped, this.concurrency.resourceScraped);
      this.off(ScrapeEvent.ResourceError, this.concurrency.resourceError);
      delete this.concurrency;
    }
  }

  /**
   * Scrapes available resources from the provided project. If a scraping configuration is provided creates a project first.
   * @param project - project, scraping configuration or base64 deflated scraping configuration
   */
  async scrape(project: Project, concurrencyOpts?: Partial<ConcurrencyOptions>):Promise<void>
  async scrape(scrapingConfig: ScrapingConfig, concurrencyOpts?: Partial<ConcurrencyOptions>):Promise<void>
  async scrape(scrapeHash: string, concurrencyOpts?: Partial<ConcurrencyOptions>):Promise<void>
  async scrape(scrapingConfig: Project|ScrapingConfig|string, concurrencyOpts?: Partial<ConcurrencyOptions>):Promise<void> {
    try {
      await this.preScrape(concurrencyOpts);

      this.project = await this.initProject(scrapingConfig);
      this.project.plugins = this.project.initPlugins(!!this.browserClient);

      this.logger.debug(this.project, 'Scraping project');
      this.emit(ScrapeEvent.ProjectSelected, this.project);

      // start identifying resources to be scraped, trigger 1st attempt imediately, subsequent ones at computed check interval
      this.logger.info(`Checking for available to-be-scraped resources every ${this.concurrency.getCheckInterval()} miliseconds`);
      this.getResourceToScrape();
      this.checkTimeout = setInterval(this.getResourceToScrape.bind(this), this.concurrency.getCheckInterval());
    }
    catch (err) {
      this.logger.error(err);
      // no project > no scrape process > abort
      await this.postScrape();
      this.emit(ScrapeEvent.ProjectError, this.project, err);
    }
  }

  /**
   * Stop the current scraping process. This will not happen instantly.
   * After all in-progress scraping completes, a "project-stopped" event is emitted.
   */
  stop() {
    this.concurrency.stop = true;
  }

  async getResourceToScrape() {
    try {
      const resource = await this.concurrency.getResourceToScrape(this.project);
      // no more available resources to be scraped, project scraping complete
      if (!resource) {
        await this.postScrape();
        this.logger.info(`Project ${this.project.name} scraping complete`);
        this.emit(ScrapeEvent.ProjectScraped, this.project);
      }
      else {
        this.emit(ScrapeEvent.ResourceSelected, this.project, resource);
        this.scrapeResource(resource);
      }
    }
    catch (err) {
      // normal concurrency errors based on the existing concurrency options
      if (err instanceof ConcurrencyError) {
        this.logger.debug(`Concurrency conditions for project ${this.project.name} not met at ${err.level} level`);
      }
      // invalid concurrency state, abort the entire scraping process
      else {
        this.logger.error(err, 'concurrency error');
        await this.postScrape();
        this.emit(ScrapeEvent.ProjectError, this.project, err);
      }
    }
  }

  /**
   * Sequentially executes the project plugins against the current resource.
   * It usually starts with an available resource being selected from db and ends with the resource being updated with the scraped content.
   * @param resource - current scraping resource
   */
  async scrapeResource(resource: Resource) {
    // dynamic resource, a resource that was modified by a dynamic action: scroll, click, ..
    if (resource && resource.actions) {
      this.logger.info('Started re-scraping a dynamic resource from project %s, url %s, dynamic action %s', this.project.name, resource.url, resource.actions);
    }
    else {
      this.logger.info('Started scraping a new resource from project %s', this.project.name);
    }

    let pluginIdx: number;
    try {
      // sequentially execute project plugins in the defined order
      for (pluginIdx = 0; pluginIdx < this.project.plugins.length; pluginIdx += 1) {
        // a plugin result represents additional data/content to be merged with the current resource
        const result = await this.executePlugin(resource, this.project.plugins[pluginIdx]);
        this.logger.debug(result || {}, 'Plugin result');

        // current plugin did not returned a result, move on to the next one
        if (!result) continue;

        // new content has been generated to be merged wih the current resource
        Object.assign(resource, result);
      }

      this.logger.debug(resource, 'Resource successfully scraped');
      this.logger.info('Resource %s successfully scraped with actions %s', resource.url, resource.actions);
    }
    catch (err) {
      this.logger.error(
        err,
        'Scrape error for project %s , Plugin %s against resource %s',
        this.project.name, this.project.plugins[pluginIdx].constructor.name, resource ? resource.url : '',
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

      this.emit(ScrapeEvent.ResourceError, this.project, resource, err);
      return;
    }

    /*
    resource is a dynamic one, successfully modified by a dynamic action: scroll, click, ..
    scrape the newly generated content by re-triggering the scrape plugins
    keep the same proxy as chained dynamic actions only make sense within the same session
    */
    if (
      resource
    && resource.actions
    && resource.actions.length > 0
    ) {
      const dynamicResource:Resource = (
        ({ url, depth, contentType, parent, actions, proxy }) => this.project.createResource({ url, depth, contentType, parent, actions, proxy })
      )(resource);
      this.scrapeResource(dynamicResource);
    }
    /*
    scraping of the current resource is complete
    resource can be:
    - static
    - dynamic with no more dynamic actions available
    */
    else {
      this.emit(ScrapeEvent.ResourceScraped, this.project, resource);
    }
  }

  /**
   * Executes the current plugin in either node.js or browser environment.
   * @param project - current scraping project
   * @param resource - current scraping resource
   * @param plugin - current scraping plugin
   */
  async executePlugin(resource: Resource, plugin: Plugin):Promise<void | Partial<Resource>> {
    this.logger.debug(
      'Executing plugin %s using options %o , against resource %o',
      plugin.constructor.name, plugin.opts, resource,
    );

    if (plugin.opts && (plugin.opts.domRead || plugin.opts.domWrite)) {
      return resource && /html/.test(resource.contentType) ? this.executePluginInDom(resource, plugin) : null;
    }

    // test if plugin is aplicable
    const isApplicable = await plugin.test(this.project, resource);
    this.logger.debug(
      'Plugin %s isApplicable: %s',
      plugin.constructor.name, isApplicable,
    );
    if (isApplicable) {
      return plugin.apply(this.project, resource, this.browserClient || this.domClientConstruct);
    }

    return null;
  }

  /*
  async run the plugin in DOM
  use a block declaration in order not to polute the global namespace
  avoiding conflicts, thus redeclaration errors
  */
  async executePluginInDom(resource: Resource, plugin: Plugin):Promise<void | Partial<Resource>> {
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
           const isApplicable = await window.${pluginInstanceName}.test(${JSON.stringify((await this.project.toExecJSON()))}, ${JSON.stringify(resource.toExecJSON())});
           if (isApplicable) {
             result = await window.${pluginInstanceName}.apply(${JSON.stringify(this.project)}, ${JSON.stringify(resource.toExecJSON())});
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
