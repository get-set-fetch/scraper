import Project from '../storage/base/Project';
import Resource from '../storage/base/Resource';

export default class QueueBuffer {
  project: Project;
  resources: Resource[];
  size: number;

  /**
   * Prevents parallel project.queue.getResourcesToScrape calls
   */
  refillInProgress:boolean;

  error;

  constructor(size: number) {
    this.size = size;
    this.resources = [];
  }

  init(project, resources: Resource[]) {
    this.project = project;
    this.resources = resources;
  }

  async refill():Promise<void> {
    // buffer is only filled sequentially
    if (this.refillInProgress) return;

    try {
      this.refillInProgress = true;
      const toBeScrapedResources = await this.project.queue.getResourcesToScrape(this.size - this.resources.length);
      this.addResources(toBeScrapedResources);
      this.refillInProgress = false;
    }
    catch (err) {
      // parent call doesn't wait for this async to finish thus can't catch it, store err separately
      this.error = err;
    }
  }

  async getResource(stop:boolean):Promise<Resource> {
    /*
    stop signal has been received
    gracefully stop scraping, allow all scrape-in-progress resources to be scraped
    */
    if (stop) {
      if (this.resources.length > 0) {
        // re-make to-be-scraped buffered resources eligible for scraping by reseting their status flag
        await Promise.all(this.resources.map(resource => this.project.queue.updateStatus(resource.queueEntryId, null)));
        this.resources = [];
      }

      return null;
    }

    /*
    stop signal was received due to buffer error in an independent async call, throw the error up
    parent scraper will catch any errors and stop the process via the `stop` flag
    */
    if (this.error) throw (this.error);

    // attemp to re-fill buffer before it's completely empty
    if (this.resources.length < this.size / 2) {
      // buffer needs to be refilled now, can't refill it independently, we risk isScrapingComplete condition to pass
      if (this.resources.length === 0) {
        await this.refill();
        // take advantage of waiting for refillBuffer, directly thrown the error if one was caught
        // avoid isScrapingComplete returning true on empty buffer due to refillBuffer error
        if (this.error) throw (this.error);
      }
      // refill buffer independently
      else {
        this.refill();
      }
    }

    // in the future, don't just retrieve the 1st resource, attempt to search for one meeting the concurrency conditions
    return this.resources.length > 0 ? this.resources.shift() : null;
  }

  addResources(resources: Resource[]) {
    this.resources.push(...resources);
  }
}
