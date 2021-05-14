<img src="https://get-set-fetch.github.io/get-set-fetch/logo.png">

[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat)](https://github.com/get-set-fetch/scraper/blob/main/LICENSE)
[![Audit Status](https://github.com/get-set-fetch/scraper/workflows/audit/badge.svg)](https://github.com/get-set-fetch/scraper/actions?query=workflow%3Aaudit)
[![Build Status](https://github.com/get-set-fetch/scraper/workflows/test/badge.svg)](https://github.com/get-set-fetch/scraper/actions?query=workflow%3Atest)
[![Coverage Status](https://coveralls.io/repos/github/get-set-fetch/scraper/badge.svg?branch=main)](https://coveralls.io/github/get-set-fetch/scraper?branch=main)

# Node.js web scraper

get-set, Fetch! is a plugin based, batteries included, open source nodejs web scraper. It scrapes, stores and exports data.

An ordered list of plugins (builtin or custom) is executed against each to be scraped web resource. Supports multiple storage options: SQLite, MySQL, PostgreSQL. Supports multiple browser or dom-like clients: Puppeteer, Playwright, Cheerio, Jsdom. 

- [Getting Started](#getting-started)
  * [Install](#install-the-scraper)
  * [Init](#init-storage)
  * [Define a Scrape Configuration](#define-a-scrape-configuration)
  * [Define Concurrency Options](#define-concurrency-options)
  * [Scrape](#start-scraping)
  * [Export](#export-results)
- [Storage](#storage)
  * [SQLite](#sqlite)
  * [MySQL](#mysql)
  * [PostgreSQL](#postgresql)
- [Pipelines](#pipelines)
  * [Static-Content](#static-content-pipeline)
    * [Browser Plugin Options](#browser-static-content-plugin-options)
    * [DOM Plugin Options](#dom-static-content-plugin-options)
    * [Examples](#static-content-usage-examples)
- [Browser Clients](#browser-clients)
  * [Puppeteer](#puppeteer)
  * [Playwright](#playwright)
- [DOM Clients](#dom-clients)
  * [Cheerio](#cheerio)
  * [Jsdom](#jsdom)
- [PluginStore](#pluginstore)
- [Plugins](#plugins)
  * [NodeFetchPlugin](#nodefetchplugin)
  * [BrowserFetchPlugin](#browserfetchplugin)
  * [ExtractUrlsPlugin](#extracturlsplugin)
  * [ExtractHtmlContentPlugin](#extracthtmlcontentplugin)
  * [InsertResourcesPlugin](#insertresourcesplugin)
  * [UpsertResourcePlugin](#upsertresourceplugin)
  * [ScrollPlugin](#scrollplugin)
- [Scrape](#scrape)
  * [Start from a Scrape Configuration](#start-from-a-scrape-configuration)
  * [Start from a Scrape Hash](#start-from-a-scrape-hash)
  * [Start from a Predefined Project](#start-from-a-predefined-project)
  * [Resume Scraping](#resume-scraping)
  * [Scrape Events](#scrape-events)
  * [Concurrency Options](#concurrency-options)
  * [Runtime Options](#runtime-options)
  * [Scrape Options](#scrape-options)
- [Export](#export)
  * [CSV Exporter](#csv-exporter)
  * [ZIP Exporter](#zip-exporter)
- [Logging](#logging)
- [Command Line Interface](#command-line-interface)
- [Examples](#examples)
  * [Table Scraping](#table-scraping)
  * [Product Details](#product-details)
  * [PDF Extraction](#pdf-extraction)
  * [Infinite Scrolling](#infinite-scrolling)
  * [Custom Plugins](#custom-plugins)
- [Changelog](changelog.md)
- [Browser Extension](#browser-extension)

## Getting Started

### Install the scraper
```
$ npm install @get-set-fetch/scraper
```

### Install a storage solution
```
$ npm install knex sqlite3
```
Supported storage options are defined as peer dependencies. You need to install at least one of them. Currently available: SQLite, MySQL, PostgreSQL. All of them require Knex.js query builder to be installed as well. NoSQL support is on the roadmap.

### Install a browser client
```
$ npm install puppeteer
```
Supported browser clients are defined as peer dependencies. Supported browser clients: Puppeteer, Playwright. Supported DOM clients: Cheerio, JSDom.
### Init storage
```js
const { KnexStorage } = require('@get-set-fetch/scraper');
const conn = {
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: ':memory:'
  }
}
const storage = new KnexStorage(conn);
```
See [Storage](#storage) on full configurations for supported SQLite, MySQL, PostgreSQL.

### Init browser client
```js
const { PuppeteerClient } = require('@get-set-fetch/scraper');
const launchOpts = {
  headless: true,
}
const client = new PuppeteerClient(launchOpts);
```

### Init scraper
```js
const { Scraper } = require('@get-set-fetch/scraper');
const scraper = new Scraper(storage, client);
```

### Define a scrape configuration
```js
const scrapeConfig = {
  url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 3,
      selectorPairs: [
        {
          urlSelector: '#searchResults ~ .pagination > a.ChoosePage:nth-child(2)',
        },
        {
          urlSelector: 'h3.booktitle a.results',
        },
        {
          urlSelector: 'a.coverLook > img.cover',
        },
      ],
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'h1.work-title',
          label: 'title',
        },
        {
          contentSelector: 'h2.edition-byline a',
          label: 'author',
        },
        {
          contentSelector: 'ul.readers-stats > li.avg-ratings > span[itemProp="ratingValue"]',
          label: 'rating value',
        },
        {
          contentSelector: 'ul.readers-stats > li > span[itemProp="reviewCount"]',
          label: 'review count',
        },
      ],
    },
  ],
};
```
You can define a scrape configuration in multiple ways. The above example is the most direct one.
You define a starting url, a predefined pipeline containing a series of scrape plugins with default options, and any plugin options you want to override. See [pipelines](#pipelines) and [plugins](#plugins) for all available options.

ExtractUrlsPlugin.maxDepth defines a maximum depth of resources to be scraped. The starting resource has depth 0. Resources discovered from it have depth 1 and so on. A value of -1 disables this check.

ExtractUrlsPlugin.selectorPairs defines CSS selectors for discovering new resources. urlSelector property selects the links while the optional titleSelector can be used for renaming binary resources like images or pdfs. In order, the define selectorPairs extract pagination URLs, book detail URLs, image cover URLs.

ExtractHtmlContentPlugin.selectorPairs scrapes content via CSS selectors. Optional labels can be used for specifying columns when exporting results as csv.

### Define concurrency options
```js
const concurrencyOpts = {
  project: {
    delay: 1000
  }
  domain: {
    delay: 5000
  }
}
```
A minimum delay of 5000 ms will be enforced between scraping consecutive resources from the same domain. At project level, across all domains, any two resources will be scraped with a minimum 1000 ms delay between requests. See [concurrency options](#concurrency-options) for all available options.

### Start scraping
```js
scraper.scrape(scrapeConfig, concurrencyOpts);
```
The entire process is asynchronous. Listen to the emitted [scrape events](#scrape-events) to monitor progress.

### Export results
```js
const { ScrapeEvent } = require('@get-set-fetch/scraper');

scraper.on(ScrapeEvent.ProjectScraped, async (project) => {
  await scraper.export('books.csv', { type: 'csv' });
  await scraper.export('book-covers.zip', { type: 'zip' });
})
```
Wait for scraping to complete by listening to `ProjectScraped` event.

Export scraped html content as csv. Export scraped images under a zip archive. See [Export](#export) for all supported parameters.


## Storage

Each URL (web page, image, API endpoint, ...) represents a [Resource](./src/storage/base/Resource.ts). Binary content is stored under `resource.data` while text based content is stored under `resource.content`. Resources sharing the same scrape configuration and discovered from the same initial URL(s) are grouped in a [Project](./src/storage/base/Project.ts). 
Projects represent the starting point for any scraping operation.

You can add additional storage support by implementing the above two abstract classes and [Storage](./src/storage/base/Storage.ts).

Sqlite, MySQL, PostgreSQL use [KnexStorage](./src/storage/knex/KnexStorage.ts). Check below connection examples for possible values of `conn`.

```js
const { KnexStorage } = require('@get-set-fetch/scraper');
const storage = new KnexStorage(conn);
```

Database credentials from the connection examples below match the ones from the corresponding docker files.

### SQLite
Default storage option if none provided consuming the least amount of resources. Requires knex and sqlite driver. I'm recommending sqlite3@4 as it seems latest 5.0.x versions don't yet have pre-built binaries for all major node versions. 
```
$ npm install knex sqlite3
```
Examples: [SQLite connection](./test/config/storage/sqlite/sqlite-conn.json)

### MySQL
Requires knex and mysql driver.
```
$ npm install knex mysql
```
Examples: [MySQL connection](./test/config/storage/mysql/mysql-conn.json) | [MySQL docker file](./test/config/storage/mysql/mysql.yml)


### PostgreSQL
Requires knex and postgresql driver.
```
$ npm install knex pg
```
Examples: [PostgreSQL connection](./test/config/storage/pg/pg-conn.json) | [PostgreSQL docker file](./test/config/storage/pg/pg.yml)

## Pipelines

Each pipeline contains a series of plugins with predefined values for all plugin options. A scrape configuration extends a pipeline by replacing/adding new plugins or overriding the predefined plugin options.

Take a look at [Examples](#examples) for real world scrape configurations.

### Static Content Pipeline
Use to scrape static data, does not rely on javascript to either read or alter the html content. 

Comes in two variants [browser-static-content](#browser-static-content-plugin-options), [dom-static-content](#dom-static-content-plugin-options). First one runs in browser, second one makes use of a dom-like parsing library such as cheerio.
### browser-static-content plugin options

 Plugin | Option | Default value |
| ----------- | ----------- | -- |
| BrowserFetchPlugin   | gotoOptions.timeout | 30000 
|                      | gotoOptions.waitUntil | domcontentloaded       
|                      | stabilityCheck | 0
|                      | stabilityTimeout     | 0
| ExtractUrlsPlugin    | domRead | true
|                      | maxDepth | -1
|                      | selectorPairs     | [ { urlSelector: 'a[href$=".html"]' } ]
| ExtractHtmlContentPlugin | domRead | true
|                          | selectorPairs | []
| InsertResourcesPlugin | maxResources | -1
| UpsertResourcePlugin | keepHtmlData  | false


### dom-static-content plugin options

 Plugin | Option | Default value |
| ----------- | ----------- | -- |
| NodeFetchPlugin      | headers | { 'Accept-Encoding': 'br,gzip,deflate' }
| ExtractUrlsPlugin    | domRead | false
|                      | maxDepth | -1
|                      | selectorPairs     | [ { urlSelector: 'a[href$=".html"]' } ]
| ExtractHtmlContentPlugin | domRead | false
|                          | selectorPairs | []
| InsertResourcesPlugin | maxResources | -1
| UpsertResourcePlugin | keepHtmlData  | false

### Static Content usage examples

Limit scraping to a single page by setting `ExtractUrlsPlugin.maxDepth` to `0`.
```js
scraper.scrape({
  url: 'startUrl',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 0,
    }
  ]
})
```

Scrape from each html page all elements found by the `h1.title` CSS selector.
```js
scraper.scrape({
  url: 'startUrl',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'h1.title',
          label: 'main title',
        },
      ]
    }
  ]
})
```

Add a new `ScrollPlugin` to the pipeline and scroll html pages to reveal further dynamically loaded content.
```js
scraper.scrape({
  url: 'startUrl',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ScrollPlugin',
      after: 'UpsertResourcePlugin',
      stabilityCheck: 1000,
    }
  ]
})
```

## Browser Clients
Clients controlling an actual browser. You can use such clients with predefined pipelines prefixed by 'browser' like [browser-static-content](#browser-static-content). Each client needs to be manually installed as @get-set-fetch/scraper is not bundling them. 

If not specified, a default `headless:true` flag is added to the `launchOpts`.

### Puppeteer
```
$ npm install puppeteer
```

```js
const { Scraper, PuppeteerClient } = require('@get-set-fetch/scraper');
// assumes launchOpts, storage are already defined
const client = new PuppeteerClient(launchOpts);
const scraper = new Scraper(storage, client);
```

### Playwright
```
$ npm install playwright-core playwright-chromium
```
The above installs playwright for Chromium. If targeting Webkit or Firefox keep `playwright-core` and either install `playwright-webkit` or `playwright-firefox`.

```js
const { Scraper, PlaywrightClient } = require('@get-set-fetch/scraper');
// assumes launchOpts, storage are already defined
const client = new PlaywrightClient(launchOpts);
const scraper = new Scraper(storage, client);
```

## DOM Clients
Clients capable of parsing and querying html content exposing DOM like functionality such as `querySelectorAll`, `getAttribute`.  You can use such clients with predefined pipelines prefixed by 'dom' like [dom-static-content](#dom-static-content). Each client needs to be manually installed as @get-set-fetch/scraper is not bundling them.

When defining your own plugins you can directly use your favorite html parsing library, you don't have to use any of the clients described below. They are designed as a compatibility layer between DOM like libraries and browser DOM API so that predefined plugins like [ExtractHtmlContentPlugin](#extracthtmlcontentplugin), [ExtractUrlsPlugin](#extracturlsplugin) can use either one interchangeably. 

For html resources, access to html content is done via `resource.data.toString('utf8')`. Each plugin is called with a `resource` argument, see [Custom Plugins](#custom-plugins) for further info.

### Cheerio
```
$ npm install cheerio
```

```js
const { Scraper, CheerioClient } = require('@get-set-fetch/scraper');
// assumes storage is already defined
const scraper = new Scraper(storage, CheerioClient);
```

### Jsdom
```
$ npm install jsdom
```

```js
const { Scraper, JsdomClient } = require('@get-set-fetch/scraper');
// assumes storage is already defined
const scraper = new Scraper(storage, JsdomClient);
```


## PluginStore 
Prior to scraping, available plugins are registered into a plugin store via their filepaths. Each plugin is a javascript module with a default export declaration containing a class extending [Plugin](./src/plugins/Plugin.ts). Class `constructor.name` is used to uniquely identify a plugin. Each plugin together with its dependencies is bundled as a single module to be run either in DOM or node.js.

Specifying a filePath will register a single plugin. Specifying a dirPath will register all plugins stored under that directory. Paths are absolute.
```js
await PluginStore.add(fileOrDirPath);
```

## Plugins

The entire scrape process is plugin based. A scrape configuration (see [Examples](#examples)) contains an ordered list of plugins to be executed against each to be scraped web resource. Each plugin embeds a json schema for its options. Check the schemas for complete option definitions.

### NodeFetchPlugin
Uses nodejs `http.request` / `https.request` to fetch html and binary data. Response content is available under Uint8Array `resource.data`.  Html content can be retrieved via `resource.data.toString('utf8')`.
- `headers`
  - Request headers.
  - default: `{ 'Accept-Encoding': 'br,gzip,deflate' }`

### BrowserFetchPlugin
Depending on resource type (binary, html), either downloads or opens in the scrape tab the resource URL | [schema](./src/plugins/default/FetchPlugin.ts)
- `gotoOptions`
  - navigation parameters for Puppeteer/Playwright page.goto API.
  - `timeout`
    - maximum navigation time in milliseconds
    - default: 30000
  - `waitUntil`
    - when to consider navigation succeeded
    - default: domcontentloaded
- `stabilityCheck`
  - Considers the page loaded and ready to be scraped when there are no more DOM changes within the specified amount of time (milliseconds). Only applies to html resources. Useful for bypassing preloader content.
  - default: 0
- `stabilityTimeout`
  - Maximum waiting time (milliseconds) for achieving DOM stability in case of a continuously updated DOM (ex: timers, countdowns).
  - default: 0

### ExtractUrlsPlugin
Extracts new (html or binary) resource URLs using CSS selectors | [schema](./src/plugins/default/ExtractUrlsPlugin.ts)
- `domRead`
  - Whether or not the plugin runs in browser DOM or makes use of a DOM-like parsing library like cheerio
  - default: `true`
- `maxDepth`
  - Maximum depth of resources to be scraped. The starting resource has depth 0. Resources discovered from it have depth 1 and so on. A value of -1 disables this check.
  - default: -1
- `selectorPairs`
  - Array of CSS selectors to be applied. Each entry is a `{ urlSelector, titleSelector }` object. titleSelector is optional and it is used for prefixing the generated filename when the urlSelector points to a binary resource.
  - default: `[ { urlSelector: 'a[href$=".html"]' } ]`

### ExtractHtmlContentPlugin
Scrapes html content using CSS selectors | [schema](./src/plugins/default/ExtractHtmlContentPlugin.ts)
- `domRead`
  - Whether or not the plugin runs in browser DOM or makes use of a DOM-like parsing library like cheerio
- `selectorPairs`
  - Array of CSS selectors to be applied. Each entry is a `{ contentSelector, contentProperty, label }` object. contentSelector: selects DOM elements while contentProperty specifies the DOM element property that holds the value to be scraped defaulting to `innerText`. label is used as column name when exporting as csv.
  - default: none

### InsertResourcesPlugin
Saves new resources within the current project based on newly identified URLs | [schema](./src/plugins/default/InsertResourcesPlugin.ts)
- `maxResources`
  - Maximum number of resources to be saved and scraped. A value of -1 disables this check.
  - default: -1

### UpsertResourcePlugin
Updates a static resource or inserts a dynamic one after being scraped by previous plugins | [schema](./src/plugins/default/UpsertResourcePlugin.ts)
- `keepHtmlData`
  - Whether or not to save html buffer response (if present) under resource.data

### ScrollPlugin
Performs infinite scrolling in order to load additional content | [schema](./src/plugins/default/ScrollPlugin.ts)
- `delay`
  - Delay (milliseconds) between performing two consecutive scroll operations.
  - default: 1000
- `maxActions`
  - Number of maximum scroll actions. A value of -1 scrolls till no new content is added to the page.
  - default: -1
- `stabilityCheck`
  - Considers the page loaded and ready to be scraped when there are no more DOM changes within the specified amount of time (milliseconds). Useful for bypassing preloader content.
  - default: 1000
- `stabilityTimeout`
  - Maximum waiting time (milliseconds) for achieving DOM stability in case of a continuously updated DOM (ex: timers, countdowns).
  - default: 3000

## Scrape

### Start from a Scrape Configuration
No need to specify a starting scrape project. One will be automatically created based on input URL and plugin definitions. If not provided the project name resolves to the starting URL hostname.

```js
const { KnexStorage, PuppeteerClient, Scraper} = require('@get-set-fetch/scraper');

const storage = new KnexStorage();
const client = new PuppeteerClient();
const scraper = new Scraper(storage, client);

scraper.scrape({
  name: 'language-list',
  url: 'https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 0,
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'table.metadata + p + table.wikitable td:nth-child(2) > a:first-child',
          label: 'language',
        },
        {
          contentSelector: 'table.metadata + p + table.wikitable td:nth-child(3)',
          label: 'speakers (milions)',
        },
      ],
    },
  ],
});
```

### Start from a Scrape Hash
A scrape hash represents a zlib archive of a scrape configuration encoded as base64. To minimize size a preset deflate dictionary is used.

```js
const { KnexStorage, PuppeteerClient, Scraper, encode, decode } = require('@get-set-fetch/scraper');

const storage = new KnexStorage();
const client = new PuppeteerClient();
const scraper = new Scraper(storage, client);

const scrapingHash = 'ePm8oZWZQ085qXl65ZnZwBSTkpmol1+Urg/i6ftkFpfE56fF5yTmpZcmpqcWxydVxueV5ialFoGE84BJpyw1vrggNTE7FRj6RKQ5QgkMJW4RUWSAmQqIS4qY6Q8YTzmpermpJYkpiSWJCtoKBUAMEQT5GcxSKEmxyivJ0E3OyMxJ0TDSVLBTSLRKA5pZAhECWgVL47CgUQK5kBq2GWsimQ4LWgWNXGDiAsavJij2YmsBAzufSg==';

// outputs the scrape configuration from the above "Scrape starting from a scrape configuration" section
// use encode to generate a scrape hash
console.log(decode(scrapingHash));

scraper.scrape(scrapingHash);
```

### Start from a Predefined Project
A new project is defined with plugin options overriding default ones from `static-content` pipeline.

```js
const { KnexStorage, pipelines, mergePluginOpts, PuppeteerClient, Scraper } = require('@get-set-fetch/scraper');

const storage = new KnexStorage();
const { Project } = await storage.connect();
const project = new Project({
  name: 'projA.com',
  url: 'http://projA.com',
  pluginOpts: mergePluginOpts(
    pipelines['browser-static-content'].defaultPluginOpts,
    [
      {
        name: 'ExtractUrlsPlugin',
        maxDepth: 0,
      },
      {
        name: 'MyCustomPlugin',
        before: 'UpsertResourcePlugin',
        optA: 'valA',
      }
    ]
  ),
});
await project.save();

const client = new PuppeteerClient();

const scraper = new Scraper(storage, client);
scraper.scrape(project);
```

You can add additional resources to a project via `batchInsertResources(resources, chunkSize)`. Each entry contains an URL and an optional depth. If depth is not specified the resource will be linked to the project with depth 0. By default, every 1000 resources are wrapped inside a transaction.
```js
await project.batchInsertResources(
  [
    {url: 'http://sitea.com/page1.html'},
    {url: 'http://sitea.com/page2.html', depth: 1}
  ],
  2000
);
```
The above performs URI normalization and creates a wrapping transaction every 2000 resources.

Additional resources can also be directly loaded from a csv file via `batchInsertResourcesFromFile(resourcePath, chunkSize)`. The column containing the resource url will automatically be detected. Making use of read/write streams, this method keeps memory usage low and is the preferred way of adding 1000k+ entries. `resourcePath` is either absolute or relative to the current working directory. `chunkSize` parameter behaves the same as in `batchInsertResources`.
```js
await project.batchInsertResourcesFromFile(
  './csv/external-resources.csv', 2000
);
```


### Resume scraping
If a project has unscraped resources, just re-start the scrape process. Already scraped resources will be ignored.
You can retrieve an existing project by name or id. When scraping from a scrape configuration the project name gets populated with the starting URL hostname.

```js
const { KnexStorage, PuppeteerClient, Scraper } = require('@get-set-fetch/scraper');

const storage = new KnexStorage();
const { Project } = await storage.connect();
const project = await Project.get('startUrlHostname');

const client = new PuppeteerClient();

const scraper = new Scraper(storage, client);
scraper.scrape(project);
```
### Scrape events

| Event | Callback arguments | Occurs when ... |
| ----------- | ----------- | -- |
| ResourceSelected | project, resource | a resource is selected to be scraped, its scrapeInProgress flag is set to true
| ResourceScraped | project, resource | a resource is updated with the scraped content, its scrapeInProgress flag is set to false
| ResourceError | project, resource, error | a scraping error linked to a particular resource stops the resource scraping, project scraping continues
| ProjectSelected | project | a project is ready for scraping, storage/browser client/plugins have been initialized
| ProjectScraped | project | all resources linked to the project are scraped
| ProjectError | project, error |  a scraping error not linked to a particular resource stops the scraping process
| DiscoverComplete | | project discovery is complete, all existing projects have all their resources scraped

```js
const { ScrapeEvent } = require('@get-set-fetch/scraper');

scraper.on(ScrapeEvent.ProjectScraped, async (project) => {
  console.log(`project ${project.name} has been scraped`);
});

scraper.on(ScrapeEvent.ResourceError, async (project, resource, err) => {
  console.log(`error scraping resource ${resource.url} from project ${project.name}: ${err.message}`);
})
```
Scrape event handlers examples.

### Concurrency options
`maxRequests` and `delay` options can be specified at project/proxy/domain/session level. A session is identified as a unique proxy + domain combination. 
All options are optional :) with all combinations valid. The resulting scrape behavior will obey all specified options.
- `proxyPool`
  - list of proxies to be used with each entry a {host, port} object
  - default: [null]
- `maxRequests`
  - Maximum number of requests to be run in parallel. Browser clients are restricted to `1`, supporting only sequential scraping. Use [DOM clients](#dom-clients) for parallel scraping.
  - default: 1
- `delay`:
  - Minimum amount of time (ms) between starting to scrape two resources.
  - default: -/500/1000/- at project/proxy/domain/session level. Restrictions are set only at proxy/domain level.

```js
const concurrencyOpts = {
  proxyPool: [
    { host: 'proxyA', port: 8080 },
    { host: 'proxyB', port: 8080 }
  ],
  project: {
    maxRequests: 100,
    delay: 100
  },
  proxy: {
    maxRequests: 50,
    delay: 200
  },
  domain: {
    maxRequests: 10,
    delay: 500
  },
  session: {
    maxRequests: 1,
    delay: 3000
  }
}

scraper.scrape(scrapeConfig, concurrencyOpts);
```
The above concurrency options will use proxyA, proxyB when fetching resources. 

At project level a maximum of 100 resources can be scraped in parallel with a minimum 100 ms between issuing new requests. 

Each proxy can have a maximum of 50 parallel requests with a minimum 200 ms delay before using the same proxy again. 

Each domain to be scraped (independent of the proxy being used) will experience a load of maximum 10 parallel requests with a minimum 0.5 second delay between any two requests.

User sessions defined as unique proxy + domain combinations mimic real user behavior scraping sequentially (maxRequests = 1) every 3 seconds.

### Runtime options
Optional runtime memory and cpu usage constraints defined at OS and process level. If memory or cpu usage is higher than specified new resources will not be scraped until the usage drops. By default there are no constraints.
- `mem`
  - Memory usage (bytes)
- `memPct`
  - Memory usage (percentage)
- `cpuPct`
  - Average cpu usage (percentage)
```js
const runtimeOpts = {
  global: {
    memPct: 75
  },
  process: {
    mem: 10,000,000
  }
}
scraper.scrape(scrapeConfig, concurrencyOpts, processOpts);
```
The above runtime options will restrict scraper to 10MB process memory usage while also making sure total OS memory usage doesn't exceed 75%.

### Scrape options
Additional, optional scrape flags:
- `overwrite`
  - Overwrite a project if already exists.
  - default: `false`
- `discover`
  - Don't restrict scraping to a particular project. Once scraping a project completes, find other existing projects to scrape from..
  - default: `false`

```js
const scrapeOpts = {
  overwrite:true,
  discover:true
}
scraper.scrape(scrapeConfig, concurrencyOpts, processOpts, scrapeOpts);
```
## Export

Scraped content is stored at database level in resource entries under a project. See [Storage](#storage) for more info.
Each exporter constructor takes 3 parameters:
- `project` - content from all resources under the given project will be exported
- `filepath` - location to store the content, absolute or relative to the current working directory
- `opts` - export options pertinent to the selected export type


You can export directly from each individual exporter.
```js
const { CsvExporter, ZipExporter } = require('@get-set-fetch/scraper');
exporter = new CsvExporter(project, 'file.csv', {fieldSeparator: ','});
await exporter.export();
```

Or via a scraper instance with the project parameter being omitted as it is already linked to the scraper. In this case you also need to specify the export type as either csv or zip.
```js
await scraper.export('file.csv', {type: 'csv', fieldSeparator: ','});
```


### CSV Exporter
Exports scraped content as csv.
- `cols`
  - Resource properties to be exported. Suitable properties for export: url, actions, depth, scrapedAt, contentType, content, parent.
  - default: `[ 'url', 'content' ]`
- `pageLimit`
  - Number of resources to be retrieved when doing a bulk read.
  - default: `100`
- `fieldSeparator`
  - default: `','`
- `lineSeparator`
  - default: `'\n'`

### ZIP Exporter
Exports binary resources as a series of zip archives.
- `pageLimit`
  - Number of resources to be retrieved when doing a bulk read. Each bulk read generates a zip archive (store compression) containing a counter increment at the end of the filename.
  - default: `100`

## Logging
Logging is done via a wrapper over pino supporting all its log levels. There is a main logger available via `getLogger()` writing by default to console on warning level or above. Individual modules can acquire their own child logger overriding  some of the main logger settings (like level) but not the write destination.
```js
const { getLogger } = require('@get-set-fetch/scraper');
const logger = getLogger('MyModule', {level: 'debug'});
logger.info({ optional: 'obj' }, 'info msg');
```
The above outputs:
```
{"level":30,"time":1611400362464,"module":"MyModule","optional":"obj","msg":"info msg"}
```

If you want to change the write destination construct a new logger via `setLogger`. Due to the existing log wrapper, existing child loggers will also output to the new destination.
```js
const { destination } = require('pino');
const { setLogger } = require('@get-set-fetch/scraper');
setLogger({ level: 'info' }, destination('./scraping.log'))
```
The above sets the logging output to a file. Existing child loggers will also output to it.

## Command Line Interface
Cli usage covers two main use cases: (create and scrape a new project)[create-and-scrape-a-new-project], scrape existing projects. Both use cases make use of a configuration file containing storage, scrape and concurrency settings. Both use cases support optional custom log settings such as level and destination.


| Argument  | Default Value | Description |
| ----------- | ----------- | ----------- |
| version | - | project version |
| loglevel | warn | log level |
| logdestination | console | log filepath |
| config | - | config filepath. Examples: [new project](./test/acceptance/cli/static-single-page-single-content-entry.json), [new project with external resources from csv file using resourcePath](./test/acceptance/cli/static-with-external-resources.json) |
| overwrite | false | When creating a new project, whether or not to overwrite an already existing one with the same name
| discover | false | Sequentially scrape existing projects until there are no more resources to be scraped
| export | - | Export resources as zip or csv after scraping completes using the specified filepath. If in discovery mode each project will be exported in a separate file containing the project name.

When you only need the cli, install the package and its peer dependencies globally.
```bash
npm install -g @get-set-fetch/scraper knex sqlite3 cheerio
```
The above uses knex with sqlite3 for storage, cheerio as a dom client.

```bash
# Create and scrape a new project
gsfscrape --config scrape-config.json --loglevel info --logdestination scrape.log --overwrite --export project.csv
```

```bash
# Scrape existing projects
gsfscrape --config scrape-config.json --discover --loglevel info --logdestination scrape.log --export project.csv
```

### Configuration File

## Examples

What follows are real world scrape examples. If in the meanwhile the pages have changed, the scrape configurations below may become obsolete and no longer produce the expected scrape results. Last check performed on 7th January 2021. 

[Acceptance test definitions](https://github.com/get-set-fetch/test-utils/tree/main/lib/scraping-suite) may also serve as inspiration.

### Table Scraping
Top languages by population. Extract tabular data from a single static html page. [See full script.](./examples/table-scraping.ts)
```js
const scrapeConfig = {
  url: 'https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 0,
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'table.metadata + p + table.wikitable td:nth-child(2) > a:first-child',
          label: 'language',
        },
        {
          contentSelector: 'table.metadata + p + table.wikitable td:nth-child(3)',
          label: 'speakers (milions)',
        },
      ],
    },
  ],
};
```

### Product Details
Book details with author, title, rating value, review count. Also scrapes the book covers. Only the first and second page of results are being scraped. [See full script.](./examples/product-details.ts)
```js
const scrapeConfig = {
  url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 3,
      selectorPairs: [
        {
          urlSelector: '#searchResults ~ .pagination > a.ChoosePage:nth-child(2)',
        },
        {
          urlSelector: 'h3.booktitle a.results',
        },
        {
          urlSelector: 'a.coverLook > img.cover',
        },
      ],
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'h1.work-title',
          label: 'title',
        },
        {
          contentSelector: 'h2.edition-byline a',
          label: 'author',
        },
        {
          contentSelector: 'ul.readers-stats > li.avg-ratings > span[itemProp="ratingValue"]',
          label: 'rating value',
        },
        {
          contentSelector: 'ul.readers-stats > li > span[itemProp="reviewCount"]',
          label: 'review count',
        },
      ],
    },
  ],
};
```

### PDF Extraction
World Health Organization COVID-19 Updates during last month. Opens each report page and downloads the pdf. [See full script.](./examples/pdf-extraction.ts)
```js
const scrapeConfig = {
  url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/situation-reports',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 2,
      selectorPairs: [
        {
          urlSelector: '.sf-meeting-report-list:nth-child(5) > a.sf-meeting-report-list__item',
        },
        {
          urlSelector: '.button-blue-background > a',
          titleSelector: 'h1.dynamic-content__heading',
        },
      ],
    },
  ],
};
```

### Infinite Scrolling
UEFA Champions League top goalscorers. Keeps scrolling and loading new content until the final 100th position is reached. After each scroll action scraping is resumed only after the preloader is removed and the new content is available. [See full script.](./examples/infinite-scrolling.ts)
```js
const scrapeConfig = {
  url: 'https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 0,
    },
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector: 'div.statistics-item--name',
          label: 'player',
        },
        {
          contentSelector: 'div.history-numbers',
          label: 'goals',
        },
      ],
    },
    {
      name: 'ScrollPlugin',
      after: 'UpsertResourcePlugin',
      stabilityCheck: 1000,
    },
  ],
};
```

### Custom Plugins
At minimum a plugin needs to define two functions: test and apply. The former checks if the plugin should be invoked, the latter invokes it. Both functions can be executed in either node.js or browser environments.

A plugin is executed in browser if it defines a `domRead` or `domWrite` option set to `true`. When registering such a plugin via `PluginStore.addEntry` a bundle is created containing all its dependencies, including node_modules ones. Try to have such dependencies in ECMAScript module format as this enables tree shaking keeping the bundle size to a minimum. Other module formats like CommonJS are non-deterministic at build time severely limiting tree shaking capabilities. The entire module may be added to the plugin bundle even though you're only using a part of it.

```js
import { Readability } from '@mozilla/readability';

export default class ReadabilityPlugin {
  opts = {
    domRead: true,
  }

  test(project, resource) {
    if (!resource) return false;
    return (/html/i).test(resource.contentType);
  }

  apply() {
    const article = new Readability(document).parse();
    return { content: [ [ article.excerpt ] ] };
  }
}
```
The above plugin checks if a web resource is already loaded and is of html type. If these test conditions are met, it extracts a page excerpt using `@mozilla/readability` library. It runs in browser due to its `domRead` option set to `true`. `content` is a predefined property at [Resource](#storage) level with a `string[][]` type. Think of it as data rows with each row containing one or multiple entries. When extracting excerpts from a web page, there is only one row and it contains a single excerpt element.

Prior to scraping the plugin needs to be registered.
```js
await PluginStore.init();
await PluginStore.addEntry(join(__dirname, 'plugins', 'ReadabilityPlugin.js'));
```

With the help of this plugin one can extract article excerpts from news sites such as BBC technology section. Custom `ReadabilityPlugin` replaces builtin `ExtractHtmlContentPlugin`. Only links containing hrefs starting with `/news/technology-` are followed. Scraping is limited to 5 articles. [See full script.](./examples/custom-plugin-readability.ts)
```js
const scrapeConfig = {
  url: 'https://www.bbc.com/news/technology',
  pipeline: 'browser-static-content',
  pluginOpts: [
    {
      name: 'ExtractUrlsPlugin',
      maxDepth: 1,
      selectorPairs: [
        { urlSelector: "a[href ^= '/news/technology-']" },
      ],
    },
    {
      name: 'ReadabilityPlugin',
      replace: 'ExtractHtmlContentPlugin',
      domRead: true,
    },
    {
      name: 'InsertResourcesPlugin',
      maxResources: 5,
    },
  ],
};
```



## Browser Extension
This project is based on lessons learned developing [get-set-fetch-extension](https://github.com/get-set-fetch/extension), a scraping browser extension for Chrome and Firefox.

Both projects share the same storage, pipelines, plugins concepts but unfortunately no code. I'm planning to fix this in the next versions so code from scraper can be used in the extension. 