import { unlinkSync } from 'fs';
import { GsfServer, ScrapingSuite, IScrapingTest } from '@get-set-fetch/test-utils';
import BrowserClient from '../../src/browserclient/BrowserClient';
import { scenarios, mergePluginOpts } from '../../src/scenarios/scenarios';

import Scraper from '../../src/scraper/Scraper';
import { IStaticProject } from '../../src/storage/base/Project';
import Storage from '../../src/storage/base/Storage';

export default function acceptanceSuite(storage: Storage, browserClient:BrowserClient) {
  describe(`acceptance suite using ${storage.config.client} - ${browserClient.constructor.name} - ${browserClient.opts.browser}`, () => {
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
      await browserClient.close();
      await storage.close();
      srv.stop();
    });

    const tests = ScrapingSuite.getTests();

    tests.forEach((test:IScrapingTest) => {
      it(`${storage.config.client} - ${browserClient.constructor.name} - ${browserClient.opts.browser} - ${test.title}`, async () => {
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
