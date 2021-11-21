/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import { destination } from 'pino';
import { Scraper, Project, setLogger, ScrapeEvent, CsvExporter, BrowserClient } from '../../src/index';

/* scrape configuration */
import ScrapeConfig from './console-content-config.json';
import ConsolePuppeteerClient from './ConsolePuppeteerClient';

// write all INFO and above messages to 'scrape.log'
setLogger({ level: 'info' }, destination('scrape.log'));

/* create a scraper instance with the above settings */
const browserClient: BrowserClient = new ConsolePuppeteerClient();
const scraper = new Scraper(ScrapeConfig.storage, browserClient);

scraper.on(ScrapeEvent.ProjectScraped, async (project: Project) => {
  const exporter = new CsvExporter({ filepath: 'console.csv' });
  await exporter.export(project);
});

/* start scraping by specifying project and concurrency settings */
scraper.scrape(ScrapeConfig.project, ScrapeConfig.concurrency);
