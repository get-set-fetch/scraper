/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import { destination } from 'pino';
import { Scraper, Project, setLogger, ScrapeEvent, CsvExporter, ZipExporter } from '../../src/index';

/* scrape configuration */
import ScrapeConfig from './product-details-config.json';

// write all INFO and above messages to 'scrape.log'
setLogger({ level: 'info' }, destination('scrape.log'));

/* create a scraper instance with the above settings */
const scraper = new Scraper(ScrapeConfig.storage, ScrapeConfig.client);

/* export books details as csv */
scraper.on(ScrapeEvent.ProjectScraped, async (project: Project) => {
  const exporter = new CsvExporter({ filepath: 'books.csv' });
  await exporter.export(project);
});

/* export book covers as zip */
scraper.on(ScrapeEvent.ProjectScraped, async (project: Project) => {
  const exporter = new ZipExporter({ filepath: 'book-covers.zip' });
  await exporter.export(project);
});

/* start scraping by specifying project and concurrency settings */
scraper.scrape(ScrapeConfig.project, ScrapeConfig.concurrency);
