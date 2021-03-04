import { unlinkSync } from 'fs';
import { GsfServer, ScrapingSuite, IScrapingTest } from '@get-set-fetch/test-utils';
import BrowserClient from '../../src/browserclient/BrowserClient';
import { scenarios, mergePluginOpts } from '../../src/scenarios/scenarios';

import Scraper from '../../src/scraper/Scraper';
import { IStaticProject } from '../../src/storage/base/Project';
import Storage from '../../src/storage/base/Storage';
import { IDomClientConstructor } from '../../src/domclient/DomClient';
import { ConcurrencyOptions } from '../../src/scraper/ConcurrencyManager';
import ScrapeEvent from '../../src/scraper/ScrapeEvents';

export default function acceptanceSuite(
  scenario:string,
  storage: Storage,
  client:BrowserClient|IDomClientConstructor,
  concurrencyOpts: Partial<ConcurrencyOptions>[],
) {
  const browserType = client instanceof BrowserClient ? client.opts.browser.charAt(0).toUpperCase() + client.opts.browser.slice(1) : null;
  const clientInfo = browserType ? `${client.constructor.name} - ${browserType}` : (<Function>client).name;

  describe(`acceptance suite using ${storage.config.client} - ${clientInfo}, scenario: ${scenario}`, () => {
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
    ) => {
      let concurrencyLabel = [ 'project', 'proxy', 'domain', 'session' ]
        .filter(key => concurrencyOpts[key])
        .map(key => `${key}:${JSON.stringify(concurrencyOpts[key])}`)
        .join(', ');
      concurrencyLabel = concurrencyLabel ? `Concurrency: ${concurrencyLabel}` : 'Concurrency: Default (sequential)';
      if (!concurrencyLabel) {
        concurrencyLabel = 'Sequential';
      }

      return it(`${storage.config.client} - ${clientInfo} - ${test.title} - ${concurrencyLabel}`, async () => {
        srv.update(test.vhosts);

        const pluginOpts = mergePluginOpts(scenarios[scenario].defaultPluginOpts, test.definition.pluginOpts);

        // save a project for the current scraping test
        const project = new Project({
          name: test.title,
          url: test.definition.url,
          pluginOpts,
        });
        await project.save();

        // start scraping
        const concurrencyOpts:Partial<ConcurrencyOptions> = {
          proxyPool: [ {
            host: '127.0.0.1',
            port: 8080,
          } ],
        };
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
    };

    const tests = ScrapingSuite.getTests();

    concurrencyOpts.forEach(concurrencyOpt => {
      tests.forEach((test:IScrapingTest) => {
        // the current test definition doesn't apply to the scenario being tested
        if (!test.definition.scenarios.includes(scenario)) return;

        scrapingTest(test, concurrencyOpt);
      });
    });
  });
}
