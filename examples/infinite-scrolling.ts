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

const scrapeOptsHash = 'eLt7R4n7pZLRDoIwDEX/xWdH/SFjKtSxwAZZnYsP/rtdNYgQEhPf9tL13p6ztCbnXCVRSu0pj7pFP5Y0PaFNBK1jufAdIobOBcswyj6KDHbAnk9cD5Ea+Ee5L/YfhIe1Jb/JOTOycbdKw7DkYSMIvDH6535y+NVnV7YtJt/VTUj+LI1nM9q93HMTOV6uFLdArCVUfMfHE+w/lJc=';

const scrapeOpts = {
  url: 'https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 0,
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          selector: 'div.statistics-item--name',
          label: 'player',
        },
        {
          selector: 'div.history-numbers',
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
  await scraper.scrape(scrapeOpts);
  await scraper.export('./examples/data/infinite-scrolling.csv', { type: 'csv' });
  await storage.close();
})();
