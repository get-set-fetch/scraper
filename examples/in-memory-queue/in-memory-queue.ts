/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import { destination } from 'pino';
import { Scraper, setLogger, ScrapeEvent, Project, CsvExporter } from '../../src/index';

/* scrape configuration */
import ScrapeConfig from './in-memory-queue-config.json';
import InMemoryConnection from './InMemoryConnection';

/* write all INFO and above messages to 'gsf.logs' */
setLogger({ level: 'info' }, destination('scrape.log'));

/* create a scraper instance with the above settings */
const conn = {
  Project: ScrapeConfig.storage,
  Queue: new InMemoryConnection(),
  Resource: ScrapeConfig.storage,
};
const scraper = new Scraper(conn, ScrapeConfig.client);

scraper.on(ScrapeEvent.ProjectScraped, async (project: Project) => {
  const exporter = new CsvExporter({ filepath: 'in-memory-queue.csv' });
  await exporter.export(project);
});

/* start scraping by specifying project and concurrency settings */
scraper.scrape(ScrapeConfig.project, ScrapeConfig.concurrency);
