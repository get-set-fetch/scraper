import { unlinkSync } from 'fs';
import { GsfServer, ScrapingSuite, IScrapingTest } from '@get-set-fetch/test-utils';
import BrowserClient from '../../src/browserclient/BrowserClient';
import { pipelines, mergePluginOpts } from '../../src/pipelines/pipelines';

import Scraper, { ScrapeEvent } from '../../src/scraper/Scraper';
import { IStaticProject } from '../../src/storage/base/Project';
import Storage from '../../src/storage/base/Storage';
import { IDomClientConstructor } from '../../src/domclient/DomClient';
import { ConcurrencyOptions } from '../../src/scraper/ConcurrencyManager';
import { PluginOpts } from '../../src';

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

export default function acceptanceSuite(
  pipeline:string,
  storage: Storage,
  client:BrowserClient|IDomClientConstructor,
  concurrencyOpts: Partial<ConcurrencyOptions>,
  accPluginOpts?: PluginOpts[],
) {
  const browserType = client instanceof BrowserClient ? client.opts.browser.charAt(0).toUpperCase() + client.opts.browser.slice(1) : null;
  const clientInfo = browserType ? `${client.constructor.name}_${browserType}` : (<Function>client).name;

  const suiteTile = [
    clientInfo,
    storage.config.client,
    getConcurrencyInfo(concurrencyOpts),
    getPipelineInfo(pipeline),
    getHeadersInfo(accPluginOpts),
  ].filter(fragment => fragment).join(' - ');

  describe(suiteTile, () => {
    let srv: GsfServer;
    let Project: IStaticProject;

    before(async () => {
      // start web server
      srv = new GsfServer();
      srv.start();

      // init storage
      ({ Project } = await storage.connect());
    });

    afterEach(async () => {
      await Project.delAll();
    });

    after(async () => {
      if (client instanceof BrowserClient) {
        await client.close();
      }

      await storage.close();
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

      // save a project for the current scraping test
      const project = new Project({
        name: test.title,
        url: test.definition.url,
        pluginOpts,
      });
      await project.save();

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
      const resources = await project.getResources();
      // console.log(JSON.stringify(resources));
      ScrapingSuite.checkResources(resources, test.resources);

      // check archive for binary scraping
      if (test.archiveEntries) {
        // generate archive
        const archivePath = `./test/tmp/${test.title}.zip`;
        await scraper.export(archivePath, { type: 'zip' });

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
