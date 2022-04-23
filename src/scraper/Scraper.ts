/* eslint-disable no-continue */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
import { join, isAbsolute } from 'path';
import EventEmitter from 'events';
import BrowserClient from '../browserclient/BrowserClient';
import Project from '../storage/base/Project';
import Resource from '../storage/base/Resource';
import Plugin, { PluginOpts } from '../plugins/Plugin';
import PluginStore, { StoreEntry } from '../pluginstore/PluginStore';
import { getLogger } from '../logger/Logger';
import { pipelines, mergePluginOpts } from '../pipelines/pipelines';
import { IDomClientConstructor } from '../domclient/DomClient';
import ConcurrencyManager, { ConcurrencyError, ConcurrencyOptions } from './ConcurrencyManager';
import RuntimeMetrics, { RuntimeMetricsError, RuntimeOptions } from './RuntimeMetrics';
import initClient from '../domclient/client-utils';
import ConnectionManager, { PerModelConfig } from '../storage/ConnectionManager';
import Connection, { ConnectionConfig } from '../storage/base/Connection';
import QueueBuffer from './QueueBuffer';

export const enum ScrapeEvent {
  ResourceSelectError = 'resource-select-error',
  ResourceSelected = 'resource-selected',
  ResourceScrapeError = 'resource-scrape-error',
  ResourceScraped = 'resource-scraped',

  ProjectSelected = 'project-selected',
  ProjectScraped = 'project-scraped',
  ProjectError = 'project-error',

  DiscoveryCompleted = 'discovery-completed'
}

export type DiscoverOptions = {
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
  name: string;

  resources?: { url: string, depth?: number }[];
  resourcePath?: string;

  pipeline: string;
  pluginOpts: PluginOpts[];

  /**
   * Overwrite project if already exists.
   */
  overwrite?: boolean;
}

export type ScrapeConfig = {
  storage: ConnectionConfig | Connection,
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

  connectionMng: ConnectionManager;

  browserClient: BrowserClient;
  domClientConstruct: IDomClientConstructor;

  concurrency: ConcurrencyManager;
  checkTimeout: NodeJS.Timeout;
  discoverTimeout: NodeJS.Timeout;

  /**
   * If set no new resources are selected to be scraped.
   * Once all in-progress scraping completes, a "project-stopped" event is dispathed.
   */
  stop: boolean;

  concurrencyOpts: Partial<ConcurrencyOptions>;
  runtimeOpts: Partial<RuntimeOptions>;
  discoveryOpts: Partial<DiscoverOptions>;

  /**
   * Serves two purposes
   * - to-be-scraped resources are retrieved in bulk with queue entry status set to 1 (scrape in progress)
   * - non-eligible buffered resources (due to concurrency conditions) don't have the in-progress status reverted,
   *  they remain in buffer surely to become eligible in the future
   */
  queueBuffer: QueueBuffer;

  metrics;

  project: Project;

  constructor(storageOpts: ConnectionConfig | Connection | PerModelConfig, clientOpts: ClientOptions | BrowserClient | IDomClientConstructor) {
    super();

    this.connectionMng = new ConnectionManager(storageOpts);

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
    this.getResourceToScrape = this.getResourceToScrape.bind(this);
    this.scrapeProject = this.scrapeProject.bind(this);
    this.scrapeResource = this.scrapeResource.bind(this);
    this.gracefullStopHandler = this.gracefullStopHandler.bind(this);

    // gracefully stop scraping
    process.on('SIGTERM', this.gracefullStopHandler);
    process.on('SIGINT', this.gracefullStopHandler);

    // scrape workflow is (mostly) controlled via events
    this.on(ScrapeEvent.ResourceSelected, this.scrapeResource);

    this.on(ScrapeEvent.ProjectSelected, this.scrapeProject);
    this.on(ScrapeEvent.ProjectError, this.postScrapeProject);
    this.on(ScrapeEvent.ProjectScraped, this.postScrapeProject);

    this.on(ScrapeEvent.DiscoveryCompleted, this.postDiscover);

    this.on(ScrapeEvent.ResourceScraped, this.fastForwardGetResourceToScrape);
    this.on(ScrapeEvent.ResourceScrapeError, this.fastForwardGetResourceToScrape);
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

  isClientOpts(client): client is ClientOptions {
    return this.isJSONConfig(client);
  }

  preChecks() {
    if (this.checkTimeout) {
      throw new Error('scraping already in progress');
    }

    // only sequential scraping is supported for browser clients like Puppeteer, Playwright
    const { concurrencyOpts } = this;
    if (this.browserClient && concurrencyOpts && Object.keys(concurrencyOpts).find(
      level => concurrencyOpts[level] && concurrencyOpts[level].maxRequests && concurrencyOpts[level].maxRequests !== 1,
    )) {
      throw new Error('concurrency condition maxRequests is not supported on browser clients');
    }
  }

  async init() {
    this.preChecks();

    if (PluginStore.store.size === 0) {
      await PluginStore.init();
      this.logger.info(`PluginStore initialized, ${PluginStore.store.size} plugins found`);
    }

    await this.connectionMng.connect();
    this.logger.info('Storage connected');

    if (this.browserClient && !this.browserClient.isLaunched) {
      await this.browserClient.launch();
      this.logger.info('Browser launched');
    }
  }

  fastForwardGetResourceToScrape() {
    if (this.concurrency.status.project.requests === this.concurrency.opts.project.maxRequests - 1) {
      clearInterval(this.checkTimeout);
      this.getResourceToScrape();
      this.checkTimeout = setInterval(this.getResourceToScrape, this.concurrency.getCheckInterval());
    }
  }

  /**
   * If projectOpts is a project instance return it without modifications.
   * If it's a project configuration save a new project.
   * @param projectOpts - project instance or configuration
   * @param cliOpts - cli related flags like overwrite
   */
  async initProject(projectOpts: Project | ProjectOptions): Promise<Project> {
    if (projectOpts instanceof Project) {
      return <Project>projectOpts;
    }

    if (projectOpts.pipeline && !pipelines[projectOpts.pipeline]) {
      throw new Error(`Pipeline ${projectOpts.pipeline} not found. Available pipelines are:  ${Object.keys(pipelines).join(', ')}`);
    }

    const ExtProject = await this.connectionMng.getProject();
    let project = await ExtProject.get(projectOpts.name);

    if (project) {
      if (projectOpts.overwrite) {
        this.logger.info(`Overwriting project ${project.name}`);
        await project.del();
      }
      else {
        this.logger.info(`Existing project ${project.name} will be used`);
        return project;
      }
    }

    project = new ExtProject({
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
      await project.queue.addFromFile(resourcePath);
    }

    // link resources to the project from inline definition
    const { resources } = projectOpts;
    if (resources && Array.isArray(resources)) {
      await project.queue.normalizeAndAdd(resources);
    }

    return project;
  }

  async scrape(
    projectOpts: ProjectOptions | Project,
    concurrencyOpts?: Partial<ConcurrencyOptions>,
    runtimeOpts?: Partial<RuntimeOptions>,
  ) {
    if (concurrencyOpts) this.concurrencyOpts = concurrencyOpts;
    if (runtimeOpts) this.runtimeOpts = runtimeOpts;

    try {
      await this.init();
      const project = await this.initProject(projectOpts);
      this.emit(ScrapeEvent.ProjectSelected, project, []);
    }
    catch (err) {
      this.logger.error(err);
      await this.cleanup();
      this.emit(ScrapeEvent.ProjectError, undefined, err);
    }
  }

  async preScrapeProject(project: Project, resources: Resource[]) {
    // concurrencyManager needs to update its status based on resource error/complete
    this.concurrency = new ConcurrencyManager(this.concurrencyOpts);
    this.on(ScrapeEvent.ResourceScraped, this.concurrency.resourceScraped);
    this.on(ScrapeEvent.ResourceScrapeError, this.concurrency.resourceError);

    this.queueBuffer = new QueueBuffer(this.concurrency.getBufferSize());
    this.queueBuffer.init(project, resources);

    this.metrics = new RuntimeMetrics(this.runtimeOpts);

    // create plugin instances based on plugin options
    project.plugins = await project.initPlugins(!!this.browserClient);
    this.logger.info(
      (({ id, name, pluginOpts }) => ({ id, name, pluginOpts }))(project),
      'Scraping project',
    );
  }

  async scrapeProject(project: Project, resources: Resource[]) {
    this.project = project;
    await this.preScrapeProject(project, resources);

    clearInterval(this.checkTimeout);
    this.getResourceToScrape();
    this.checkTimeout = setInterval(this.getResourceToScrape, this.concurrency.getCheckInterval());
  }

  async getResourceToScrape():Promise<void> {
    let resource:Resource;

    try {
      // check if scraper cpu and memory usage are within the defined limits
      this.metrics.check();

      resource = await this.queueBuffer.getResource(this.stop);

      if (resource) {
        // possible improvement: scan the entire buffer, pick 1st valid entry, don't limit the scan to the 1st entry queueBuffer returns
        this.concurrency.check(resource);
        this.concurrency.addResource(resource);

        this.emit(ScrapeEvent.ResourceSelected, this.project, resource);
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
        this.logger.debug(`Concurrency status at ${err.level} : ${JSON.stringify(this.concurrency.status[err.level])}`);

        // new resource is not meeting concurrency conditions, postpone its scraping, re-add it to the buffer
        this.queueBuffer.addResources([ resource ]);
      }
      /*
      unknown error
      even if it gets thrown on each invocation, eventually the isScrapingComplete check will stop the scraping
      */
      else {
        this.logger.error(err);

        if (resource) {
          await this.project.queue.updateStatus(resource.queueEntryId, 500, err.code || 'GET_RESOURCE_TO_SCRAPE_ERROR');
          this.emit(ScrapeEvent.ResourceSelectError, this.project, resource, err);
        }
      }
    }
    finally {
      if (!resource && this.concurrency.isScrapingComplete()) {
        this.logger.info(`Project ${this.project.name} scraping complete`);
        await this.cleanup();
        this.emit(ScrapeEvent.ProjectScraped, this.project);
      }
    }
  }

  /**
   * After each project scraped/in-error and discovery complete do some cleanup.
   * Remove event listners, close db connections.
   */
  async cleanup() {
    try {
      // scraping stopped, if resumed new concurrency, metrics instances will be created
      if (this.concurrency) {
        this.off(ScrapeEvent.ResourceScraped, this.concurrency.resourceScraped);
        this.off(ScrapeEvent.ResourceScrapeError, this.concurrency.resourceError);
      }
      delete this.concurrency;
      delete this.metrics;
      delete this.queueBuffer;

      clearInterval(this.checkTimeout);
      delete this.checkTimeout;

      // do all async cleanup operations in parallel
      const cleanupOps: Promise<void>[] = [];

      if (this.browserClient && this.browserClient.isLaunched) {
        cleanupOps.push(this.browserClient.close());
      }

      if (this.connectionMng) {
        cleanupOps.push(this.connectionMng.close());
      }

      await Promise.all(cleanupOps);
    }
    catch (err) {
      this.logger.error(err);
    }
  }

  async postScrapeProject() {
    if (!this.stop && this.discoveryOpts?.discover) {
      this.discover();
    }
  }

  async discover(concurrencyOpts?: Partial<ConcurrencyOptions>, runtimeOpts?: Partial<RuntimeOptions>, discoveryOpts?: Partial<DiscoverOptions>) {
    if (concurrencyOpts) this.concurrencyOpts = concurrencyOpts;
    if (runtimeOpts) this.runtimeOpts = runtimeOpts;
    if (discoveryOpts) this.discoveryOpts = discoveryOpts;

    delete this.discoverTimeout;
    this.logger.info('Discovering new project(s)');

    try {
      await this.init();

      const ExtProject = await this.connectionMng.getProject();
      const { project, resources } = await ExtProject.getProjectToScrape();

      if (!project) {
        this.logger.info('All existing project have been scraped, discovery complete');
        await this.cleanup();
        this.emit(ScrapeEvent.DiscoveryCompleted);
      }
      else {
        this.emit(ScrapeEvent.ProjectSelected, project, resources);
      }
    }
    catch (err) {
      await this.cleanup();
      this.emit(ScrapeEvent.ProjectError, undefined, err);
    }
  }

  async save(projectOpts: ProjectOptions) {
    try {
      await this.connectionMng.connect();
      this.logger.info('Storage connected');

      this.project = await this.initProject(projectOpts);
      if (!this.project) throw new Error('could not find project');

      await this.connectionMng.close();
    }
    catch (err) {
      this.logger.error(err);
      this.emit(ScrapeEvent.ProjectError, undefined, err);
    }
  }

  async postDiscover() {
    if (this.discoveryOpts?.retry) {
      this.logger.info(`Resume project discovery after ${this.discoveryOpts.retry} seconds`);
      this.discoverTimeout = setTimeout(this.discover, this.discoveryOpts.retry * 1000);
    }
  }

  /**
   * wait for in-progress scraping to complete before exiting
   */
  async gracefullStopHandler(signal: NodeJS.Signals) {
    this.logger.warn(`${signal} signal received`);

    // in-between discovery retries, no scraping going on, can exit directly
    if (this.discoverTimeout) {
      clearTimeout(this.discoverTimeout);
      this.logger.warn('no in-progress scraping detected, exit directly');
      await this.cleanup();
    }
    // ongoing scraping, don't scrape new resources, wait for the currently in progress ones to complete
    else if (this.checkTimeout) {
      this.logger.warn('in-progress scraping detected, stop scraping new resources, exit after current ones complete');
      this.stop = true;
    }
    // scraping has not yet started
    else {
      this.logger.warn('scraping has not yet started, exit directly');
      process.exit(0);
    }
  }

  /**
   * Sequentially executes the project plugins against the incoming resource.
   * It usually starts with an available resource being selected from db and ends with the resource being updated with the scraped content.
   */
  async scrapeResource(project: Project, resource: Resource) {
    // dynamic resource, a resource that was modified by a dynamic action: scroll, click, ..
    if (resource && resource.actions) {
      this.logger.info('Started re-scraping a dynamic resource from project %s, url %s, dynamic action %s', project.name, resource.url, resource.actions);
    }
    else {
      this.logger.info('Started scraping a new resource from project %s', project.name);
    }

    let pluginIdx: number;
    let plugin: Plugin;
    try {
      // sequentially execute project plugins in the defined order
      for (pluginIdx = 0; pluginIdx < project.plugins.length; pluginIdx += 1) {
        plugin = project.plugins[pluginIdx];
        // a plugin result represents additional data/content to be merged with the current resource
        const result = await this.executePlugin(resource, plugin);
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
      this.logger.error(
        err,
        'Scrape error for project %s , Plugin %s against resource %s, PluginOpts: %s',
        project?.name,
        plugin?.constructor?.name,
        resource?.url,
        JSON.stringify(plugin?.opts),
      );

      /*
        manually update the resource, this resets the scrapeInProgress flag and adds scrapedAt date
        selecting new resources for scraping takes scrapedAt in consideration (right now only resources with scrapedAt undefined qualify)
        because of the above behavior, we don't attempt to scrape a resource that throws an error over and over again

        in future a possible approach will be just resetting the scrapeInProgress flag
          - next scrape operation will attempt to scrape it again, but atm this will just retry the same resource over and over again
          - there is no mechanism to escape the retry loop
        */
      if (resource) {
        /*
          error occured
          resource is not yet saved to db, update the corresponding queue entry with
            - non-succesfull http response status code so that we don't attempt to scrape the same url again,
            possibly ending with the same error in an infinite loop
            - optional error code when status code is not enough: dns, network, parsing errors ...
          */
        await project.queue.updateStatus(resource.queueEntryId, 500, err.code || 'SCRAPE_RESOURCE_ERROR');
      }

      this.emit(ScrapeEvent.ResourceScrapeError, project, resource, err);
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
        && !this.stop
    ) {
      const dynamicResource: Resource = (
        (
          { url, queueEntryId, status, depth, contentType, parent, actions, proxy, hostname },
        ) => project.createResource(
          {
            url, queueEntryId, status, depth, contentType, parent, actions, proxy, hostname,
          },
        )
      )(resource);
      this.scrapeResource(project, dynamicResource);
    }
    /*
      scraping of the current resource is complete
      resource can be:
      - static
      - dynamic with no more dynamic actions available
      */
    else {
      this.emit(ScrapeEvent.ResourceScraped, project, resource);
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
      resource,
      'Executing plugin %s using options %o , against resource',
      plugin.constructor.name,
      plugin.opts,
    );

    if (plugin.opts && (plugin.opts.domRead || plugin.opts.domWrite)) {
      return resource && /html/.test(resource.contentType) ? this.executePluginInDom(resource, plugin) : null;
    }

    // test if plugin is aplicable
    const isApplicable = await plugin.test(this.project, resource);
    this.logger.debug(
      'Plugin %s isApplicable: %s',
      plugin.constructor.name,
      isApplicable,
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

  async getProject(projectOpts: ProjectOptions): Promise<Project> {
    let project:Project;

    try {
      if (PluginStore.store.size === 0) {
        await PluginStore.init();
        this.logger.info(`PluginStore initialized, ${PluginStore.store.size} plugins found`);
      }

      await this.connectionMng.connect();
      this.logger.info('Storage connected');

      const ExtProject = await this.connectionMng.getProject();
      project = await ExtProject.get(projectOpts.name);

      await this.connectionMng.close();
    }
    catch (err) {
      this.logger.error(err);
    }

    if (!project) throw new Error(`could not find project ${projectOpts.name}`);

    return project;
  }
}
