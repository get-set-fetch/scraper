/* eslint-disable no-await-in-loop */
import Plugin from '../Plugin';
import Project from '../../storage/base/Project';
import Resource from '../../storage/base/Resource';
import { SchemaType } from '../../schema/SchemaHelper';

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

  opts: SchemaType<typeof InsertResourcesPlugin.schema>;

  constructor(opts: SchemaType<typeof InsertResourcesPlugin.schema> = {}) {
    super(opts);
  }

  test(project: Project, resource: Resource) {
    if (!resource) return false;

    // only save new urls if there's something to save
    const newResourcesPresent = resource.resourcesToAdd && resource.resourcesToAdd.length > 0;
    if (!newResourcesPresent) return false;

    return true;
  }

  async apply(project: Project, resource: Resource) {
    const { resourcesToAdd } = resource;

    let resourcesNotInStorage:Partial<Resource>[] = [];

    for (let i = 0; i < resourcesToAdd.length; i += 1) {
      const resourceInStorage = await project.getResource(resourcesToAdd[i].url);
      if (!resourceInStorage) {
        resourcesNotInStorage.push(Object.assign(resourcesToAdd[i], { depth: resource.depth + 1 }));
      }
    }

    // don't add more resources than maxResources threshold
    if (this.opts.maxResources > 0) {
      const resourceCount = await project.countResources();
      const maxResourcesToAdd = Math.max(0, this.opts.maxResources - resourceCount);

      if (maxResourcesToAdd === 0) {
        resourcesNotInStorage = [];
      }
      else {
        resourcesNotInStorage = resourcesNotInStorage.slice(0, Math.min(maxResourcesToAdd, resourcesNotInStorage.length));
      }
    }

    await project.saveResources(resourcesNotInStorage);
  }
}
