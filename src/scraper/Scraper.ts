/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
import { join, isAbsolute } from 'path';
import EventEmitter from 'events';
import BrowserClient from '../browserclient/BrowserClient';
import Project, { IStaticProject } from '../storage/base/Project';
import Resource from '../storage/base/Resource';
import Plugin, { PluginOpts } from '../plugins/Plugin';
import PluginStore, { StoreEntry } from '../pluginstore/PluginStore';
import { getLogger } from '../logger/Logger';
import Storage, { StorageOptions } from '../storage/base/Storage';
import { pipelines, mergePluginOpts } from '../pipelines/pipelines';
import { IDomClientConstructor } from '../domclient/DomClient';
import ConcurrencyManager, { ConcurrencyError, ConcurrencyOptions } from './ConcurrencyManager';
import RuntimeMetrics, { RuntimeMetricsError, RuntimeOptions } from './RuntimeMetrics';
import initClient from '../domclient/client-utils';
import ModelStorage, { ModelStorageOptions } from '../storage/ModelStorage';

export const enum ScrapeEvent {
  ResourceSelected = 'resource-selected',
  ResourceScraped = 'resource-scraped',
  ResourceError = 'resource-error',

  ProjectSelected = 'project-selected',
  ProjectScraped = 'project-scraped',
  ProjectError = 'project-error',

  DiscoverComplete = 'discover-complete'
}

export type CliOptions = {
  /**
   * Overwrite project if already exists.
   */
  overwrite: boolean;

  /**
    * Don't restrict scraping to a particular project.
    * Once scraping a project completes, find other existing projects to scrape from.
    */
  discover: boolean;

  /**
    * After a discover operation completes and all projects are scraped,
    * keep issueing discover commands at the specified interval (seconds).
    */
  retry: number;
}

export type ClientOptions = {
  name: string;
  opts?: {
    [key: string]: any;
  }
}

export type ProjectOptions = {
  /**
   * Project name
   */
  name: string

  resources?: { url: string, depth?: number }[];
  resourcePath?: string;

  pipeline: string,
  pluginOpts: PluginOpts[]
}

export type ScrapeConfig = {
  storage: StorageOptions | Storage,
  client: ClientOptions | BrowserClient | IDomClientConstructor,
  project: ProjectOptions | Project,
  concurrency: ConcurrencyOptions,
  runtime: RuntimeOptions
}

/**
 * Executes defined scrape plugins against to be scraped resources.
 * Storage agnostic.
 * Browser client agnostic.
 * Will connect to db if provided storage not already connected.
 * Will open browser client if provided browser client not already opened.
 */
export default class Scraper extends EventEmitter {
  logger = getLogger('Scraper');

  modelStorage: ModelStorage;

  browserClient: BrowserClient;
  domClientConstruct: IDomClientConstructor;

  project: Project;

  concurrency: ConcurrencyManager;
  checkTimeout: NodeJS.Timeout;
  retryTimeout: NodeJS.Timeout;

  /**
  * Contains memory and cpu usage metrics
  */
  metrics: RuntimeMetrics;

  constructor(storageOpts: StorageOptions | Storage | ModelStorageOptions, clientOpts: ClientOptions | BrowserClient | IDomClientConstructor) {
    super();

    this.modelStorage = new ModelStorage(storageOpts);

    if (!clientOpts) {
      const err = new Error('A browser or DOM client needs to be provided');
      this.logger.error(err);
      throw err;
    }

    const client = this.isClientOpts(clientOpts) ? initClient(clientOpts) : clientOpts;
    if (client instanceof BrowserClient) {
      this.browserClient = client;
    }
    else {
      this.domClientConstruct = client;
    }

    this.discover = this.discover.bind(this);
    this.stop = this.stop.bind(this);

    // gracefully stop scraping
    this.gracefullStop('SIGTERM');
    this.gracefullStop('SIGINT');
  }

  /**
   * Check if input is a JSON config object
   */
  isJSONConfig(config): boolean {
    /*
    config objects:
    - are not custom class definitions
    - are not ciustom class instances
    - don't have function properties
    */
    return config.constructor.name === 'Object'
      && Object.keys(config).find(key => typeof config[key] === 'function') === undefined;
  }

  isStorageOpts(storage): storage is StorageOptions {
    return this.isJSONConfig(storage);
  }

  isClientOpts(client): client is ClientOptions {
    return this.isJSONConfig(client);
  }

  /**
   * wait for in-progress scraping to complete before exiting
   */
  gracefullStop(signal: NodeJS.Signals) {
    process.on(signal, () => {
      this.logger.info(`${signal} signal received`);

      // in-between discovery retries, no scraping going on, can exit directly
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.logger.info('no in-progress scraping detected, exit directly');
        process.exit(0);
      }
      // ongoing scraping, don't scrape new resources, wait for the currently in progress ones to complete
      else {
        this.on(ScrapeEvent.ProjectScraped, () => process.exit(0));
        this.on(ScrapeEvent.DiscoverComplete, () => process.exit(0));
        this.logger.info('in-progress scraping detected, stop scraping new resources, exit after current ones complete');
        this.stop();
      }
    });
  }

  initConcurrencyManager(concurrencyOpts?: Partial<ConcurrencyOptions>): ConcurrencyManager {
    return new ConcurrencyManager(concurrencyOpts);
  }

  /**
   * Pre-scrape preparations regarding PluginStore, storage and browser client.
   * Making sure default plugins are registered, a connection to a database is opened, a browser (if apllicable) is launched.
   */
  async preScrape(concurrencyOpts?: Partial<ConcurrencyOptions>, runtimeOpts?: Partial<RuntimeOptions>): Promise<void> {
    if (PluginStore.store.size === 0) {
      await PluginStore.init();
      this.logger.info(`PluginStore initialized, ${PluginStore.store.size} plugins found`);
    }

    await this.modelStorage.connect();
    this.logger.info('Storage connected');

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

      this.concurrency = this.initConcurrencyManager(concurrencyOpts);
      // concurrencyManager needs to update its status based on resource error/complete
      this.on(ScrapeEvent.ResourceScraped, this.concurrency.resourceScraped);
      this.on(ScrapeEvent.ResourceError, this.concurrency.resourceError);
    }

    if (this.metrics) {
      throw new Error('scraping already in progress');
    }
    else {
      this.metrics = new RuntimeMetrics(runtimeOpts);
    }

    if (this.browserClient && !this.browserClient.isLaunched) {
      await this.browserClient.launch();
      this.logger.info('Browser launched');
    }
  }

  /**
   * If projectOpts is a project instance return it without modifications.
   * If it's a project configuration save a new project.
   * @param projectOpts - project instance or configuration
   * @param cliOpts - cli related flags like overwrite
   */
  async initProject(projectOpts: Project | ProjectOptions, cliOpts: Partial<CliOptions> = {}): Promise<Project> {
    if (projectOpts instanceof Project) {
      return <Project>projectOpts;
    }

    if (projectOpts.pipeline && !pipelines[projectOpts.pipeline]) {
      throw new Error(`Pipeline ${projectOpts.pipeline} not found. Available pipelines are:  ${Object.keys(pipelines).join(', ')}`);
    }

    const { Project: ExtProject } = await this.modelStorage.getModels();
    let project = await ExtProject.get(projectOpts.name);

    if (project) {
      if (cliOpts.overwrite) {
        this.logger.info(`Overwriting project ${project.name}`);
        await project.del();
      }
      else {
        this.logger.info(`Existing project ${project.name} will be used`);
        return project;
      }
    }

    project = new (<IStaticProject>ExtProject)({
      name: projectOpts.name,
      pluginOpts: pipelines[projectOpts.pipeline]
        ? mergePluginOpts(pipelines[projectOpts.pipeline].defaultPluginOpts, projectOpts.pluginOpts)
        : projectOpts.pluginOpts,
    });
    await project.save();
    this.logger.info(`New project ${project.name} saved`);

    // link resources to the project from external file
    let { resourcePath } = projectOpts;
    if (resourcePath) {
      resourcePath = isAbsolute(resourcePath) ? resourcePath : join(process.cwd(), resourcePath);
      await project.queue.batchInsertResourcesFromFile(resourcePath);
    }

    // link resources to the project from inline definition
    const { resources } = projectOpts;
    if (resources && Array.isArray(resources)) {
      await project.queue.batchInsertResources(resources);
    }

    return project;
  }

  /**
   * Cleanup the current completed scraping process before starting a new one.
   * Invoked before ScrapeEvent.ProjectComplete, ScrapeEvent.ProjectError so that consecutive project scraping
   * (triggered on ProjectComplete, ProjectError) have no overlap.
   */
  async postScrape() {
    try {
      // scraping stopped, if resumed new concurrency, metrics instances will be created
      if (this.concurrency) {
        clearInterval(this.checkTimeout);
        this.off(ScrapeEvent.ResourceScraped, this.concurrency.resourceScraped);
        this.off(ScrapeEvent.ResourceError, this.concurrency.resourceError);
      }
      delete this.concurrency;
      delete this.metrics;

      if (this.browserClient && this.browserClient.isLaunched) {
        await this.browserClient.close();
      }

      if (this.modelStorage) {
        await this.modelStorage.close();
      }
    }
    catch (err) {
      this.logger.error(err);
    }
  }

  /**
   * Scrapes available resources from the provided project. If project options are provided create the project first.
   * @param projectOpts - project instance or project options
   * @param concurrencyOpts - concurrency options
   * @param runtimeOpts - runtime options
   * @param cliOpts - command line options
   */
  async scrape(
    projectOpts: ProjectOptions | Project,
    concurrencyOpts?: Partial<ConcurrencyOptions>,
    runtimeOpts?: Partial<RuntimeOptions>,
    cliOpts?: Partial<CliOptions>,
  ): Promise<void> {
    try {
      await this.preScrape(concurrencyOpts, runtimeOpts);

      // when discover flag is set ignore projectOpts, retrieve first project containing unscraped resources
      if (cliOpts && cliOpts.discover) {
        const { Project: ExtProject } = await this.modelStorage.getModels();
        this.project = await ExtProject.getProjectToScrape();
        if (!this.project) {
          this.logger.info('All existing project have been scraped, discovery complete');
          this.postScrape();
          this.emit(ScrapeEvent.DiscoverComplete);
          return;
        }
      }
      else {
        this.project = await this.initProject(projectOpts, cliOpts);
        if (!this.project) throw new Error('could not find project');
      }

      this.project.plugins = await this.project.initPlugins(!!this.browserClient);

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
   * Keep discovering new projects to scrape. Once a project scraping completes, start scraping a new one.
   */
  async discover(concurrencyOpts: Partial<ConcurrencyOptions>, runtimeOpts: Partial<RuntimeOptions>, cliOpts: Partial<CliOptions>) {
    this.retryTimeout = null;

    const projectScrapedHandler = () => {
      this.logger.info('Discovering new project(s)');
      this.scrape(null, concurrencyOpts, runtimeOpts, cliOpts);
    };

    const discoveryCompleteHandler = () => {
      this.off(ScrapeEvent.ProjectScraped, projectScrapedHandler);
      this.off(ScrapeEvent.ProjectError, projectScrapedHandler);
      this.off(ScrapeEvent.DiscoverComplete, discoveryCompleteHandler);

      if (cliOpts.retry) {
        this.retryTimeout = setTimeout(this.discover, cliOpts.retry * 1000, concurrencyOpts, runtimeOpts, cliOpts);
      }
    };

    this.on(ScrapeEvent.ProjectScraped, projectScrapedHandler);
    this.on(ScrapeEvent.ProjectError, projectScrapedHandler);
    this.on(ScrapeEvent.DiscoverComplete, discoveryCompleteHandler);

    this.logger.info('Discovering new project(s)');
    this.scrape(null, concurrencyOpts, runtimeOpts, cliOpts);
  }

  async save(projectOpts: ProjectOptions | Project, cliOpts: Partial<CliOptions>) {
    try {
      await this.modelStorage.connect();
      this.logger.info('Storage connected');

      this.project = await this.initProject(projectOpts, cliOpts);
      if (!this.project) throw new Error('could not find project');

      await this.modelStorage.close();
    }
    catch (err) {
      this.logger.error(err);
    }
  }

  /**
   * Stop the current scraping process. This will not happen instantly.
   * After all in-progress scraping completes, a "project-stopped" event is emitted.
   */
  stop() {
    if (this.concurrency) {
      this.concurrency.stop = true;
    }
  }

  async getResourceToScrape(): Promise<Resource> {
    let resource: Resource;

    try {
      // check if scraper cpu and memory usage are within the defined limits
      this.metrics.check();

      resource = await this.concurrency.getResourceToScrape(this.project);

      if (resource) {
        this.emit(ScrapeEvent.ResourceSelected, this.project, resource);
        await this.scrapeResource(resource);
      }
      // no more available resources to be scraped, project scraping complete
      else {
        await this.postScrape();
        this.logger.info(`Project ${this.project.name} scraping complete`);
        this.emit(ScrapeEvent.ProjectScraped, this.project);
      }
    }
    catch (err) {
      /*
      normal process usage error based on the existing memory/cpu thresholds,
      not issuing new scraping requests and waiting for existing ones to complete will (hopefully) bring the usage down
      */
      if (err instanceof RuntimeMetricsError) {
        this.logger.debug(err.snapshot, `Runtime conditions for project ${this.project.name} not met`);
      }
      // normal concurrency errors based on the existing concurrency options
      else if (err instanceof ConcurrencyError) {
        this.logger.debug(`Concurrency conditions for project ${this.project.name} not met at ${err.level} level`);
      }
      // invalid concurrency state, abort the entire scraping process
      else {
        this.logger.error(err, 'getResourceToScrape');
        this.stop();
        this.emit(ScrapeEvent.ProjectError, this.project, err);
      }
    }

    return resource;
  }

  /**
   * Sequentially executes the project plugins against the current resource.
   * It usually starts with an available resource being selected from db and ends with the resource being updated with the scraped content.
   * @param resource - current scrape resource
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
      if (resource.actions) {
        this.logger.info('Resource %s successfully scraped with actions %s', resource.url, resource.actions);
      }
      else {
        this.logger.info('Resource %s successfully scraped', resource.url);
      }
    }
    catch (err) {
      // optional chaining not available till node v14, check all chains are valid, we may be in an invalid state
      this.logger.error(
        err,
        'Scrape error for project %s , Plugin %s against resource %s',
        this.project ? this.project.name : 'undefined project',
        this.project && this.project.plugins && this.project.plugins[pluginIdx] && this.project.plugins[pluginIdx].constructor ? this.project.plugins[pluginIdx].constructor.name : 'unknown plugin',
        resource ? resource.url : '',
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
        resource is not yet saved to db, update the corresponding queue entry with an error status
        so that we don't attempt to scrape the same url again,  possibly ending with the same error in an infinite loop
        */
        await this.project.queue.updateStatus(resource.queueEntryId, 500);
      }

      this.emit(ScrapeEvent.ResourceError, this.project, resource, err);
      return;
    }

    /*
    resource is a dynamic one, successfully modified by a dynamic action: scroll, click, ..
    scrape the newly generated content by re-triggering the scrape plugins
    keep the same proxy as chained dynamic actions only make sense within the same session
    only do it if scraper is not about to stop
    */
    if (
      resource
      && resource.actions
      && resource.actions.length > 0
      && this.concurrency
      && !this.concurrency.stop
    ) {
      const dynamicResource: Resource = (
        (
          { url, queueEntryId, status, depth, contentType, parent, actions, proxy },
        ) => this.project.createResource(
          {
            url, queueEntryId, status, depth, contentType, parent, actions, proxy,
          },
        )
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
   * @param project - current scrape project
   * @param resource - current scrape resource
   * @param plugin - current scrape plugin
   */
  async executePlugin(resource: Resource, plugin: Plugin): Promise<void | Partial<Resource>> {
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
  async executePluginInDom(resource: Resource, plugin: Plugin): Promise<void | Partial<Resource>> {
    // scraper doesn't rely on a browser client but a nodejs dom client, can't inject js in clients like cheerio
    if (!this.browserClient) {
      throw new Error('browserClient unavailable');
    }

    // plugins running in DOM assume a valid resource has already been fetched
    if (!resource) return null;

    const pluginClsName = plugin.constructor.name;
    const pluginInstanceName = `inst${pluginClsName}`;
    const pluginStoreEntry: StoreEntry = PluginStore.get(pluginClsName);
    if (!pluginStoreEntry) {
      throw new Error(`Plugin ${pluginClsName} not registered`);
    }
    if (!pluginStoreEntry.bundle) {
      throw new Error(`Bundle ${pluginClsName} not present`);
    }

    this.logger.debug('injecting plugin in browser tab: %s', pluginClsName);
    const code = `
     {
       (async function() {
         try {
           // instantiate plugin instance, one time only, multiple plugin invocations will retain the previous plugin state
           if (!window.${pluginInstanceName}) {
             ${pluginStoreEntry.bundle}
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
}
