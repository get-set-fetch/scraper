import { SchemaType } from '../../schema/SchemaHelper';
import Plugin from '../Plugin';
import Site from '../../storage/base/Site';
import Resource from '../../storage/base/Resource';

/**
 * Plugin responsible for selecting a resource to crawl from the current site.
 */
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

  // only retrieve a new resource when one hasn't already been selected
  test(site: Site, resource: Resource) {
    return resource === null;
  }

  async apply(site: Site, resource: Resource):Promise<Resource> {
    await new Promise(resolve => setTimeout(resolve, this.opts.delay));
    return site.getResourceToCrawl();
  }
}
