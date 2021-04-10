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

const scrapeHash = 'ePm8oZWZjZLNCsIwEIRfpXjSQ1Jb8KAH30RC2qzNYppIfho8+O5uQCgWpd72sOzszHxLcnLOPGvH0cYaRvAD2B4h1AoDyECDdRMYwsQ7Kyf0KbB23xzrgDHJosw83J0naP4Ab42yj4Lnntr1tnm4shEgoh3eDzGDIZ5s1KzXaNT2sKvOlfyxJwQlPG5KgIu7XYqRTHYmAetkfxu8S1aVU1/40g1XD7I0OxZCE9CkVsK/PF+cwooz';

const scrapeConfig = {
  url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/situation-reports',
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
};

scraper.on(ScrapeEvent.ProjectScraped, async () => {
  await scraper.export('./examples/data/resources.zip', { type: 'zip' });
  await storage.close();
  console.log(encode(scrapeConfig));
});

scraper.scrape(scrapeConfig, { domain: { delay: 1000 } });
