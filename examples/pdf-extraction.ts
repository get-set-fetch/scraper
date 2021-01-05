/* eslint-disable object-curly-newline */
import { KnexStorage, PuppeteerClient, Scraper, setLogger } from '../src/index';

setLogger({ level: 'info' });

const knexConfig = {
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: './examples/data/resources.sqlite',
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

const scrapeOptsHash = 'eLt7R4n7nZPNCsIwEIRfpXjSQ1JbT3rwTSSkzdosponkp8GD7+4GhEJpEbztYZnM7HxZUpNz5lk7jjbWMIIfSBkh1AoDyECDdRMYosc7Kyf0KbD22JzrgDHJ4pp5eDpPLP0D3UbE9UxrqMyNt7+54eHORoCIdvi6ZgZDvNioWa/RqP3pUF0rubEnBFU47oqjhW6XYqRLdCYB62T/GLxLVhWpFVJ1w9WLIs3nEULT16DXSkO39wcpeJYW';
const scrapeOpts = {
  url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/situation-reports',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'SelectResourcePlugin',
      delay: 1000,
    },
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 2,
      selectorPairs: [
        {
          urlSelector: '.sf-meeting-report-list:nth-child(3) > a.sf-meeting-report-list__item',
        },
        {
          urlSelector: '.button-blue-background > a',
          titleSelector: 'h1.dynamic-content__heading',
        },
      ],
    },
  ],
};

(async () => {
  await scraper.scrape(scrapeOpts);
  await scraper.export('./examples/data/resources.zip', { type: 'zip' });
  await storage.close();
})();
