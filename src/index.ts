/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable object-curly-newline */

import { moduleExists } from './plugins/file-utils';

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

export { default as BrowserClient } from './browserclient/BrowserClient';
export { IDomClientConstructor } from './domclient/DomClient';

export { default as Storage, StorageOptions } from './storage/base/Storage';
export { default as ModelStorage } from './storage/ModelStorage';

export { default as Project } from './storage/base/Project';
export { default as Resource, ResourceQuery } from './storage/base/Resource';
export { default as Plugin, PluginOpts } from './plugins/Plugin';

export { default as BrowserFetchPlugin } from './plugins/default/BrowserFetchPlugin';
export { default as ExtractHtmlContentPlugin } from './plugins/default/ExtractHtmlContentPlugin';
export { default as ExtractUrlsPlugin } from './plugins/default/ExtractUrlsPlugin';
export { default as InsertResourcesPlugin } from './plugins/default/InsertResourcesPlugin';
export { default as NodeFetchPlugin } from './plugins/default/NodeFetchPlugin';
export { default as ScrollPlugin } from './plugins/default/ScrollPlugin';
export { default as UpsertResourcePlugin } from './plugins/default/UpsertResourcePlugin';

export { default as PluginStore, StoreEntry } from './pluginstore/PluginStore';
export { default as Scraper, ScrapeConfig, ProjectOptions, ScrapeEvent } from './scraper/Scraper';

export { default as ConcurrencyManager, ConcurrencyOptions } from './scraper/ConcurrencyManager';

export { default as SchemaHelper, SchemaType } from './schema/SchemaHelper';

export { getLogger, setLogger } from './logger/Logger';
export { encode, decode } from './confighash/config-hash';
export { default as Exporter } from './export/Exporter';
export { default as CsvExporter } from './export/CsvExporter';
export { default as ZipExporter } from './export/ZipExporter';
export { pipelines, mergePluginOpts } from './pipelines/pipelines';
