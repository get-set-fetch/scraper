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

const scrapeHash = 'eLsPRJVnnVOxTsMwEP0VKywwxFESJqSCqk5IlWBioRW6JFZs1bErO3HVAb6du1iI0qaiMNrn53fv7r1jD+G6jFaVA7fn1rUZDL20zmdPy/K2KPJ59ugB6re5V50ND1toxSz/l9vOqJluf8oV38stf7fIlRfgaol0mBzPPhjH1pUBmjO7Z8AX0lovnlHPnellWkulm+viJqEmfn4lS15ZuxkNh0AXv5x4CJjHINwSHyOF6tp4prGfKLssdKdJkznfWbdJx24Q8xXLeCaeCUzBRaNIeVrttTKo4gAZF34GOmjUC41wPqU1e9SlFYfQpg5HaVq68Fswr2jujrI/WyWx8gJ6EKtkfcAUCyxQ5S98UxwiKLFb2MH0RxxjgdVUocGv3z8BVSMJ1g==';
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
