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

## Important!
The package is not yet published to the npm registry as the scraper is still missing some functionality from the below API.

Work in progress:
- Storage
- Browser clients
- Scenarios
- Plugins
- Examples

## Install the scraper
```
$ npm install get-set-fetch-scraper --save
```

## Install a storage solution
```
$ npm install knex, sqlite3 --save
```
Supported storage options are defined as peer dependencies. You need to install at least one of them. Currently available: sqlite3, mysql, postgresql. All of them require Knex.js query builder to be installed as well.

## Install a browser client
```
$ npm install puppeteer --save
```
Supported browser clients are defined as peer dependencies.
Right now only puppeteer is supported

## Init storage
```js
const { KnexStorage } = require('get-set-fetch-scraper');
const conn = {
  "client": "sqlite3",
  "useNullAsDefault": true,
  "connection": {
    "filename": ":memory:"
  }
}
const storage = new KnexStorage(conn);
```
See Knex.js documentation on full configurations for supported sqlite, mysql, postgresql.

## Init browser client
```js
const { BrowserClient } = require('get-set-fetch-scraper');
const launchOpts = {
  "headless": true,
}
const client = new BrowserClient(launchOpts);
```

## Init scraper
```js
const { Scraper } = require('get-set-fetch-scraper');
const launchOpts = {
  "headless": true,
}
const scraper = new Scraper(storage, client);
```

## Start scraping
```js
await scraper.scrape({
  url: "https://en.wikipedia.org/wiki/List_of_languages_by_number_of_native_speakers",
  scenario: "static",
  pluginOpts: [
    {
      "name": "ExtractUrlsPlugin",
      "maxDepth": 0
    },
    {
      "name": "ExtractHtmlContentPlugin",
      "selectorPairs": [
        {
          "selector": "td span"
        },
      ]
    }
  ]
});
```
The above configuration scrapes the content from the second wiki table and stops. 
Each scenario contains a list of predefined plugins with default options. To scrape a resource each plugin is invoked sequentially.
Usually, the first plugin selects a resource from the database and the last one updates it with the scraped content. You can override the default pluginOpts via pluginOpts.

In the above example ExtractUrlsPlugin is responsible for discovering new resources to be scraped. A maxDepth value of 0 limits the scraping to the url provided, achieving single page scraping. ExtractHtmlContentPlugin is responsible for actual scraping via provided CSS selectors.

## Export results
```js
scraper.export('languages.csv')
```
Export scraping content as csv.
