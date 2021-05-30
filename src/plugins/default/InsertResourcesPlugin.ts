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
    return resource.resourcesToAdd && resource.resourcesToAdd.length > 0;
  }

  async apply(project: Project, resource: Resource) {
    const { resourcesToAdd } = resource;

    /*
    in case of browser redirect the resource initial url it's updated with the redirect location one
    a resource with redirect status and initial url needs to be added so we don't keep visiting it
    always save all redirect resources, regardless of opts.maxResources
    */
    const redirectResources:Partial<Resource>[] = resourcesToAdd
      .filter(resource => resource.status)
      .map(resource => ({ ...resource, scrapedAt: new Date(Date.now()) }));
    if (redirectResources.length > 0) {
      await project.saveResources(redirectResources);
    }

    // normal, newly discovered resources
    const newResources = resourcesToAdd.filter(resource => !resource.status);

    let newResourcesNotInStorage:Partial<Resource>[] = [];

    for (let i = 0; i < newResources.length; i += 1) {
      const resourceInStorage = await project.getResource(newResources[i].url);
      if (!resourceInStorage) {
        newResourcesNotInStorage.push(Object.assign(newResources[i], { depth: resource.depth + 1 }));
      }
    }

    // don't add more resources than maxResources threshold
    if (this.opts.maxResources > 0) {
      const resourceCount = await project.countResources();
      const maxResourcesToAdd = Math.max(0, this.opts.maxResources - resourceCount);

      if (maxResourcesToAdd === 0) {
        newResourcesNotInStorage = [];
      }
      else {
        newResourcesNotInStorage = newResourcesNotInStorage.slice(0, Math.min(maxResourcesToAdd, newResourcesNotInStorage.length));
      }
    }

    await project.saveResources(newResourcesNotInStorage);

    return { resourcesToAdd: null };
  }
}
