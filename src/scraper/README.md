# Scraper

## Scrape starting from a scraping definition
No need to specify a starting scraping project. One will be automatically created based on input url and plugin definitions.

```js
const { KnexStorage, PuppeteerClient, Scraper} = require('get-set-fetch-scraper');

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

## Scrape starting from a scraping hash
A scraping hash represents a zlib archive of a scraping definition encoded as base64. To minimize size a preset deflate dictionary is used.

```js
const { KnexStorage, PuppeteerClient, Scraper, encode, decode } = require('get-set-fetch-scraper');

const storage = new KnexStorage();
const client = new PuppeteerClient();
const scraper = new Scraper(storage, client);

const scrapingHash = 'eLt7R4n7pZNBCsIwEEWvkmWLmoruuvAE3iFMzTQNTdLQpBVv79QSrEpBKCEw+Yv5zPyXb2rQ8btutUepgXe9KqZXcdUhiq4WBpwaQGEQ1UO4wVbYT7IjokYUwSO0SBFt4O0j+Hd+x19E/iNzgSOFapBbjCAhAtsxT3cWpyFfFYuydLE53BptZHbK2YVBWVOzOEvkkVhPu1ilfL/R/Zwv3NJuWWaJTIIjX/9ddJ43QKbJ';

console.log(decode(scrapingHash));
// outputs the scraping definition from the above "Scrape starting from a scraping definition" section
// use encode to generate a scraping hash

await scraper.scrape(scrapingHash);
```

## Scrape starting from a predefined project
A new project is defined with plugin options overriding default ones from `static-content` scenario.

```js
const { KnexStorage, scenarios, mergePluginOpts, PuppeteerClient, Scraper } = require('get-set-fetch-scraper');

const storage = new KnexStorage();
const { Project } = await storage.connect();
const project = new Project({
  name: 'projA',
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