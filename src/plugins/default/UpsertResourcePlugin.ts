/* eslint-disable no-param-reassign */
import Plugin from '../Plugin';
import Site from '../../storage/base/Site';
import Resource from '../../storage/base/Resource';

/**
 * Plugin responsible for updating a resource after scraping it.
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
    // scrape complete, save the scraped resource
    await this.saveResource(resource);

    /*
    if the resource was redirected
      - current resource has the final url
      - save the initial url under a new resource to avoid future redirects on the same url
    */
    await this.addRedirectOriginResource(site, resource.redirectOrigin);
  }

  async saveResource(resource: Resource) {
    // scrape complete, remove inProgress flag, set scrape date
    resource.scrapeInProgress = false;
    resource.scrapedAt = new Date(Date.now());

    // static resources have already been inserted in db via plugins like InsertResourcesPlugin in a previous scrape step, just do update
    if (resource.id) {
      await resource.update();
    }

    // dynamic resources are found and scraped on the fly starting from an already scraped static resource, do save
    else {
      await resource.save();
    }
  }

  async addRedirectOriginResource(site:Site, redirectOrigin:string) {
    if (!redirectOrigin) return;

    // check if origin resource already present
    const storedResource = await site.getResource(redirectOrigin);
    if (storedResource) return;

    const redirectOriginResource: Partial<Resource> = {
      url: redirectOrigin,
      scrapedAt: new Date(Date.now()),
    };

    await site.saveResources([ redirectOriginResource ]);
  }
}
