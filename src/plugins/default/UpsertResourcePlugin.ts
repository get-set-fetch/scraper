/* eslint-disable no-param-reassign */
import Plugin from '../Plugin';
import Site from '../../storage/base/Site';
import Resource from '../../storage/base/Resource';

/**
 * Plugin responsible for updating a resource after crawling it.
 */
export default class UpsertResourcePlugin extends Plugin {
  static get schema() {
    return {
      title: 'Upsert Resource Plugin',
      description: 'updates a static resource or inserts a dynamic one after scraping it.',
    };
  }

  test(site: Site, resource: Resource) {
    // only update a currently crawled resource
    return !!(resource && resource.scrapeInProgress === true);
  }

  async apply(site: Site, resource: Resource) {
    // scrape complete, remove inProgress flag, set scrape date
    resource.scrapeInProgress = false;
    resource.scrapedAt = new Date(Date.now());

    // static resources have already been inserted in db via plugins like InsertResourcesPlugin in a previous scrape step, just do update
    if (resource.id) {
      await resource.update();
    }

    // dynamic resources are found and scrapped on the fly starting from an already scrapped static resource, do save
    else {
      await resource.save();
    }
  }
}
