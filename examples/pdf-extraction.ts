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

const scrapeHash = 'eLsPRJVnnZPNCsIwEIRfpXjSQ1Jb8KAH30RC2qzNYppIfho8+O5uQCiUFsHbHpbJzM6XJUM5Z56142hjDSP4gZQRQq0wgAw0WDeBIZa8s3JCnwJrj825DhiTLK6Zh6fzRNY/CG5EXM+0hsrcePubGx7ubASIaIeva2YwxIuNmvUajdqfDtW1kht7QlCF4644Wuh2KUa6RGcSsE72j8G7ZFWRWiFVN1y9KNJ8HiE0fQ16rTR0e38AKoKWGA==';

const scrapingConfig = {
  url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/situation-reports',
  scenario: 'browser-static-content',
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
          urlSelector: '.sf-meeting-report-list:nth-child(5) > a.sf-meeting-report-list__item',
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
  await scraper.scrape(scrapingConfig);
  await scraper.export('./examples/data/resources.zip', { type: 'zip' });
  await storage.close();
})();
