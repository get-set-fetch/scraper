/* eslint-disable object-curly-newline */
import { encode, KnexStorage, PuppeteerClient, Scraper, setLogger, ScrapeEvent } from '../src/index';

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

const scrapeHash = 'ePm8oZWZQ085qXl65ZnZwBSTkpmol1+Urg/i6ftkFpfE56fF5yTmpZcmpqcWxydVxueV5ialFoGE84BJpyw1vrggNTE7FRj6RKQ5QgkMJW4RUWSAmQqIS4qY6Q8YTzmpermpJYkpiSWJCtoKBUAMEQT5GcxSKEmxyivJ0E3OyMxJ0TDSVLBTSLRKA5pZAhECWgVL47CgUQK5kBq2GWsimQ4LWgWNXGDiAsavJij2YmsBAzufSg==';

const scrapingConfig = {
  url: 'https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers',
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
};

scraper.on(ScrapeEvent.ProjectScraped, async () => {
  await scraper.export('./examples/data/languages.csv', { type: 'csv' });
  await storage.close();
  console.log(encode(scrapingConfig));
});

scraper.scrape(scrapeHash);
