/* eslint-disable object-curly-newline */
import { KnexStorage, PuppeteerClient, Scraper, setLogger, ScrapeEvent, encode } from '../src/index';

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

const scrapeHash = 'ePm8oZWZjZJBEsIgDEXv4loab+TENlLGQjtEZLy9CTq2ih27Y5Of8P77Nifn3CTRqhikj7ZHP2niQGgTQe9Y4N0hYri4YBkm2U+RwY448JHbMVIHW7T759hHvXNLh1qEbTbWCnbu1pSbWM5iI1S9MSV6/3b3+b2dLv0d8AJiQvIn4bAYLUSU8mqZeL5SXKun1ktLlrgHA1idgA==';

const scrapingConfig = {
  url: 'https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/',
  pipeline: 'browser-static-content',
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

scraper.on(ScrapeEvent.ProjectScraped, async () => {
  await scraper.export('./examples/data/infinite-scrolling.csv', { type: 'csv' });
  await storage.close();
  console.log(encode(scrapingConfig));
});

scraper.scrape(scrapingConfig, { domain: { delay: 1000 } });
