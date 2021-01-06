# get-set-fetch-scraper

<p align="left">
  <a href="https://github.com/get-set-fetch/scraper/actions?query=workflow%3Aaudit">
    <img alt="audit status" src="https://github.com/get-set-fetch/scraper/workflows/audit/badge.svg">
  </a>
  <a href="https://github.com/get-set-fetch/scraper/actions?query=workflow%3Atest">
    <img alt="test status" src="https://github.com/get-set-fetch/scraper/workflows/test/badge.svg">
  </a>
</p>

nodejs web scraper

What follows is a quickstart guide. For more in-depth information the following sections are available:
- [Storage](./src/storage/README.md)
- [Scenarios](./src/scenarios/README.md)
- [Plugins](./src/plugins/README.md)
- [Export](#export)
- [Examples](#examples)
## Important!
The package is not yet published to the npm registry as the scraper is still missing some functionality from the below API.

## Install the scraper
```
$ npm install get-set-fetch-scraper --save
```

## Install a storage solution
```
$ npm install knex sqlite3 --save
```
Supported storage options are defined as peer dependencies. You need to install at least one of them. Currently available: sqlite3, mysql, postgresql. All of them require Knex.js query builder to be installed as well. MongoDB storage is on the roadmap.

## Install a browser client
```
$ npm install puppeteer --save
```
Supported browser clients are defined as peer dependencies.
Right now only puppeteer is supported. Playwright full support and jsdom partial support are on the roadmap. 

## Init storage
```js
const { KnexStorage } = require('get-set-fetch-scraper');
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

## Init browser client
```js
const { PuppeteerClient } = require('get-set-fetch-scraper');
const launchOpts = {
  headless: true,
}
const client = new PuppeteerClient(launchOpts);
```

## Init scraper
```js
const { Scraper } = require('get-set-fetch-scraper');
const scraper = new Scraper(storage, client);
```

## Start scraping
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
          selector: 'h1.work-title',
          label: 'title',
        },
        {
          selector: 'h2.edition-byline a',
          label: 'author',
        },
        {
          selector: 'ul.readers-stats > li.avg-ratings > span[itemProp="ratingValue"]',
          label: 'rating value',
        },
        {
          selector: 'ul.readers-stats > li > span[itemProp="reviewCount"]',
          label: 'review count',
        },
      ],
    },
  ],
});
```
You can define a scraping configuration in multiple ways. The above example is the most direct one.
You define a starting url, a predefined scenario that defines a series of scraping plugins with default options, and any plugin options you want to override. See [scenarios](./src/scenarios/README.md) and [plugins](./src/plugins/README.md) for all available options.

SelectResourcePlugin.delay will add a delay between scraping two consecutive resources (web pages, images, pdfs ...).

ExtractUrlsPlugin.maxDepth defines a maximum depth of resources to be scraped. The starting resource has depth 0. Resources discovered from it have depth 1 and so on. A value of -1 disables this check.

ExtractUrlsPlugin.selectorPairs defines CSS selectors for discovering new resources. urlSelector property selects the links while the optional titleSelector can be used for renaming binary resources like images or pdfs. In order, the define selectorPairs extract pagination urls, book detail urls, img cover urls.

ExtractHtmlContentPlugin.selectorPairs scrapes content via CSS selectors. Optional labels can be used for specifying columns when exporting results as csv.

## Export results
```js
await scraper.export('books.csv', { type: 'csv' });
await scraper.export('book-covers.zip', { type: 'zip' });
```
Export scraped html content as csv. Export scraped images under a zip archive. See [Export](#export) for all supported parameters.
