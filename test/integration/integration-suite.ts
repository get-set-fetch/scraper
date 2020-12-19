import { GsfServer, ScrapingSuite } from 'get-set-fetch-test-utils';
import { IScrapingTest } from 'get-set-fetch-test-utils/lib/scraping-suite/ScrapingSuite';
import BrowserClient from '../../src/browserclient/BrowserClient';
import PuppeteerClient from '../../src/browserclient/PuppeteerClient';
import PluginStore from '../../src/pluginstore/PluginStore';
import { scenarios, mergePluginOpts } from '../../src/scenarios/scenarios';

import Scraper from '../../src/scraper/Scraper';
import { IStaticSite } from '../../src/storage/base/Site';
import Storage from '../../src/storage/base/Storage';

export default function integrationSuite(storage: Storage) {
  describe(`integration suite using ${storage.config.client}`, () => {
    let srv: GsfServer;
    let browserClient:BrowserClient;
    let Site: IStaticSite;

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
      await browserClient.launch();

      // init storage
      await storage.connect();
      ({ Site } = storage);

      // init plugin store
      await PluginStore.init();
    });

    afterEach(async () => {
      await Site.delAll();
    });

    after(async () => {
      await storage.close();
      srv.stop();
      await browserClient.close();
    });

    const tests = ScrapingSuite.getTests();

    tests.forEach((test:IScrapingTest) => {
      it(`${storage.config.client} - ${test.title}`, async () => {
        srv.update(test.vhosts);

        // save a site for the current scraping test
        const site = new Site({
          name: test.title,
          url: test.definition.url,
          pluginOpts: mergePluginOpts(scenarios[test.definition.scenario].defaultPluginOpts, test.definition.pluginOpts),
        });
        await site.save();

        // start scraping
        const scraper = new Scraper(browserClient);
        await scraper.scrape(site);

        // compare results
        const resources = await site.getResources();
        // console.log(JSON.stringify(resources));

        ScrapingSuite.checkResources(resources, test.resources);
      });
    });
  });
}
