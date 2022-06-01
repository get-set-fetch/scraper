## Changelog

### Unreleased
- Scraper
  - new events replacing the generic ResourceError event: ResourceSelectError, ResourceScrapeError
- Cloud
  - Ansible role updates
  - Terraform module updates
  - new Ansible role: gsf-scraper-queue
- Datasets
  - completed 1st dataset project - javascript-libs-from-top-1mm-sites - to serve as blueprint for future ones

### 0.10.0 - 2022-02-20
- Cloud:
  - added base Terraform module
  - added Ansible roles
- Concurrency:
  - improved buffering, total number of scrape-in-progress resources deviates less from concurrency maxRequests option
  - improved debugging
- Plugins
  - NodeFetchPlugin:
    - new tlsCheck, dnsResolution, connectTimeout, readTimeout options
- Logging
  - LogWrapper
    - new level getter for the wrapped logger level
    - simplify, colorize output on console destination

### 0.9.0 - 2021-12-05
- Storage
  - Linkage update between Project/Queue/Resource and their corresponding, independent storage options via Connection and ConnectionManager.
  
### 0.8.0 - 2021-11-16
- Storage
  - Scrape queue is now a separate collection.
  - Each project has its own Queue, Resource collections with their own storage options. In future versions this allows for storage combinations like in-memory scrape queue with database scraped content.

### 0.7.1 - 2021-09-27
- All default plugins are now exported so that they can be easily extended.

### 0.7.0 - 2021-09-19
BREAKING CHANGES: Scraper and Exporter class signatures have changed.

- Scraper
  - Scraper class signature update
- Export
  - Exporter class signature update
  - Custom exporters are now supported
### 0.6.0 - 2021-08-15
- Docker
  - added Dockerfile with docker and docker-compose examples
- Command Line
  - fixed a bug where absolute paths were treated as relative
  - new options: save, scrape, retry, report
- Scraper
  - gracefully shutdown on SIGTERM, SIGINT
- Plugins
  - NodeFetchPlugin: 
    - new rejectUnauthorized option
- Storage
  - Postgresql performance improvements
### 0.5.0 - 2021-05-20
- Command Line
  - external plugins can be specified in the config file via pluginOpts.path
  - scrape progress is displayed after each scraped resource
  - relative file paths are resolved to current working directory
  - more verbose error messages when missing packages
  - errors output to stderr
- Scraper
  - multiple starting urls can be defined at scrape definition level
- Storage
  - Project: no longer contains a single start url
- Export
  * scraped resources with no content are also exported as csv rows with just the url
### 0.4.0 - 2021-05-14
- Command Line
  - supported arguments: --version, --loglevel, --logdestination, --config, --discover, --overwrite, --export, --exportType
- Plugins
  - NodeFetchPlugin: 
    - supports br, gzip, deflate content encoding
    - added headers option with `{'Accept-Encoding': 'br,gzip,deflate'}` default value
- RuntimeMetrics
  - added memory and cpu usage constraints at process and OS level
- Export
  - relative and absolute export paths are now supported
- Scraper
  - scrape configuration contains an optional name parameter
- Storage:
  - Project: batchInsertResourcesFromFile allows saving project resources from external csv files
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