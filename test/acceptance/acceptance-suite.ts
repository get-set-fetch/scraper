import { unlinkSync } from 'fs';
import { GsfServer, ScrapingSuite, IScrapingTest } from '@get-set-fetch/test-utils';
import BrowserClient from '../../src/browserclient/BrowserClient';
import { scenarios, mergePluginOpts } from '../../src/scenarios/scenarios';

import Scraper from '../../src/scraper/Scraper';
import { IStaticProject } from '../../src/storage/base/Project';
import Storage from '../../src/storage/base/Storage';
import { IDomClientConstructor } from '../../src/domclient/DomClient';

export default function acceptanceSuite(scenario:string, storage: Storage, client:BrowserClient|IDomClientConstructor) {
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

    const tests = ScrapingSuite.getTests();

    tests.forEach((test:IScrapingTest) => {
      // the current test definition doesn't apply to the scenario being tested
      if (!test.definition.scenarios.includes(scenario)) return;

      it(`${storage.config.client} - ${clientInfo} - ${test.title}`, async () => {
        srv.update(test.vhosts);

        const pluginOpts = mergePluginOpts(scenarios[scenario].defaultPluginOpts, test.definition.pluginOpts);

        // make all NodeFetchPlugin requests against the local web srv serving acceptance-suite web pages
        const nodeFetchPlugin = pluginOpts.find(pluginOpts => pluginOpts.name === 'NodeFetchPlugin');
        if (nodeFetchPlugin) {
          nodeFetchPlugin.proxyPool = [ {
            host: '127.0.0.1',
            port: 8080,
          } ];
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
