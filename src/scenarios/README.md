# Scenarios

Each scenario contains a series of plugins with predefined values for all plugin options. A scraping definition extends a scenario by replacing/adding new plugins or overriding the predefined plugin options.

Take a look at [Examples](../../examples/README.md) for real world scraping definitions.

## static-content plugin options

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

## static-content usage examples

Limit scraping to a single page by setting ExtractUrlsPlugin.maxDepth to 0.
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

Scrape from each html page all elements found by the "h1.title" CSS selector.
```js
await scraper.scrape({
  url: 'startUrl',
  scenario: 'static-content',
  pluginOpts: [
    {
      name: 'ExtractHtmlContentPlugin',
      selectorPairs: [
        {
          contentSelector 'h1.title',
          label: 'main title',
        },
      ]
    }
  ]
})
```

Add a new ScrollPlugin to the scenario and scroll html pages to reveal further dynamically loaded content.
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


