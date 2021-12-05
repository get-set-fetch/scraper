/* eslint-disable no-param-reassign */
/* eslint-disable no-await-in-loop */
import Plugin from '../Plugin';
import Project from '../../storage/base/Project';
import Resource from '../../storage/base/Resource';
import { SchemaType } from '../../schema/SchemaHelper';
import { getLogger } from '../../logger/Logger';

/** Saves in database newly identified resources within the current project. */
export default class InsertResourcesPlugin extends Plugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Insert Resources Plugin',
      description: 'saves new resources within the current project based on newly identified urls.',
      properties: {
        maxResources: {
          type: 'integer',
          default: -1,
          title: 'Max Resources',
          description: 'Maximum number of resources to be saved and scraped. A value of -1 disables this check.',
        },
      },
    } as const;
  }

  logger = getLogger('InsertResourcesPlugin');

  opts: SchemaType<typeof InsertResourcesPlugin.schema>;

  constructor(opts: SchemaType<typeof InsertResourcesPlugin.schema> = {}) {
    super(opts);
  }

  test(project: Project, resource: Resource) {
    if (!resource) return false;

    // only save new urls if there's something to save
    return resource.resourcesToAdd && resource.resourcesToAdd.length > 0;
  }

  /**
   * Uses project.queue to INSERT to-be-scraped resources with IGNORE on 'url' CONFLICT.
   */
  async apply(project: Project, resource: Resource) {
    const { resourcesToAdd } = resource;

    this.logger.debug(resourcesToAdd, 'adding newly discovered resources');

    // each 'child' resource has an increased 'depth' relative to its parent
    resourcesToAdd.forEach(resourceToAdd => {
      resourceToAdd.depth = resource.depth + 1;
    });

    // a threshold is defined, take it into account
    if (this.opts.maxResources > 0) {
      const resourceCount = await project.queue.count();
      const maxResourcesToAdd = Math.max(0, this.opts.maxResources - resourceCount);

      // add resources below the threshold
      if (maxResourcesToAdd > 0) {
        // inserting all resources doesn't exceed the threshold
        if (maxResourcesToAdd >= resourcesToAdd.length) {
          await project.queue.add(resourcesToAdd);
        }
        // inserting all resources exceeds the threshold, only insert a subset
        else {
          const toCheckUrls = resourcesToAdd.map(resourceToAdd => resourceToAdd.url);
          const newUrls = await project.queue.filterNewUrls(toCheckUrls);
          let newResourcesNotInStorage = resourcesToAdd.filter(resourceToAdd => newUrls.includes(resourceToAdd.url));

          if (newResourcesNotInStorage.length > 0) {
            newResourcesNotInStorage = newResourcesNotInStorage.slice(0, Math.min(maxResourcesToAdd, newResourcesNotInStorage.length));
          }
          await project.queue.add(newResourcesNotInStorage);
        }
      }
    }
    // no threshold, insert all resources
    else {
      await project.queue.add(resourcesToAdd);
    }

    return { resourcesToAdd: null };
  }
}
