const enum ScrapeEvent {
  ResourceSelected = 'resource-selected',
  ResourceScraped = 'resource-scraped',
  ResourceError = 'resource-error',

  ProjectSelected = 'project-selected',
  ProjectScraped = 'project-scraped',
  ProjectError = 'project-error',
}

export default ScrapeEvent;
