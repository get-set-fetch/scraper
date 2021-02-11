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

const scrapeHash = 'eLsG8L15jdJNEsIgDAXgu7iWxgs5TmwjZSy0Q0TGhXc3RMc/7NgdG0h47/tWl3NukpBUfeXQ9uinss1AaBNB71iCv0DEcHTBMkwyjyKDHXHgHbdjpA6WkP3n84PGq+FNjWiZ5Jpv586N7sSyFhtpxBujT6+f7u/fW5Whvx94BGJC8nvJ4e2qJlJSnoWAhxPFuXpqmlrq9noDAHydfg==';

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
