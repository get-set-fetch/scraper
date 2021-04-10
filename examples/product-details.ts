/* eslint-disable object-curly-newline */
import { KnexStorage, PuppeteerClient, Scraper, setLogger, ScrapeEvent, encode } from '../src/index';

setLogger({ level: 'info' });

const knexConfig = {
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: './examples/data/books.sqlite',
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

const scrapeHash = 'ePm8oZWZnVNBTsMwEPyKFS4gEUdJOCEVVPWEVAlOXGiFNollW3Xsyk5S9QBvZzcWoi1BBY72ejy7Mzunm4NOWKMrD37PnZcZ9J1yPmSPy/KmKPJ59hAA6td50K0b7rcgxSz/zY6dW6gjL78sKc8bexEE+FrhbBiFwN4Zx660BZKB3THgC+VcEE/Y6q3tVForbZrL4ioheY6/UiWvnNuMa4JAH7+ceAgYsEH4JT5GCt3KeCZFr/8Xle/5UDnfOb9Jx24Q8xmmeCaeCUzBRaNp8rTakx8MDpDRyx+gvcF5oRE+jM4FnMtoDoNMPUppJV2ELdgX3L2WEjtbJbHyDKYXq2R9wBQLbKDKX/imOMSgxW7hetudcIwFVlOFhF+/fQCpef3i';
const scrapeConfig = {
  url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 3,
      selectorPairs: [
        {
          urlSelector: '#searchResults ~ .pagination > a.ChoosePage:nth-child(2)',
        },
        {
          urlSelector: 'h3.booktitle a.results',
        },
        {
          urlSelector: 'a.coverLook > img.cover',
        },
      ],
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'h1.work-title',
          label: 'title',
        },
        {
          contentSelector: 'h2.edition-byline a',
          label: 'author',
        },
        {
          contentSelector: 'ul.readers-stats > li.avg-ratings > span[itemProp="ratingValue"]',
          label: 'rating value',
        },
        {
          contentSelector: 'ul.readers-stats > li > span[itemProp="reviewCount"]',
          label: 'review count',
        },
      ],
    },
  ],
};

scraper.on(ScrapeEvent.ProjectScraped, async () => {
  await scraper.export('./examples/data/books.csv', { type: 'csv' });
  await scraper.export('./examples/data/book-covers.zip', { type: 'zip' });
  await storage.close();
  console.log(encode(scrapeConfig));
});

scraper.scrape(scrapeConfig, { domain: { delay: 1000 } });
