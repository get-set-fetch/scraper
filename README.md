<img src="https://get-set-fetch.github.io/get-set-fetch/logo.png">

[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat)](https://github.com/get-set-fetch/scraper/blob/main/LICENSE)
[![Audit Status](https://github.com/get-set-fetch/scraper/workflows/audit/badge.svg)](https://github.com/get-set-fetch/scraper/actions?query=workflow%3Aaudit)
[![Build Status](https://github.com/get-set-fetch/scraper/workflows/test/badge.svg)](https://github.com/get-set-fetch/scraper/actions?query=workflow%3Atest)
[![Coverage Status](https://coveralls.io/repos/github/get-set-fetch/scraper/badge.svg?branch=main)](https://coveralls.io/github/get-set-fetch/scraper?branch=main)

# Node.js web scraper

get-set, Fetch! is a plugin based, nodejs web scraper. It scrapes, stores and exports data. At its core, an ordered list of plugins (default or custom defined) is executed against each to be scraped web resource.

Supports multiple storage options: SQLite, MySQL, PostgreSQL.  
Supports multiple browser or dom-like clients: Puppeteer, Playwright, Cheerio, Jsdom. 

You can use it from your own javascript/typescript code, via [command line](https://www.getsetfetch.org/node/command-line.html) or [docker container](https://www.getsetfetch.org/node/docker.html).

What follows is a brief "Getting Started" guide using SQLite as storage and Puppeteer as browser client. For an in-depth documentation vist [getsetfetch.org](https://www.getsetfetch.org). See [changelog](changelog.md) for past release notes and [development](development.md) for technical tidbits.

#### Install the scraper
```
$ npm install @get-set-fetch/scraper
```

#### Install peer dependencies
```
$ npm install knex sqlite3 puppeteer
```
Supported storage options and browser clients are defined as peer dependencies. Manually install your selected choices.

#### Init storage
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
See [Storage](https://www.getsetfetch.org/node/storage.html) on full configurations for supported SQLite, MySQL, PostgreSQL.

#### Init browser client
```js
const { PuppeteerClient } = require('@get-set-fetch/scraper');
const launchOpts = {
  headless: true,
}
const client = new PuppeteerClient(launchOpts);
```

#### Init scraper
```js
const { Scraper } = require('@get-set-fetch/scraper');
const scraper = new Scraper(storage, client);
```

#### Define project options
```js
const projectOpts = {
  name: "myScrapeProject",
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
  resources: [
    {
      url: 'https://openlibrary.org/authors/OL34221A/Isaac_Asimov?page=1'
    }
  ]
};
```
You can define a project in multiple ways. The above example is the most direct one.

You define one or more starting urls, a predefined pipeline containing a series of scrape plugins with default options, and any plugin options you want to override. See [pipelines](https://www.getsetfetch.org/node/pipelines.html) and [plugins](https://www.getsetfetch.org/node/plugins.html) for all available options.

ExtractUrlsPlugin.maxDepth defines a maximum depth of resources to be scraped. The starting resource has depth 0. Resources discovered from it have depth 1 and so on. A value of -1 disables this check.

ExtractUrlsPlugin.selectorPairs defines CSS selectors for discovering new resources. urlSelector property selects the links while the optional titleSelector can be used for renaming binary resources like images or pdfs. In order, the define selectorPairs extract pagination URLs, book detail URLs, image cover URLs.

ExtractHtmlContentPlugin.selectorPairs scrapes content via CSS selectors. Optional labels can be used for specifying columns when exporting results as csv.

#### Define concurrency options
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
A minimum delay of 5000 ms will be enforced between scraping consecutive resources from the same domain. At project level, across all domains, any two resources will be scraped with a minimum 1000 ms delay between requests. See [concurrency options](https://www.getsetfetch.org/node/scrape.html#concurrency-options) for all available options.

#### Start scraping
```js
scraper.scrape(projectOpts, concurrencyOpts);
```
The entire process is asynchronous. Listen to the emitted [scrape events](https://www.getsetfetch.org/node/scrape.html#scrape-events) to monitor progress.

#### Export results
```js
const { ScrapeEvent } = require('@get-set-fetch/scraper');

scraper.on(ScrapeEvent.ProjectScraped, async (project) => {
  await scraper.export('books.csv', { type: 'csv' });
  await scraper.export('book-covers.zip', { type: 'zip' });
})
```
Wait for scraping to complete by listening to `ProjectScraped` event.

Export scraped html content as csv. Export scraped images under a zip archive. See [Export](https://www.getsetfetch.org/node/export.html) for all supported parameters.


#### Browser Extension
This project is based on lessons learned developing [get-set-fetch-extension](https://github.com/get-set-fetch/extension), a scraping browser extension for Chrome, Firefox and Edge.

Both projects share the same storage, pipelines, plugins concepts but unfortunately no code. I'm planning to fix this in the future so code from scraper can be used in the extension. 