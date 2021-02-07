/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
import Plugin from '../Plugin';
import Project from '../../storage/base/Project';
import Resource from '../../storage/base/Resource';
import { SchemaType } from '../../schema/SchemaHelper';
import { getLogger } from '../../logger/Logger';

/** Updates a resource in the database after its scraping completes. */
export default class UpsertResourcePlugin extends Plugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Upsert Resource Plugin',
      description: 'updates a static resource or inserts a dynamic one after scraping it.',
      properties: {
        keepHtmlData: {
          type: 'boolean',
          default: false,
          title: 'Keep Html Data',
          description: 'Whether or not to save html buffer response (if present) under resource.data',
        },
      },
    } as const;
  }

  logger = getLogger('UpsertResourcePlugin');
  opts: SchemaType<typeof UpsertResourcePlugin.schema>;

  constructor(opts:SchemaType<typeof UpsertResourcePlugin.schema> = {}) {
    super(opts);
  }

  test(project: Project, resource: Resource) {
    return !!(resource);
  }

  async apply(project: Project, resource: Resource) {
    // scrape complete, save the scraped resource
    await this.saveResource(resource);

    /*
    update other impacted resources
    ex1:
      in case of browser redirect the resource initial url it's updated with the redirect location one
      a resource with redirect status and initial url needs to be added so we don't keep visiting it
    */
    const impactedResources = resource.resourcesToAdd ? resource.resourcesToAdd.filter(resource => resource.status) : [];
    for (let i = 0; i < impactedResources.length; i += 1) {
      this.logger.debug(impactedResources[i], 'save impacted resource');
      await this.saveResource(project.createResource(impactedResources[i]));
    }

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

    // only save html response under resource.data (Uint8Array) if the corresponding flag is set
    if (!this.opts.keepHtmlData && (/html/i).test(resource.contentType) && resource.data) {
      resource.data = null;
    }

    // static resources have already been inserted in db via plugins like InsertResourcesPlugin in a previous scrape step, just do update
    if (resource.id) {
      await resource.update();
    }

    /*
    do save when:
      dynamic resources are found and scraped on the fly starting from an already scraped static resource
      impacted resources (redirect related) need to be recorded
    */
    else {
      await resource.save();
    }
  }
}
