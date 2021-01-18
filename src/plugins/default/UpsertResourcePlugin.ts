/* eslint-disable no-param-reassign */
import Plugin from '../Plugin';
import Project from '../../storage/base/Project';
import Resource from '../../storage/base/Resource';

/** Updates a resource in the database after its scraping completes. */
export default class UpsertResourcePlugin extends Plugin {
  static get schema() {
    return {
      title: 'Upsert Resource Plugin',
      description: 'updates a static resource or inserts a dynamic one after scraping it.',
    };
  }

  test(project: Project, resource: Resource) {
    return !!(resource);
  }

  async apply(project: Project, resource: Resource) {
    // scrape complete, save the scraped resource
    await this.saveResource(resource);

    /*
    if the resource was redirected
      - current resource has the final url
      - save the initial url under a new resource to avoid future redirects on the same url
    */
    await this.addRedirectOriginResource(project, resource.redirectOrigin);

    /*
    after a resource is updated, remove its dynamic actions
    this allows for other dynamic plugins to be triggered
    */
    return { actions: null };
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

  async addRedirectOriginResource(project:Project, redirectOrigin:string) {
    if (!redirectOrigin) return;

    // check if origin resource already present
    const storedResource = await project.getResource(redirectOrigin);
    if (storedResource) return;

    const redirectOriginResource: Partial<Resource> = {
      url: redirectOrigin,
      scrapedAt: new Date(Date.now()),
    };

    await project.saveResources([ redirectOriginResource ]);
  }
}
