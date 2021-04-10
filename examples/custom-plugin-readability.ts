/* eslint-disable object-curly-newline */
import { join } from 'path';
import { KnexStorage, PluginStore, PuppeteerClient, ScrapeConfig, Scraper, setLogger, ScrapeEvent, encode } from '../src/index';

setLogger({ level: 'info' });

const knexConfig = {
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: './examples/data/readability.sqlite',
  },
};

const storage = new KnexStorage(knexConfig);
const client = new PuppeteerClient({ args: [
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--no-first-run',
  '--no-sandbox',
  '--no-zygote',
  '--single-process',
] });
const scraper = new Scraper(storage, client);

const scrapeHash = 'ePm8oZWZQ0855eXleklJyeAElJdaXqxfkpqckZefk59eSUxSIpRuUKIMEfKGRMRfdEZRappCnK2COrrDdNVjQX5B+BaUaKCxALesKLUgJzGZQBLGleCIizZToCMAtHl3/w==';
const scrapeConfig:ScrapeConfig = {
  url: 'https://www.bbc.com/news/technology',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 1,
      selectorPairs: [
        { urlSelector: "a[href ^= '/news/technology-']" },
      ],
    },
    {
      name: 'ReadabilityPlugin',
      replace: 'ExtractHtmlContentPlugin',
      domRead: true,
    },
    {
      name: 'InsertResourcesPlugin',
      maxResources: 5,
    },
  ],
};

(async () => {
  await PluginStore.init();
  await PluginStore.addEntry(join(__dirname, 'plugins', 'ReadabilityPlugin.ts'));

  scraper.on(ScrapeEvent.ProjectScraped, async () => {
    await scraper.export('./examples/data/readability.csv', { type: 'csv' });
    await storage.close();
    console.log(encode(scrapeConfig));
  });

  scraper.scrape(scrapeConfig, { domain: { delay: 1000 } });
})();
