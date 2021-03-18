## Changelog

### 0.3.0 - 2021-03-18
- Storage:
  - Project: batchInsertResources allows fast resource saving with just url and depth properties
- Plugins:
  - SelectResourcePlugin: removed, resources are now selected for scraping via ConcurrencyManager
  - BrowserFetchPlugin: improved DOM stability check support, added gotoOptions
- Scenarios:
  - are now renamed to pipelines
- Concurrency:
  - scrape events are now emitted
  - control sequential and parralel scraping behaviour at project/proxy/domain/session level
  - available options: proxyPool, delay, maxRequests
  - browser clients support only sequential scraping with maxRequests = 1
  
### 0.2.0 - 2021-02-11
- Storage
  - Added resource.status
- Browser Clients:
  - Playwright
- DOM Clients:
  - Cheerio
  - Jsdom
- Plugins:
  - NodeFetchPlugin: basic proxy support
  - NodeFetchPlugin, BrowserFetchPlugin: improved fetch error handling for redirect, not found, internal error status
  - ExtractHtmlContentPlugin, ExtractUrlsPlugin: can either run in browser or make use of a dom client
  - UpsertResourcePlugin: new keepHtmlData flag
- Scenarios
  - browser-static-content (former static-content)
  - dom-static-content
- Logging
  * Settings and output destination can now be customized
  * Binary data no longer appears in logs, even on TRACE level

### 0.1.4 (initial version) - 2021-01-20
- Storage:
  * Sqlite
  * MySQL
  * PostgreSQL
- Browser Clients:
  * Puppeteer
- Plugins: 
  * SelectResourcePlugin
  * FetchPlugin
  * ExtractUrlsPlugin
  * ExtractHtmlContentPlugin
  * InsertResourcesPlugin
  * UpsertResourcePlugin
  * ScrollPlugin
- Scenarios
  * static-content
- Pluginstore
  * Bundle javascript, typescript plugins when required to run in DOM
- Scrape
  * Only sequentially
  * Start from a Scraping Configuration
  * Start from a Scraping Hash
  * Start from a Predefined Project
  * Resume Scraping
- Export
  * CSV
  * Zip
- Logging
  * Basic logging capabilities
- Examples