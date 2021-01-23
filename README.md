<img src="https://get-set-fetch.github.io/get-set-fetch/logo.png">

<p align="left">
  <a href="https://github.com/get-set-fetch/scraper/actions?query=workflow%3Aaudit">
    <img alt="audit status" src="https://github.com/get-set-fetch/scraper/workflows/audit/badge.svg">
  </a>
  <a href="https://github.com/get-set-fetch/scraper/actions?query=workflow%3Atest">
    <img alt="test status" src="https://github.com/get-set-fetch/scraper/workflows/test/badge.svg">
  </a>
</p>

# Node.js web scraper

get-set, Fetch! is a plugin based, batteries included, node.js web scraper. It scrapes, stores and exports data.

An ordered list of plugins (builtin or custom) are executed against each to be scraped web resource. Supports multiple storage options: sqlite, mysql, postgresql. Supports headless Chrome via Puppeteer. 

- [Getting Started](#getting-started)
  * [Install](#install-the-scraper)
  * [Init](#init-storage)
  * [Scrape](#start-scraping)
  * [Export](#export-results)
- [Storage](#storage)
  * [SQLite](#sqlite)
  * [MySQL](#mysql)
  * [PostgreSQL](#postgresql)
- [Scenarios](#scenarios)
  * [Static-Content Plugin Options](#static-content-plugin-options)
  * [Static-Content Usage Examples](#static-content-usage-examples)
- [PluginStore](#pluginstore)
- [Plugins](#plugins)
  * [SelectResourcePlugin](#selectresourceplugin)
  * [FetchPlugin](#fetchplugin)
  * [ExtractUrlsPlugin](#extracturlsplugin)
  * [ExtractHtmlContentPlugin](#extracthtmlcontentplugin)
  * [InsertResourcesPlugin](#insertresourcesplugin)
  * [UpsertResourcePlugin](#upsertresourceplugin)
  * [ScrollPlugin](#scrollplugin)
- [Scrape](#scrape)
  * [Start from a Scraping Configuration](#start-from-a-scraping-configuration)
  * [Start from a Scraping Hash](#start-from-a-scraping-hash)
  * [Start from a Predefined Project](#start-from-a-predefined-project)
  * [Resume Scraping](#resume-scraping)
- [Export](#export)
  * [CSV Exporter](#csv-exporter)
  * [ZIP Exporter](#zip-exporter)
- [Logging](#logging)
- [Examples](#examples)
  * [Table Scraping](#table-scraping)
  * [Product Details](#product-details)
  * [PDF Extraction](#pdf-extraction)
  * [Infinite Scrolling](#infinite-scrolling)
  * [Custom Plugins](#custom-plugins)
- [Browser Extension](#browser-extension)

## Getting Started

### Install the scraper
```
$ npm install @get-set-fetch/scraper
```

### Install a storage solution
```
$ npm install knex sqlite3@4
```
Supported storage options are defined as peer dependencies. You need to install at least one of them. Currently available: sqlite3, mysql, postgresql. All of them require Knex.js query builder to be installed as well. MongoDB storage is on the roadmap.

### Install a browser client
```
$ npm install puppeteer
```
Supported browser clients are defined as peer dependencies.
Right now only puppeteer is supported. Playwright full support and jsdom partial support are on the roadmap. 

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
See [Storage](#storage) on full configurations for supported sqlite, mysql, postgresql.

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

### Start scraping
```js
await scraper.scrape({
  url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'SelectResourcePlugin',
      delay: 2000,
    },
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
});
```
You can define a scraping configuration in multiple ways. The above example is the most direct one.
You define a starting url, a predefined scenario that defines a series of scraping plugins with default options, and any plugin options you want to override. See [scenarios](#scenarios) and [plugins](#plugins) for all available options.

SelectResourcePlugin.delay will add a delay between scraping two consecutive resources (web pages, images, pdfs ...).

ExtractUrlsPlugin.maxDepth defines a maximum depth of resources to be scraped. The starting resource has depth 0. Resources discovered from it have depth 1 and so on. A value of -1 disables this check.

ExtractUrlsPlugin.selectorPairs defines CSS selectors for discovering new resources. urlSelector property selects the links while the optional titleSelector can be used for renaming binary resources like images or pdfs. In order, the define selectorPairs extract pagination urls, book detail urls, img cover urls.

ExtractHtmlContentPlugin.selectorPairs scrapes content via CSS selectors. Optional labels can be used for specifying columns when exporting results as csv.

### Export results
```js
await scraper.export('books.csv', { type: 'csv' });
await scraper.export('book-covers.zip', { type: 'zip' });
```
Export scraped html content as csv. Export scraped images under a zip archive. See [Export](#export) for all supported parameters.


## Storage

Each url (web page, image, API endpoint, ...) represents a [Resource](./src/storage/base/Resource.ts). Binary content is stored under `resource.data` while text based content is stored under `resource.content`. Resources sharing the same scraping configuration and discovered from the same initial url are grouped in a [Project](./src/storage/base/Project.ts). 
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
$ npm install knex sqlite3@4
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

## Scenarios

Each scenario contains a series of plugins with predefined values for all plugin options. A scraping configuration extends a scenario by replacing/adding new plugins or overriding the predefined plugin options.

Take a look at [Examples](#examples) for real world scraping configurations.

### static-content plugin options

 Plugin | Option | Default value |
| ----------- | ----------- | -- |
| SelectResourcePlugin | frequency | -1
|                      | delay     | 1000
| FetchPlugin          | stabilityCheck | 0
|                      | stabilityTimeout     | 0
| ExtractUrlsPlugin    | maxDepth | -1
|                      | selectorPairs     | [ { urlSelector: 'a[href$=".html"]' } ]
| ExtractHtmlContentPlugin | selectorPairs | []
| InsertResourcesPlugin | maxResources | -1
| UpsertResourcePlugin |  | 

### static-content usage examples

Limit scraping to a single page by setting `ExtractUrlsPlugin.maxDepth` to `0`.
```js
await scraper.scrape({
  url: 'startUrl',
  scenario: 'static-content',
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
await scraper.scrape({
  url: 'startUrl',
  scenario: 'static-content',
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

Add a new `ScrollPlugin` to the scenario and scroll html pages to reveal further dynamically loaded content.
```js
await scraper.scrape({
  url: 'startUrl',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'ScrollPlugin',
      after: 'UpsertResourcePlugin',
      stabilityCheck: 1000,
    }
  ]
})
```

## PluginStore 
Prior to scraping, available plugins are registered into a plugin store via their filepaths. Each plugin is a javascript module with a default export declaration containing a class extending [Plugin](./src/plugins/Plugin.ts). Class `constructor.name` is used to uniquely identify a plugin. Each plugin together with its dependencies is bundled as a single module to be run either in DOM or node.js.

Specifying a filePath will register a single plugin. Specifying a dirPath will register all plugins stored under that directory. Paths are absolute.
```js
await PluginStore.add(fileOrDirPath);
```

## Plugins

The entire scraping process is plugin based. A scraping configuration (see [Examples](#examples)) contains an ordered list of plugins to be executed against each to be scraped web resource. Each plugin embeds a json schema for its options. Check the schemas for complete option definitions.

### SelectResourcePlugin
Selects a resource to scrape from the current project | [schema](./src/plugins/default/SelectResourcePlugin.ts)
- `delay`
  - Delay in milliseconds between fetching two consecutive resources.
  - default: 1000


### FetchPlugin
Depending on resource type (binary, html), either downloads or opens in the scraping tab the resource url | [schema](./src/plugins/default/FetchPlugin.ts)
- `stabilityCheck`
  - Considers the page loaded and ready to be scraped when there are no more DOM changes within the specified amount of time (milliseconds). Only applies to html resources. Useful for bypassing preloader content.
  - default: 0
- `stabilityTimeout`
  - Maximum waiting time (miliseconds) for achieving DOM stability in case of a continuously updated DOM (ex: timers, countdowns).
  - default: 0

### ExtractUrlsPlugin
Extracts new (html or binary) resource urls using CSS selectors | [schema](./src/plugins/default/ExtractUrlsPlugin.ts)
- `maxDepth`
  - Maximum depth of resources to be scraped. The starting resource has depth 0. Resources discovered from it have depth 1 and so on. A value of -1 disables this check.
  - default: -1
- `selectorPairs`
  - Array of CSS selectors to be applied. Each entry is a `{ urlSelector, titleSelector }` object. titleSelector is optional and it is used for prefixing the generated filename when the urlSelector points to a binary resource.
  - default: `[ { urlSelector: 'a[href$=".html"]' } ]`

### ExtractHtmlContentPlugin
Scrapes html content using CSS selectors | [schema](./src/plugins/default/ExtractHtmlContentPlugin.ts)
- `selectorPairs`
  - Array of CSS selectors to be applied. Each entry is a `{ contentSelector, contentProperty, label }` object. contentSelector: selects DOM elements while contentProperty specifies the DOM element property that holds the value to be scraped defaulting to `innerText`. label is used as column name when exporting as csv.
  - default: none

### InsertResourcesPlugin
Saves new resources within the current project based on newly identified urls | [schema](./src/plugins/default/InsertResourcesPlugin.ts)
- `maxResources`
  - Maximum number of resources to be saved and scraped. A value of -1 disables this check.
  - default: -1

### UpsertResourcePlugin
Updates a static resource or inserts a dynamic one after being scraped by previous plugins | [schema](./src/plugins/default/UpsertResourcePlugin.ts)

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
  - Maximum waiting time (miliseconds) for achieving DOM stability in case of a continuously updated DOM (ex: timers, countdowns).
  - default: 3000

## Scrape

### Start from a Scraping Configuration
No need to specify a starting scraping project. One will be automatically created based on input url and plugin definitions. The project name resolves to the starting url hostname.

```js
const { KnexStorage, PuppeteerClient, Scraper} = require('@get-set-fetch/scraper');

const storage = new KnexStorage();
const client = new PuppeteerClient();
const scraper = new Scraper(storage, client);

await scraper.scrape({
  url: 'https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers',
  scenario: 'static-content',
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

### Start from a Scraping Hash
A scraping hash represents a zlib archive of a scraping configuration encoded as base64. To minimize size a preset deflate dictionary is used.

```js
const { KnexStorage, PuppeteerClient, Scraper, encode, decode } = require('@get-set-fetch/scraper');

const storage = new KnexStorage();
const client = new PuppeteerClient();
const scraper = new Scraper(storage, client);

const scrapingHash = 'eLt7R4n7pZNBCsIwEEWvkmWLmoruuvAE3iFMzTQNTdLQpBVv79QSrEpBKCEw+Yv5zPyXb2rQ8btutUepgXe9KqZXcdUhiq4WBpwaQGEQ1UO4wVbYT7IjokYUwSO0SBFt4O0j+Hd+x19E/iNzgSOFapBbjCAhAtsxT3cWpyFfFYuydLE53BptZHbK2YVBWVOzOEvkkVhPu1ilfL/R/Zwv3NJuWWaJTIIjX/9ddJ43QKbJ';

console.log(decode(scrapingHash));
// outputs the scraping configuration from the above "Scrape starting from a scraping configuration" section
// use encode to generate a scraping hash

await scraper.scrape(scrapingHash);
```

### Start from a Predefined Project
A new project is defined with plugin options overriding default ones from `static-content` scenario.

```js
const { KnexStorage, scenarios, mergePluginOpts, PuppeteerClient, Scraper } = require('@get-set-fetch/scraper');

const storage = new KnexStorage();
const { Project } = await storage.connect();
const project = new Project({
  name: 'projA.com',
  url: 'http://projA.com',
  pluginOpts: mergePluginOpts(
    scenarios['static-content'].defaultPluginOpts,
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
await scraper.scrape(project);
```

### Resume scraping
If a project has unscraped resources, just re-start the scraping process. Already scraped resources will be ignored.
You can retrieve an existing project by name or id. When scraping from a scraping configuration the project name gets populated with the starting url hostname.

```js
const { KnexStorage, PuppeteerClient, Scraper } = require('@get-set-fetch/scraper');

const storage = new KnexStorage();
const { Project } = await storage.connect();
const project = await Project.get('startUrlHostname');

const client = new PuppeteerClient();

const scraper = new Scraper(storage, client);
await scraper.scrape(project);
```

## Export

Scraped content is stored at database level in resource entries under a project. See [Storage](#storage) for more info.
Each exporter constructor takes 3 parameters:
- `project` - content from all resources under the given project will be exported
- `filepath` - location to store the content, relative to the current working directory
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

## Examples

What follows are real world scraping examples. If in the meanwhile the pages have changed, the scraping configurations below may become obsolete and no longer produce the expected scraping results. Last check performed on 7th January 2021. 

[Acceptance test definitions](https://github.com/get-set-fetch/test-utils/tree/main/lib/scraping-suite) may also serve as inspiration.

### Table Scraping
Top languages by population. Extract tabular data from a single static html page. [See full script.](./examples/table-scraping.ts)
```js
const scrapingConfig = {
  url: 'https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers',
  scenario: 'static-content',
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
const scrapingConfig = {
  url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'SelectResourcePlugin',
      delay: 1000,
    },
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
const scrapingConfig = {
  url: 'https://www.who.int/emergencies/diseases/novel-coronavirus-2019/situation-reports',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'SelectResourcePlugin',
      delay: 1000,
    },
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
const scrapingConfig = {
  url: 'https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/',
  scenario: 'static-content',
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
const scrapingConfig = {
  url: 'https://www.bbc.com/news/technology',
  scenario: 'static-content',
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

Both projects share the same storage, scenarios, plugins concepts but unfortunately no code. I'm planning to fix this in the next versions so code from scraper can be used in the extension. 