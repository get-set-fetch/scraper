/* eslint-disable object-curly-newline */
import { encode, KnexStorage, PuppeteerClient, Scraper, setLogger } from '../src/index';

setLogger({ level: 'info' });

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

const scrapeHash = 'eLt7R4n7pZNBCsIwEEWvkmWLmoruuvAE3iFMzTQNTdLQpBVv79QSrEpBKCEw+Yv5zPyXb2rQ8btutUepgXe9KqZXcdUhiq4WBpwaQGEQ1UO4wVbYT7IjokYUwSO0SBFt4O0j+Hd+x19E/iNzgSOFapBbjCAhAtsxT3cWpyFfFYuydLE53BptZHbK2YVBWVOzOEvkkVhPu1ilfL/R/Zwv3NJuWWaJTIIjX/9ddJ43QKbJ';

const scrapeDefinition = {
  url: 'https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers',
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
};

(async () => {
  await scraper.scrape(scrapeHash);
  await scraper.export('./examples/data/languages.csv', { type: 'csv' });
  await storage.close();

  encode(scrapeDefinition);
})();
