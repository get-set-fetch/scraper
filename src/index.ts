/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable object-curly-newline */

function moduleExists(name) {
  try {
    return require.resolve(name);
  }
  catch (e) {
    return false;
  }
}

const KnexStorage = moduleExists('knex') ? require('./storage/knex/KnexStorage').default : null;
const PuppeteerClient = moduleExists('puppeteer') ? require('./browserclient/PuppeteerClient').default : null;
const PlaywrightClient = moduleExists('playwright-core') ? require('./browserclient/PlaywrightClient').default : null;
const CheerioClient = moduleExists('cheerio') ? require('./domclient/CheerioClient').default : null;
const JsdomClient = moduleExists('jsdom') ? require('./domclient/JsdomClient').default : null;

export {
  KnexStorage,
  PuppeteerClient,
  PlaywrightClient,
  CheerioClient,
  JsdomClient,
};

export { default as Project } from './storage/base/Project';
export { default as Resource } from './storage/base/Resource';
export { default as Plugin, PluginOpts } from './plugins/Plugin';
export { default as PluginStore, StoreEntry } from './pluginstore/PluginStore';
export { default as Scraper, ScrapeConfig, ScrapeEvent } from './scraper/Scraper';

export { getLogger, setLogger } from './logger/Logger';
export { encode, decode } from './confighash/config-hash';
export { default as CsvExporter } from './export/CsvExporter';
export { default as ZipExporter } from './export/ZipExporter';
export { pipelines, mergePluginOpts } from './pipelines/pipelines';
