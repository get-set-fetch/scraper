## Changelog

### next-version (not yet published)
- Storage
  - Added resource.status
- Browser Clients:
  - Playwright
- Plugins:
  - FetchPlugin: improved fetch error handling for redirect, not found, internal error status
- Logging
  * Settings and output destination can now be customized
  * Binary data no longer appears in logs, even on TRACE level

### 0.1.4 (initial version)
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