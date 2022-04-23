/* eslint-disable no-param-reassign */
import { unlinkSync } from 'fs';
import { join } from 'path';
import { GsfServer, ScrapingSuite, IScrapingTest } from '@get-set-fetch/test-utils';
import BrowserClient from '../../src/browserclient/BrowserClient';
import { pipelines, mergePluginOpts } from '../../src/pipelines/pipelines';
import Scraper, { ScrapeEvent } from '../../src/scraper/Scraper';
import Connection from '../../src/storage/base/Connection';
import { IDomClientConstructor } from '../../src/domclient/DomClient';
import { ConcurrencyOptions } from '../../src/scraper/ConcurrencyManager';
import { ConnectionManager, PluginOpts, ZipExporter } from '../../src';
import Project from '../../src/storage/base/Project';
import Resource from '../../src/storage/base/Resource';
import { setLogger } from '../../src/logger/Logger';

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
  conn: Connection,
  client:BrowserClient|IDomClientConstructor,
  concurrencyOpts: Partial<ConcurrencyOptions>,
  accPluginOpts?: PluginOpts[],
):string {
  const browserType = client instanceof BrowserClient ? client.opts.browser.charAt(0).toUpperCase() + client.opts.browser.slice(1) : null;
  const clientInfo = browserType ? `${client.constructor.name}_${browserType}` : (<Function>client).name;

  return [
    clientInfo,
    conn.config.client,
    getConcurrencyInfo(concurrencyOpts),
    getPipelineInfo(pipeline),
    getHeadersInfo(accPluginOpts),
  ].filter(fragment => fragment).join(' - ');
}

export default function acceptanceSuite(
  pipeline:string,
  conn: Connection,
  client:BrowserClient|IDomClientConstructor,
  concurrencyOpts: Partial<ConcurrencyOptions>,
  accPluginOpts?: PluginOpts[],
) {
  const suiteTitle = getSuiteTitle(pipeline, conn, client, concurrencyOpts, accPluginOpts);

  describe(suiteTitle, () => {
    let srv: GsfServer;
    let ExtProject: typeof Project;
    let ExtResource: typeof Resource;
    let connMng: ConnectionManager;

    before(async () => {
      // start web server
      srv = new GsfServer();
      srv.start();

      // init storage
      if (conn.config.client === 'sqlite3') {
        // can't used :memory db since we connect/disconnect multiple times and can't loose data betweeen scraping and export actions
        // make sure we don't update the path multiple times
        if (!/tmp/.test(conn.config.connection.filename)) {
          conn.config.connection.filename = join(__dirname, '..', 'tmp', conn.config.connection.filename);
        }
      }

      /*
      keep a separate db connection for project handling outside the scraper instance
      scraper opens and closes its own db connection
      */
      connMng = new ConnectionManager(conn);
      await connMng.connect();
      ExtProject = await connMng.getProject();
    });

    beforeEach(async () => {
      await ExtProject.delAll();
    });

    after(async () => {
      srv.stop();
      await connMng.close();
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
      const project = new ExtProject({
        name: test.title,
        pluginOpts,
      });
      await project.save();
      await project.queue.normalizeAndAdd(test.definition.resources);

      // start scraping
      setLogger({ level: 'error' });
      const scraper = new Scraper(ConnectionManager.clone(project), client);
      const scrapeComplete = new Promise((resolve, reject) => {
        scraper.addListener(ScrapeEvent.ProjectScraped, resolve);
        scraper.addListener(ScrapeEvent.ProjectError, (proj, err) => {
          reject(err);
        });
      });
      scraper.scrape(project, concurrencyOpts);
      await scrapeComplete;

      /*
      SIGTERM, SIGINT listners are added in scraper constructor and never removed
      this is fine in production but in tests they keep accumlating
      remove them after each test so nodejs won't emit
      MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGTERM listeners added to [process].
      */
      process.off('SIGTERM', scraper.gracefullStopHandler);
      process.off('SIGINT', scraper.gracefullStopHandler);

      /*
      compare results
      - expected results contain all scraped urls regardless of status
      - actual results is a combination of project queue entries and resources
          * project queue contains scraped urls without content with valid and invalid (301, 404, ..) status
          * project resources should (not atm) contain only scraped resources with a valid 2xx status
            - this is not the case atm, UpsertResourcePlugin saves all resources regardless of their status
      */
      const resources = await project.getResources();
      const resourceUrls = resources.map(resource => resource.url);
      const queueEntries = await project.queue.getAll();
      const actualResources = resources.concat(
        queueEntries
          .filter(queueEntry => !resourceUrls.includes(queueEntry.url))
          .map(queueEntry => new project.Constructor.ExtResource({ ...queueEntry, contentType: null, content: null })),
      );
      // console.log(JSON.stringify(actualResources));
      ScrapingSuite.checkResources(actualResources, test.resources);

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
