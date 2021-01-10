## Plugins

The entire scraping process is plugin based. A scraping definition (see [Examples](../../examples/README.md)) contains an ordered list of plugins to be executed against each to be scraped web resource. Each plugin embeds a json schema for its options. Check the schemas for complete option definitions.

## PluginStore 
Prior to scraping, available plugins are registered into a plugin store via their filepaths. Each plugin is a javascript module with a default export declaration containing a class extending [Plugin](./Plugin.ts). Class `constructor.name` is used to uniquely identify a plugin. Each plugin together with its dependencies is bundled as a single module to be run either in DOM or node.js.

Specifying a filePath will register a single plugin. Specifying a dirPath will register all plugins stored under that directory. Paths are relative to the current working directory.
```js
await PluginStore.add(fileOrDirPath);
```

## SelectResourcePlugin
Selects a resource to scrape from the current project | [schema](./default/SelectResourcePlugin.ts)
- `delay`
  - Delay in milliseconds between fetching two consecutive resources.
  - default: 1000


## FetchPlugin
Depending on resource type (binary, html), either downloads or opens in the scraping tab the resource url | [schema](./default/FetchPlugin.ts)
- `stabilityCheck`
  - Considers the page loaded and ready to be scraped when there are no more DOM changes within the specified amount of time (milliseconds). Only applies to html resources. Useful for bypassing preloader content.
  - default: 0
- `stabilityTimeout`
  - Maximum waiting time (miliseconds) for achieving DOM stability in case of a continuously updated DOM (ex: timers, countdowns).
  - default: 0

## ExtractUrlsPlugin
Extracts new (html or binary) resource urls using CSS selectors | [schema](./default/ExtractUrlsPlugin.ts)
- `maxDepth`
  - Maximum depth of resources to be scraped. The starting resource has depth 0. Resources discovered from it have depth 1 and so on. A value of -1 disables this check.
  - default: -1
- `selectorPairs`
  - Array of CSS selectors to be applied. Each entry is a `{ urlSelector, titleSelector }` object. titleSelector is optional and it is used for prefixing the generated filename when the urlSelector points to a binary resource.
  - default: `[ { urlSelector: 'a[href$=".html"]' } ]`

## ExtractHtmlContentPlugin
Scrapes html content using CSS selectors | [schema](./default/ExtractHtmlContentPlugin.ts)
- `selectorPairs`
  - Array of CSS selectors to be applied. Each entry is a `{ contentSelector, contentProperty, label }` object. contentSelector: selects DOM elements while contentProperty specifies the DOM element property that holds the value to be scraped defaulting to `innerText`. label is used as column name when exporting as csv.
  - default: none

## InsertResourcesPlugin
Saves new resources within the current project based on newly identified urls | [schema](./default/InsertResourcesPlugin.ts)
- `maxResources`
  - Maximum number of resources to be saved and scraped. A value of -1 disables this check.
  - default: -1

## UpsertResourcePlugin
Updates a static resource or inserts a dynamic one after being scraped by previous plugins | [schema](./default/UpsertResourcePlugin.ts)

## ScrollPlugin
Performs infinite scrolling in order to load additional content | [schema](./default/ScrollPlugin.ts)
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