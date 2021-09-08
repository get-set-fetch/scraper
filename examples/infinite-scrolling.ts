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

const projectHash = 'ePnXQdMJjZJRDoIwDIbv4rOjHsV4ATJhDiLbSOtcvL3tJBAyCbz1pe3fft88LLKnV95q8Kb9s/eWjni6J+XKhwXrpTTnmL6ls23/rnIm4lik+IlOqTz6PMs+5rtOsvT/gI67A36Uj+4ufJdWG/RA8qlNdvrxMrhFo7ROmO4xSilVwiOzkqLptBvFgMFoGw1MeQEnVPC7kCDHrakJaFqQ2F/CU61j';

const projectOpts = {
  name: 'uefaPlayerRankings',
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
  resources: [
    {
      url: 'https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/',
    },
  ],
};

scraper.on(ScrapeEvent.ProjectScraped, async () => {
  await scraper.export('./examples/data/infinite-scrolling.csv', { type: 'csv' });
  await storage.close();
});

scraper.scrape(projectOpts, { domain: { delay: 1000 } });
