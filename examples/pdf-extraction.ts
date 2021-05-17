/* eslint-disable object-curly-newline */
import { KnexStorage, PuppeteerClient, Scraper, setLogger, ScrapeEvent, encode } from '../src/index';

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

const scrapeHash = 'ePnXQdMJjZLBDsIgEER/pfGkB6ht4kEP/oVnQmEtG1toYCnx74XE2Gg09baH3dnMzHuJKTejvkxaUj77g9A1HN9IWApt17Hg4cpGAELbMw+T88QGDHSyZJgyOOjtYVedK/ljT4gc5LgpOX3odpHIWdYNEVgn1a33LlpdpL6AaBqu79nS4liIUn/+VoJbSTmlxJNxHC3VMILvwSqEUGsMIEMerJthyMreWTmjj4G1++ZYB6QoS9dPR6H8egBynpe2';

const scrapeConfig = {
  name: 'covidUpdates',
  pipeline: 'browser-static-content',
  pluginOpts: [
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
  resources: [
    {
      url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/situation-reports',
    },
  ],
};

scraper.on(ScrapeEvent.ProjectScraped, async () => {
  await scraper.export('./examples/data/resources.zip', { type: 'zip' });
  await storage.close();
});

scraper.scrape(scrapeConfig, { domain: { delay: 1000 } });
