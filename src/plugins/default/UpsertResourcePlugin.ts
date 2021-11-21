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

  constructor(opts: SchemaType<typeof UpsertResourcePlugin.schema> = {}) {
    super(opts);
  }

  test(project: Project, resource: Resource) {
    return !!(resource);
  }

  async apply(project: Project, resource: Resource) {
    // guard against incomplete resources not capable of updating the scrape queue
    if (!resource.status || !resource.queueEntryId) {
      throw new Error('incomplete resource');
    }

    /*
    scrape complete, update queue entry, save scraped resource
    a resource generated from dynamic actions doesn't update the corresponding queue entry, it has already been updated by the `parent` static resource

    at some point, treat differently:
    - scraped in error resources: don't add them to the resource table as they don't contain succesfull scraped content
    */
    if (!resource.actions) {
      await Promise.all([
        this.saveResource(resource),
        project.queue.updateStatus(resource.queueEntryId, resource.status),
      ]);
    }
    else {
      await this.saveResource(resource);
    }

    /*
    after a resource is updated, remove its dynamic actions
    this allows for other dynamic plugins to be triggered
    */
    return { actions: null };
  }

  async saveResource(resource: Resource) {
    // scrape complete, remove inProgress flag, set scrape date
    resource.scrapedAt = new Date(Date.now());

    // only save html response under resource.data (Uint8Array) if the corresponding flag is set
    if (!this.opts.keepHtmlData && (/html/i).test(resource.contentType) && resource.data) {
      resource.data = null;
    }

    await resource.save();
  }
}
