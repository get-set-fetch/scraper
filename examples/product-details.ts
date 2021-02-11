/* eslint-disable object-curly-newline */
import { KnexStorage, PuppeteerClient, Scraper, setLogger } from '../src/index';

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

const scrapeHash = 'eLsG8L15lVTLbsMgEPwV5F7ag7GMe6qUVlFOlSK1p16aqFrbyKBgiMAmyqH99i6mVfOwlfQIyzDM7gynrsMpaiVLC3ZPjW0y6DthrMtelsU9Y/k8e3YA1cfcydb4py00fJZf489JM06o+pHBjmWMmeZv9sVlB904DrYSSIeZc+SLUJQgNYR+k0cCdCGMcfwVdT3oTqSVkKq+ZXdJeMTxVaKgpTGbwY8ItPHKkYOASfbcLvEwUsi2ievQ/jNl12XyPIgipztjN+nwGsT8pjauA88IhlFey6A8LfdKalRxgIyDn4D2CvVCza0bxuxQl5IUfJNabKVuwobbgn5Hk7fha5itklh5A9XzVbI+YIoF4kPlP3xjHNxLvluYXncnHEOBVKESGr/+/Aakgg0I';
const scrapingConfig = {
  url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1',
  scenario: 'browser-static-content',
  pluginOpts: [
    {
      name: 'SelectResourcePlugin',
      delay: 1000,
    },
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

(async () => {
  await scraper.scrape(scrapingConfig);
  await scraper.export('./examples/data/books.csv', { type: 'csv' });
  await scraper.export('./examples/data/book-covers.zip', { type: 'zip' });
  await storage.close();
})();
