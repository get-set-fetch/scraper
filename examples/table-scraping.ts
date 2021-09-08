/* eslint-disable object-curly-newline */
import { destination } from 'pino';
import { encode, KnexStorage, PuppeteerClient, Scraper, setLogger, ScrapeEvent } from '../src/index';

setLogger({ level: 'info' }, destination('./scraping.log'));

const knexConfig = {
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: './examples/data/languages.sqlite',
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

const projectHash = 'ePnXQdMJrZNNDoMgEIWvQrqSNNWm3bnoCXoHMpYRiYBGsE1v30FDf+JCF12QwFu8N5n38TYz4NQICq/ahy2EruH4Q8Kn0OOSmW3gLmml7gzmFgNICMD2rKcziw/d6unGgixdaA63RhuZnTi7MChr8gyzRFHpR6QF7OKE/0g78y933yO0hA7LLAFHXfK4/pWu0E3ePUoNeTeoIr6K2JDoapEG9qJ6CjfaCocoO2rpjiIFxpgXe3Oswg==';

const projectOpts = {
  name: 'languageList',
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
          contentSelector: 'table.metadata + p + table.wikitable td:nth-child(2) > a:first-child',
          label: 'language',
        },
        {
          contentSelector: 'table.metadata + p + table.wikitable td:nth-child(3)',
          label: 'speakers (milions)',
        },
      ],
    },
  ],
  resources: [
    {
      url: 'https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers',
    },
  ],
};

scraper.on(ScrapeEvent.ProjectScraped, async () => {
  await scraper.export('./examples/data/languages.csv', { type: 'csv' });
  await storage.close();
});

scraper.scrape(projectOpts);
