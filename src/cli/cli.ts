/* eslint-disable no-param-reassign */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-case-declarations */
/* eslint-disable no-console */
import fs from 'fs';
import { join, dirname, extname, parse, isAbsolute } from 'path';
import pino from 'pino';

import { PlaywrightClient, PuppeteerClient, CheerioClient, JsdomClient, BrowserClient,
  IDomClientConstructor,
  Scraper, ScrapeEvent, ScrapeOptions,
  setLogger,
  Storage, StorageConfig, initStorage as initStorageUtil,
  Project } from '../index';

const defaultArgObj = {
  version: false,
  logLevel: null,
  logDestination: null,
  config: null,
  overwrite: false,
  export: null,
  exportType: null,
  discover: false,
};

type ArgObjType = typeof defaultArgObj;

function getFullPath(relativeOrAbsolutePath:string):string {
  return isAbsolute(relativeOrAbsolutePath) ? relativeOrAbsolutePath : join(process.cwd(), relativeOrAbsolutePath);
}

export function completionPercentage(resourceNo: number, unscrapedResourceNo: number) {
  return Math.floor(((resourceNo - unscrapedResourceNo) / resourceNo) * 10000) / 100;
}

/**
 * Takes --arg1 val1 --arg2 process.argv array and creates a plain object {arg1: val1, arg2: val2}.
 * @param args - process.argv
 * @returns plain object with arguments as keys
 */
export function readArgs(args: string[]):Partial<ArgObjType> {
  if (args.length === 0) {
    throw new Error('no arguments provided');
  }

  // read and validate key
  const arg = args[0].trim();
  if (arg.indexOf('--') !== 0) throw new Error(`invalid argument ${arg}, try --${arg}`);
  const argKey = Object.keys(defaultArgObj).find(key => key.toLowerCase() === arg.slice(2).toLowerCase());
  if (!argKey) throw new Error(`unknown argument ${arg}`);

  // read arg value(s)
  let argVal;
  let i = 1;
  while (i < args.length) {
    // found arg value
    if (args[i].indexOf('--') === -1) {
      i += 1;
    }
    // found new key
    else {
      break;
    }
  }

  // no value found, arguments without value are boolean with default value true
  if (i === 1) {
    argVal = true;
  }
  // single value found, arg value is a scalar
  else if (i === 2) {
    argVal = args[1];
  }
  // multiple values found, arg value is an array
  else {
    argVal = args.slice(1, i);
  }

  const currObj:Partial<ArgObjType> = {
    [argKey]: argVal,
  };

  // more arguments to read
  if (i < args.length) {
    const nextObj = readArgs(args.slice(i));
    if (Object.keys(nextObj).includes(argKey)) throw new Error(`duplicate key ${argKey}`);
    return {
      ...currObj,
      ...nextObj,
    };
  }

  // no more arguments to read
  return currObj;
}

export function invokeVersion() {
  // get closest package.json
  const parentPath: string[] = [];
  while (!fs.existsSync(join(__dirname, ...parentPath, 'package.json'))) {
    parentPath.push('..');
  }

  // output version
  const packageFile = fs.readFileSync(join(__dirname, ...parentPath, 'package.json')).toString('utf-8');
  const { version } = JSON.parse(packageFile);
  console.log(`@get-set-fetch/scraper - v${version}`);
}

export function invokeLogger(argObj:ArgObjType) {
  const { logLevel, logDestination } = argObj;

  if (logLevel && (typeof logLevel) !== 'string') throw new Error('invalid loglevel value');

  let fullLogPath:string;
  if (logDestination) {
    if (typeof logDestination !== 'string') throw new Error('invalid logdestination value');
    fullLogPath = getFullPath(<string>logDestination);
    if (!fs.existsSync(dirname(fullLogPath))) throw new Error(`log dirpath ${dirname(fullLogPath)} does not exist`);
  }

  console.log(`setting up logger - level: ${logLevel || 'default'}, destination: ${fullLogPath || 'console'}`);
  setLogger(
    {
      level: logLevel || 'warn',
    },
    logDestination ? pino.destination(fullLogPath) : null,
  );
}

function initStorage(fullConfigPath: string, storageConfig:StorageConfig):Storage {
  if (!storageConfig) throw new Error('missing storage options');
  if (!storageConfig.client) throw new Error('missing storage client');

  if (storageConfig.client === 'sqlite3') {
    // generate full sqlite3 filepath relative to config file
    if (storageConfig.connection.filename !== ':memory:') {
      storageConfig.connection.filename = join(dirname(fullConfigPath), storageConfig.connection.filename);
      console.log(`using sqlite file ${storageConfig.connection.filename}`);
    }
  }

  return initStorageUtil(storageConfig);
}

function initDomClient(domOpts):BrowserClient|IDomClientConstructor {
  if (!domOpts) throw new Error('missing DOM options');
  if (!domOpts.client) throw new Error('missing DOM client');

  let domClient;
  switch (domOpts.client) {
    case 'cheerio':
      if (!CheerioClient) throw new Error('cheerio package not installed');
      domClient = CheerioClient;
      break;
    case 'jsdom':
      if (!JsdomClient) throw new Error('jsdom package not installed');
      domClient = JsdomClient;
      break;
    case 'puppeteer':
      if (!PuppeteerClient) throw new Error('puppeteer package not installed');
      domClient = new PuppeteerClient(domOpts);
      break;
    case 'playwright':
      if (!PlaywrightClient) throw new Error('playwright-core package not installed');
      domClient = new PlaywrightClient(domOpts);
      break;
    default:
      throw new Error(`invalid DOM client ${domOpts.client}`);
  }

  return domClient;
}

export function invokeScraper(argObj:ArgObjType) {
  const { config, overwrite, discover } = argObj;

  if ((typeof config) !== 'string') throw new Error('invalid config path');
  const fullConfigPath = getFullPath(config);
  if (!fs.existsSync(fullConfigPath)) throw new Error(`config path ${fullConfigPath} does not exist`);
  console.log(`using scrape configuration file ${fullConfigPath}`);

  const configFile = fs.readFileSync(fullConfigPath).toString('utf-8');
  const { storage: storageConfig, dom: domOpts, scrape: scrapeConfig, concurrency: concurrencyOpts, process: processOpts } = JSON.parse(configFile);

  if (!scrapeConfig.name && !discover) {
    throw new Error('missing scrape.name');
  }

  // get an absolute resource path based on the relative path from the configuration file path
  if (scrapeConfig.resourcePath) {
    scrapeConfig.resourcePath = join(dirname(fullConfigPath), scrapeConfig.resourcePath);
    if (!fs.existsSync(scrapeConfig.resourcePath)) throw new Error(`resource path ${scrapeConfig.resourcePath} does not exist`);
  }

  // get absolute plugins paths based on the relative path from the configuration file path
  if (scrapeConfig.pluginOpts) {
    const externalPluginOpts = scrapeConfig.pluginOpts.filter(pluginOpts => pluginOpts.path);
    externalPluginOpts.forEach(pluginOpts => {
      pluginOpts.path = join(dirname(fullConfigPath), pluginOpts.path);
      if (!fs.existsSync(pluginOpts.path)) throw new Error(`plugin path ${pluginOpts.path} does not exist`);
    });
  }

  const storage = initStorage(fullConfigPath, storageConfig);
  const domClient = initDomClient(domOpts);

  const scrapeOptions:ScrapeOptions = {
    overwrite,
    discover,
  };

  const scraper = new Scraper(storage, domClient, scrapeOptions);

  scraper.addListener(ScrapeEvent.ResourceScraped, async (project:Project) => {
    const resourceNo = await project.countResources();
    const unscrapedResourceNo = await project.countUnscrapedResources();
    const prct = completionPercentage(resourceNo, unscrapedResourceNo);
    console.log(`progress (scraped / total resources): ${resourceNo - unscrapedResourceNo} / ${resourceNo} | ${prct}%`);
  });

  if (argObj.export) {
    const exportPath = getFullPath(argObj.export);
    if (!fs.existsSync(dirname(exportPath))) throw new Error(`export path ${dirname(exportPath)} does not exist`);
    console.log(`scraped data will be exported to ${exportPath}`);

    let { exportType } = argObj;
    // an export type was not explicitely defined, try to determine it based on export file extension
    if (!exportType) {
      const extName = extname(exportPath);
      switch (extName) {
        case '.csv':
          exportType = 'csv';
          break;
        case '.zip':
          exportType = 'zip';
          break;
        default:
          throw new Error('missing --exportType');
      }
    }

    scraper.addListener(ScrapeEvent.ProjectScraped, async (project:Project) => {
      // when discovering and scraping multiple projects inject project.name into exported filename
      let updatedExportPath = exportPath;
      if (discover) {
        const { dir, name, ext } = parse(exportPath);
        updatedExportPath = join(dir, `${name}-${project.name}${ext}`);
      }

      await scraper.export(updatedExportPath, { type: exportType }, project);
    });
  }

  scraper.addListener(ScrapeEvent.ProjectError, err => {
    console.error(err);
  });

  if (discover) {
    scraper.discover(concurrencyOpts, processOpts);
  }
  else {
    scraper.scrape(scrapeConfig, concurrencyOpts, processOpts);
  }
}

export function invoke(argv: string[]) {
  const argObj:ArgObjType = {
    ...defaultArgObj,
    ...readArgs(argv.slice(2)),
  };

  if (argObj.version) {
    invokeVersion();
  }

  if (argObj.logLevel || argObj.logDestination) {
    invokeLogger(argObj);
  }

  if (argObj.config) {
    invokeScraper(argObj);
  }
}

export default function cli(args) {
  try {
    invoke(args);
  }
  catch (err) {
    console.error(err.toString());
  }
}
