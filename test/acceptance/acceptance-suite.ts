/* eslint-disable no-param-reassign */
import { unlinkSync } from 'fs';
import { join } from 'path';
import { GsfServer, ScrapingSuite, IScrapingTest } from '@get-set-fetch/test-utils';
import BrowserClient from '../../src/browserclient/BrowserClient';
import { pipelines, mergePluginOpts } from '../../src/pipelines/pipelines';
import Scraper, { ScrapeEvent } from '../../src/scraper/Scraper';
import { IStaticProject } from '../../src/storage/base/Project';
import Storage from '../../src/storage/base/Storage';
import { IDomClientConstructor } from '../../src/domclient/DomClient';
import { ConcurrencyOptions } from '../../src/scraper/ConcurrencyManager';
import { PluginOpts, ZipExporter } from '../../src';

function getConcurrencyInfo(concurrencyOpts: Partial<ConcurrencyOptions>):string {
  const concurrencyInfo = [ 'project', 'proxy', 'domain', 'session' ]
    .filter(key => concurrencyOpts[key])
    .map(key => `${key}:${JSON.stringify(concurrencyOpts[key])}`)
    .join(', ');

  return concurrencyInfo ? `concurrency: parallel using {${concurrencyInfo}}` : 'concurrency: sequential';
}

function getPipelineInfo(pipeline:string):string {
  return `pipeline: ${pipeline}`;
}

function getHeadersInfo(accPluginOpts: PluginOpts[]):string {
  const nodeFetchPluginOpts = accPluginOpts ? accPluginOpts.find(opts => opts.name === 'NodeFetchPlugin') : null;

  if (nodeFetchPluginOpts) {
    const { headers } = nodeFetchPluginOpts;
    return headers ? `headers: ${JSON.stringify(headers)}` : null;
  }

  return null;
}

export function getSuiteTitle(
  pipeline:string,
  storage: Storage,
  client:BrowserClient|IDomClientConstructor,
  concurrencyOpts: Partial<ConcurrencyOptions>,
  accPluginOpts?: PluginOpts[],
):string {
  const browserType = client instanceof BrowserClient ? client.opts.browser.charAt(0).toUpperCase() + client.opts.browser.slice(1) : null;
  const clientInfo = browserType ? `${client.constructor.name}_${browserType}` : (<Function>client).name;

  return [
    clientInfo,
    storage.config.client,
    getConcurrencyInfo(concurrencyOpts),
    getPipelineInfo(pipeline),
    getHeadersInfo(accPluginOpts),
  ].filter(fragment => fragment).join(' - ');
}

export default function acceptanceSuite(
  pipeline:string,
  storage: Storage,
  client:BrowserClient|IDomClientConstructor,
  concurrencyOpts: Partial<ConcurrencyOptions>,
  accPluginOpts?: PluginOpts[],
) {
  const suiteTitle = this.getSuiteTitle(pipeline, storage, client, concurrencyOpts, accPluginOpts);

  describe(suiteTitle, () => {
    let srv: GsfServer;
    let Project: IStaticProject;

    before(async () => {
      // start web server
      srv = new GsfServer();
      srv.start();

      // init storage
      if (storage.config.client === 'sqlite3') {
        // can't used :memory db since we connect/disconnect multiple times and can't loose data betweeen scraping and export actions
        // make sure we don't update the path multiple times
        if (!/tmp/.test(storage.config.connection.filename)) {
          storage.config.connection.filename = join(__dirname, '..', 'tmp', storage.config.connection.filename);
        }
      }
    });

    beforeEach(async () => {
      /*
      conn is automatically closed after each scrape operation,
      re-open it to be able to create test projects outside of scraper logic
      */
      ({ Project } = await storage.connect());
      await Project.delAll();
    });

    after(async () => {
      srv.stop();
    });

    const scrapingTest = (
      test:IScrapingTest,
      concurrencyOpts:Partial<ConcurrencyOptions>,
    ) => it(test.title, async () => {
      srv.update(test.vhosts);

      let pluginOpts = mergePluginOpts(pipelines[pipeline].defaultPluginOpts, test.definition.pluginOpts);

      // override test, scenario plugin options based on acceptance plugin options
      if (accPluginOpts) {
        pluginOpts = mergePluginOpts(pluginOpts, accPluginOpts);
      }

      // save a project for the current scrape test
      const project = new Project({
        name: test.title,
        pluginOpts,
      });
      await project.save();
      await project.batchInsertResources(test.definition.resources);

      // start scraping
      const scraper = new Scraper(storage, client);
      const scrapeComplete = new Promise((resolve, reject) => {
        scraper.addListener(ScrapeEvent.ProjectScraped, resolve);
        scraper.addListener(ScrapeEvent.ProjectError, err => {
          reject(err);
        });
      });
      scraper.scrape(project, concurrencyOpts);
      await scrapeComplete;

      // compare results
      const resources = await scraper.getResources();
      // console.log(JSON.stringify(resources));
      ScrapingSuite.checkResources(resources, test.resources);

      // check archive for binary scraping
      if (test.archiveEntries) {
        // generate archive
        const archivePath = `./test/tmp/${test.title}.zip`;
        const zipExporter = new ZipExporter({ filepath: archivePath });
        await zipExporter.export(project);

        // test it
        await ScrapingSuite.checkArchiveEntries(archivePath, test.archiveEntries);

        // delete it
        unlinkSync(archivePath);
      }
    });

    const tests = ScrapingSuite.getTests();

    tests.forEach((test:IScrapingTest) => {
      // the current test definition doesn't apply to the pipeline being tested
      if (!test.definition.pipelines.includes(pipeline)) return;

      scrapingTest(test, concurrencyOpts);
    });
  });
}
