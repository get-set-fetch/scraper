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

const scrapeHash = 'ePnXQdMJnVTLTsMwEPwVK1yKRBwl4YRUUNsTUiU4caEIbVIrtprYlZ246oVvZ9cW0EKkAEd7H+OZnfVnM3CqM35pzM79xqBTbjwzwtc8y2lXXDgBtpZIC9fGsTfG94BtgBRgtwz4ShrjxCM04kb3Mq2larez4jIhZc5byZJXSCh4DAttbDmSCKiKF3aNyQihuiaeSaGr/+3Zz+WSOT8Yu0vDa7DmYxPjmXBGagoutoqYp9WR5sHgpBKGXmLaeOnQIt/g1jA5h7xaxcE3qUUpdUMXbg/6GW3X0brPN0mMPEE7iE3ycoIUA8xT5C94YxjCK3FYmUH33zBCgNUUIeEnfIz/k25VZcEeubFNFsVw2cO6vC6KfJHdO4D6dRFsfYcWEvOc2r4D6BILFg==';
const scrapeConfig = {
  name: 'asimovBooks',
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
  resources: [
    {
      url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1',
    },
  ],
};

scraper.on(ScrapeEvent.ProjectScraped, async () => {
  await scraper.export('./examples/data/books.csv', { type: 'csv' });
  await scraper.export('./examples/data/book-covers.zip', { type: 'zip' });
  await storage.close();
});

scraper.scrape(scrapeConfig, { domain: { delay: 1000 } });
