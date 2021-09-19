/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import { destination } from 'pino';
import { Scraper, setLogger, ScrapeEvent, Project } from '../../src/index';

/* scrape configuration */
import ScrapeConfig from './scrape-config.json';
import SitemapExporter from './SitemapExporter';

/*
write all INFO and above messages to 'gsf.logs'
for more verbose logging when troubleshooting switch to DEBUG
*/
setLogger({ level: 'info' }, destination('scrape.log'));

/* create a scraper instance with the above settings */
const scraper = new Scraper(ScrapeConfig.storage, ScrapeConfig.client);

scraper.on(ScrapeEvent.ProjectScraped, async (project: Project) => {
  const exporter = new SitemapExporter({ filepath: 'sitemap.xml' });
  await exporter.export(project);
});

/* start scraping by specifying project and concurrency settings */
scraper.scrape(ScrapeConfig.project, ScrapeConfig.concurrency);
