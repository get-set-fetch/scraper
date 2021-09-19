/* eslint-disable no-param-reassign */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-case-declarations */
/* eslint-disable no-console */
import fs from 'fs';
import { join, dirname, extname, parse, isAbsolute } from 'path';
import pino from 'pino';
import { ExportOptions } from '../export/Exporter';

import { Scraper, ScrapeEvent, ProjectOptions,
  setLogger, StorageOptions, Project, Exporter, CsvExporter, ZipExporter } from '../index';
import { getPackageDir } from '../plugins/file-utils';
import { ConcurrencyOptions } from '../scraper/ConcurrencyManager';
import { RuntimeOptions } from '../scraper/RuntimeMetrics';
import { ClientOptions, CliOptions } from '../scraper/Scraper';

const defaultArgObj = {
  version: false,
  logLevel: null,
  logDestination: null,
  config: null,
  overwrite: false,
  export: null,
  exportType: null,
  discover: false,
  save: false,
  scrape: false,
  retry: null,
  report: null,
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
  const packageDir = getPackageDir(__dirname);
  const packageFile = fs.readFileSync(join(packageDir, 'package.json')).toString('utf-8');
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

function updateStorageOpts(fullConfigPath: string, storageOpts:StorageOptions):StorageOptions {
  if (!storageOpts) throw new Error('missing storage options');
  if (!storageOpts.client) throw new Error('missing storage client');

  if (storageOpts.client === 'sqlite3') {
    // generate full sqlite3 filepath relative to config file
    if (storageOpts.connection.filename !== ':memory:') {
      storageOpts.connection.filename = join(dirname(fullConfigPath), storageOpts.connection.filename);
      console.log(`using sqlite file ${storageOpts.connection.filename}`);
    }
  }

  return storageOpts;
}

export async function invokeScraper(argObj:ArgObjType) {
  const { config, overwrite, discover, save, scrape, retry, report } = argObj;

  if ((typeof config) !== 'string') throw new Error('invalid config path');
  const fullConfigPath = getFullPath(config);
  if (!fs.existsSync(fullConfigPath)) throw new Error(`config path ${fullConfigPath} does not exist`);
  console.log(`using scrape configuration file ${fullConfigPath}`);

  const configFile = fs.readFileSync(fullConfigPath).toString('utf-8');
  const {
    storage: storageOpts,
    client: clientOpts,
    project: projectOpts,
    concurrency: concurrencyOpts,
    runtime: runtimeOpts,
  }: {
    storage: StorageOptions,
    client: ClientOptions,
    project: ProjectOptions,
    concurrency: ConcurrencyOptions,
    runtime: RuntimeOptions
  } = JSON.parse(configFile);

  if (!projectOpts.name && !discover) {
    throw new Error('missing scrape.name');
  }

  // get an absolute resource path based on the relative path from the configuration file path
  if (projectOpts.resourcePath) {
    projectOpts.resourcePath = join(dirname(fullConfigPath), projectOpts.resourcePath);
    if (!fs.existsSync(projectOpts.resourcePath)) throw new Error(`resource path ${projectOpts.resourcePath} does not exist`);
  }

  // get absolute plugins paths based on the relative path from the configuration file path
  if (projectOpts.pluginOpts) {
    const externalPluginOpts = projectOpts.pluginOpts.filter(pluginOpts => pluginOpts.path);
    externalPluginOpts.forEach(pluginOpts => {
      pluginOpts.path = join(dirname(fullConfigPath), pluginOpts.path);
      if (!fs.existsSync(pluginOpts.path)) throw new Error(`plugin path ${pluginOpts.path} does not exist`);
    });
  }

  const scraper = new Scraper(updateStorageOpts(fullConfigPath, storageOpts), clientOpts);

  // report progress to console every `report` seconds
  if (report) {
    const reportProgressFnc = async (project:Project) => {
      const resourceNo = await project.countResources();
      const unscrapedResourceNo = await project.countUnscrapedResources();
      const prct = completionPercentage(resourceNo, unscrapedResourceNo);
      console.log(`progress (scraped / total resources): ${resourceNo - unscrapedResourceNo} / ${resourceNo} | ${prct}%`);
    };

    let reportTimeout:NodeJS.Timeout;
    scraper.once(ScrapeEvent.ResourceScraped, async (project:Project) => {
      reportProgressFnc(project);
      reportTimeout = setInterval(reportProgressFnc, 1000 * report, project);
    });

    scraper.on(ScrapeEvent.ProjectScraped, async () => {
      clearInterval(reportTimeout);
    });
  }

  if (argObj.export) {
    const exportPath = getFullPath(argObj.export);
    if (!fs.existsSync(dirname(exportPath))) throw new Error(`export path ${dirname(exportPath)} does not exist`);
    console.log(`scraped data will be exported to ${exportPath}`);

    const exportType = argObj.exportType || extname(exportPath).slice(1);

    // cli only supports builtin exporters
    if (![ 'csv', 'zip' ].includes(exportType)) {
      throw new Error('missing or invalid --exportType');
    }

    scraper.addListener(ScrapeEvent.ProjectScraped, async (project:Project) => {
      // when discovering and scraping multiple projects inject project.name into exported filename
      let updatedExportPath = exportPath;
      if (discover) {
        const { dir, name, ext } = parse(exportPath);
        updatedExportPath = join(dir, `${name}-${project.name}${ext}`);
      }

      const exportOpts:ExportOptions = { filepath: updatedExportPath };

      let exporter:Exporter;
      switch (exportType) {
        case 'csv':
          exporter = new CsvExporter(exportOpts);
          break;
        case 'zip':
          exporter = new ZipExporter(exportOpts);
          break;
        default:
      }

      if (exporter) {
        await exporter.export(project);
      }
    });
  }

  scraper.addListener(ScrapeEvent.ProjectError, err => {
    console.error(err);
  });

  const cliOpts:CliOptions = {
    overwrite,
    discover,
    retry,
  };

  if (save) {
    await scraper.save(projectOpts, cliOpts);
  }

  // scrape and discover options are mutually exclusive
  if (scrape) {
    scraper.scrape(projectOpts, concurrencyOpts, runtimeOpts, cliOpts);
  }
  else if (discover) {
    scraper.discover(concurrencyOpts, runtimeOpts, cliOpts);
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

function cli(args) {
  try {
    invoke(args);
  }
  catch (err) {
    console.error(err.message);
  }
}

cli(process.argv);
