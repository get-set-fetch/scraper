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

const scrapeHash = 'eLsG8L15jZPPCsIwDMZfZXjSQzs38KAH30RKt8Y12LXSPysefHdTEAZjQ285hC/fl/yypC7nzLN2HG2sYQQ/kDJCqBUGkIEK6yYwhJh3Vk7oU2DtsTnXAWOSxTXz8HSegPsD2k1CN6KuZ1sjaQai/Y0VD3c2AkS0w9c9MxjixUbNeo1G7U+H6lrJjT4h6JTjrjha6HYpRtpIZxKwTvaPwbtkVZFaAVk3XL0o0rweITR9Dk0rl7q9P1bImUk=';

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
