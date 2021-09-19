/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import path from 'path';
import { destination } from 'pino';
import { PluginStore, Scraper, Project, setLogger, ScrapeEvent, CsvExporter } from '../../src/index';

/* scrape configuration */
import ScrapeConfig from './article-excerpts-config.json';

// write all INFO and above messages to 'scrape.log'
setLogger({ level: 'info' }, destination('scrape.log'));

(async () => {
  /*
  manually register external plugin
  not really needed in this case since the external config file contains a 'path' property to the ReadabilityPlugin
  enabling automatic plugin registration
  if config file is loaded from cli only js plugin files can be imported
  */
  await PluginStore.init();
  await PluginStore.addEntry(path.join(__dirname, 'ReadabilityPlugin.ts'));

  /* create a scraper instance with the above settings */
  const scraper = new Scraper(ScrapeConfig.storage, ScrapeConfig.client);

  scraper.on(ScrapeEvent.ProjectScraped, async (project: Project) => {
    const exporter = new CsvExporter({ filepath: 'article-excerpts.csv' });
    await exporter.export(project);
  });

  /* start scraping by specifying project and concurrency settings */
  scraper.scrape(ScrapeConfig.project, ScrapeConfig.concurrency);
})();
