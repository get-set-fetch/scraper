import { SchemaType } from '../../schema/SchemaHelper';
import Plugin from '../Plugin';
import Project from '../../storage/base/Project';
import Resource from '../../storage/base/Resource';

/** Selects from database a new project resource to be scraped. */
export default class SelectResourcePlugin extends Plugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Select Resource Plugin',
      description: 'selects a resource to scrape from the current project.',
      properties: {
        frequency: {
          type: 'integer',
          const: -1,
          default: -1,
          description: 'How often a resource should be re-crawled (hours), enter -1 to never re-crawl.',
        },
        delay: {
          type: 'integer',
          default: 1000,
          description: 'Delay in milliseconds between fetching two consecutive resources.',
        },
      },
    } as const;
  }

  opts: SchemaType<typeof SelectResourcePlugin.schema>;

  constructor(opts:SchemaType<typeof SelectResourcePlugin.schema> = {}) {
    super(opts);
  }

  /** Only retrieve a new resource when one hasn't already been selected. */
  test(project: Project, resource: Resource) {
    return resource === null;
  }

  async apply(project: Project, resource: Resource):Promise<Resource> {
    await new Promise(resolve => setTimeout(resolve, this.opts.delay));
    return project.getResourceToScrape();
  }
}
