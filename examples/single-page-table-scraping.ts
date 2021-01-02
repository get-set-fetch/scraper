import { KnexStorage, PuppeteerClient, Scraper } from '../src/index';

const storage = new KnexStorage();
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

(async () => {
  await scraper.scrape(
    'https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers',
    'static-content',
    [
      {
        name: 'ExtractUrlsPlugin',
        maxDepth: 0,
      },
      {
        name: 'ExtractHtmlContentPlugin',
        selectorPairs: [
          {
            selector: 'table.metadata + p + table.wikitable td:nth-child(2) > a:first-child',
            label: 'language',
          },
          {
            selector: 'table.metadata + p + table.wikitable td:nth-child(3)',
            label: 'speakers (milions)',
          },
        ],
      },
    ],
  );

  await scraper.export('./examples/data/table.csv', { type: 'csv' });

  await storage.close();
  await client.close();
})();
