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

const scrapeOptsHash = 'eLt7R4n7pVRdS8MwFP0rob4omJS2PglTxp4Gg+3JFydy24YmLE1G0nbsxd/uTeOwnR0OpU/pvTnnfpyTc9XgurSSuQV7ZMZWMbSNMNbF61X2kKbJPF46gOJ97mRtuuc9VHyW/ElfF7r5Kj8dlz+liu/lZr9L5MZxsIVAOvSKIx+EYelSg58zeSLAFsIYxzfYz6NuBC2EVOVtehf5IsZQImO5MbtecHjRBsiJREAHdtyuMBkpZF2Fsx/7j86us9nAWyJhB2N3tC8Dk08OPJ2njXc/xkgZL6UfAc2PSmpsZ4AUNn8lVKtwEFBy66jfv8OGlWTQVdTijHXlf7g96FdUfb1BwNk2CpEXUC3fRm8D5hAgnY/8h3+Kk3eSHxam1c0ZZx8ghY9cfrfw+wQSXx87';
const scrapeOpts = {
  url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'SelectResourcePlugin',
      delay: 2000,
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
          contentSelector 'h1.work-title',
          label: 'title',
        },
        {
          contentSelector 'h2.edition-byline a',
          label: 'author',
        },
        {
          contentSelector 'ul.readers-stats > li.avg-ratings > span[itemProp="ratingValue"]',
          label: 'rating value',
        },
        {
          contentSelector 'ul.readers-stats > li > span[itemProp="reviewCount"]',
          label: 'review count',
        },
      ],
    },
  ],
};

(async () => {
  await scraper.scrape(scrapeOpts);
  await scraper.export('./examples/data/books.csv', { type: 'csv' });
  await scraper.export('./examples/data/book-covers.zip', { type: 'zip' });
  await storage.close();
})();
