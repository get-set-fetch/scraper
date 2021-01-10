import { unlinkSync } from 'fs';
import { GsfServer, ScrapingSuite } from 'get-set-fetch-test-utils';
import { IScrapingTest } from 'get-set-fetch-test-utils/dist/scraping-suite/ScrapingSuite';
import BrowserClient from '../../src/browserclient/BrowserClient';
import PuppeteerClient from '../../src/browserclient/PuppeteerClient';
import { scenarios, mergePluginOpts } from '../../src/scenarios/scenarios';

import Scraper from '../../src/scraper/Scraper';
import { IStaticProject } from '../../src/storage/base/Project';
import Storage from '../../src/storage/base/Storage';

export default function integrationSuite(storage: Storage) {
  describe(`integration suite using ${storage.config.client}`, () => {
    let srv: GsfServer;
    let browserClient:BrowserClient;
    let Project: IStaticProject;

    before(async () => {
      // start web server
      srv = new GsfServer();
      srv.start();

      // launch browser with above web server as proxy
      browserClient = new PuppeteerClient({
        headless: true,
        ignoreHTTPSErrors: true,
        slowMo: 20,
        args: [
          `--host-rules=MAP *:80 127.0.0.1:${srv.httpPort}, MAP *:443 127.0.0.1:${srv.httpPort}`,
          '--ignore-certificate-errors',

          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-first-run',
          '--no-sandbox',
          '--no-zygote',
          '--single-process',
        ],
      });

      // init storage
      ({ Project } = await storage.connect());
    });

    afterEach(async () => {
      await Project.delAll();
    });

    after(async () => {
      await storage.close();
      srv.stop();
    });

    const tests = ScrapingSuite.getTests();

    tests.forEach((test:IScrapingTest) => {
      it(`${storage.config.client} - ${test.title}`, async () => {
        srv.update(test.vhosts);

        // save a project for the current scraping test
        const project = new Project({
          name: test.title,
          url: test.definition.url,
          pluginOpts: mergePluginOpts(scenarios[test.definition.scenario].defaultPluginOpts, test.definition.pluginOpts),
        });
        await project.save();

        // start scraping
        const scraper = new Scraper(storage, browserClient);
        await scraper.scrape(project);

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
    });
  });
}
