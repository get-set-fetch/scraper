import { destination } from 'pino';
/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import { Scraper, Project, setLogger, ScrapeEvent, CsvExporter } from '../../src/index';

/* scrape configuration */
import ScrapeConfig from './tls-fingerprinting-config.json';

// write all INFO and above messages to 'scrape.log'
setLogger({ level: 'info' }); // destination('scrape.log')

/* create a scraper instance with the above settings */
const scraper = new Scraper(ScrapeConfig.storage, ScrapeConfig.client);

scraper.on(ScrapeEvent.ProjectScraped, async (project: Project) => {
  const exporter = new CsvExporter({ filepath: 'languages.csv' });
  await exporter.export(project);
});

/* start scraping by specifying project and concurrency settings */
scraper.scrape(ScrapeConfig.project, ScrapeConfig.concurrency);
