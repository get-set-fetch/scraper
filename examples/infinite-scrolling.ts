/* eslint-disable object-curly-newline */
import { KnexStorage, PuppeteerClient, Scraper, setLogger } from '../src/index';

setLogger({ level: 'info' });

const knexConfig = {
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: './examples/data/infinite-scrolling.sqlite',
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

const scrapeHash = 'eLsPRJVnpZJLDsIwDAXvwprUXAgh05o0okmrmBCx4O51DOIXKiGxyyb285v5dCjn3CQRTF0qj7ZHP5U0A6FNBL1jafgCEcPRBcswyT6KDHbEgXfcjpE6+EfAN/ZPhJvakt9Urf3s3LnRTCyx2AgJb4yOXj/Evp21Kku/D7gXYULye7n/5as2UdpdFAAPJ4pLWGolFeb2OgOx3JpN';

const scrapingConfig = {
  url: 'https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/',
  scenario: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 0,
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'div.statistics-item--name',
          label: 'player',
        },
        {
          contentSelector: 'div.history-numbers',
          label: 'goals',
        },
      ],
    },
    {
      name: 'ScrollPlugin',
      after: 'UpsertResourcePlugin',
      stabilityCheck: 1000,
    },
  ],
};

(async () => {
  await scraper.scrape(scrapingConfig);
  await scraper.export('./examples/data/infinite-scrolling.csv', { type: 'csv' });
  await storage.close();
})();
