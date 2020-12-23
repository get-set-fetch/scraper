import { SchemaType } from '../../schema/SchemaHelper';
import Plugin from '../Plugin';
import Site from '../../storage/base/Site';
import Resource from '../../storage/base/Resource';

/**
 * Plugin responsible for extracting new resources from a resource document.
 */
export default class ExtractUrlsPlugin extends Plugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Extract Urls Plugin',
      description: 'Extracts new (html or binary) resource urls using CSS selectors.',
      properties: {
        selectorPairs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              urlSelector: {
                type: 'string',
              },
              titleSelector: {
                type: 'string',
              },
            },
            required: [ 'urlSelector' ],
          },
          default: [ { urlSelector: 'a[href$=".html"]' } ],
          description: 'CSS selectors to be applied. By defining an optional titleSelector, when exporting binary resources, the generated filename will be prefixed by the titleSelector value.',
        },
        maxDepth: {
          type: 'integer',
          default: -1,
          title: 'Max Depth',
          description: 'Maximum depth of resources to be scraped. The starting resource has depth 0. Resources discovered from it have depth 1 and so on. A value of -1 disables this check.',
        },
        domRead: {
          type: 'boolean',
          const: true,
          default: true,
        },
      },
    } as const;
  }

  opts: SchemaType<typeof ExtractUrlsPlugin.schema>;
  prevUrls: Set<string>; // in case of dynamic resource, urls already added

  constructor(opts: SchemaType<typeof ExtractUrlsPlugin.schema> = {}) {
    super(opts);
    this.prevUrls = new Set<string>();
  }

  test(site: Site, resource: Resource) {
    if (!resource) return false;

    // don't extract new resources from non-parsable pages
    const validMediaType = (/html/i).test(resource.contentType);
    if (!validMediaType) return false;

    // don't extract new resources if max depth has been reached
    const validMaxDepth = this.opts.maxDepth === -1 ? true : resource.depth < this.opts.maxDepth;
    if (!validMaxDepth) return false;

    return true;
  }

  apply(site: Site, resource: Resource) {
    const allResourcesToAdd: Partial<Resource>[] = this.extractResources(resource);
    const resourcesToAdd = this.diffAndMerge(allResourcesToAdd);

    return { resourcesToAdd };
  }

  extractResources(resource): Partial<Resource>[] {
    const currentUrl = new URL(resource.url);

    const resources = this.opts.selectorPairs.reduce(
      (resources, selectorPair) => {
        /*
        sometimes the link innerText or img alt text is not enough to uniquely differentiate between child urls..
        ex: extracting pdf files from a site where on each page is a link with "Export" text
        if we are to rename the pdf files based on link innerText, all pdf files will result in the name 'export.pdf'
        to avoid this, an extra, optional title selector is added
        is responsible for linking link(s) with some other elm innerText from the page, like, for ex, h2.page-title
        */
        const { urlSelector, titleSelector } = selectorPair;
        const selectorResources = this.extractSelectorResources(urlSelector, titleSelector);
        return resources.concat(selectorResources);
      },
      [],
    );

    resources.forEach(resource => {
      // construct resource full URL without #hhtml_fragment_identifiers
      const fullUrl = new URL(resource.url, currentUrl);
      fullUrl.hash = '';

      if (this.isValidResourceUrl(fullUrl)) {
        // eslint-disable-next-line no-param-reassign
        resource.url = fullUrl.toString();
      }
    });

    const uniqueResources = [];
    const uniqueUrls = [];
    resources.forEach(resource => {
      if (!uniqueUrls.includes(resource.url)) {
        uniqueResources.push(resource);
        uniqueUrls.push(resource.url);
      }
    });

    return uniqueResources;
  }

  extractSelectorResources(urlSelector: string, titleSelector: string): Partial<Resource>[] {
    const titles: string[] = titleSelector ? Array.from(document.querySelectorAll(titleSelector)).map((title:HTMLElement) => title.innerText.trim()) : [];
    const resources: Partial<Resource>[] = Array.from(document.querySelectorAll(urlSelector)).map((elm:any, idx) => {
      let resource: Partial<Resource> = null;
      if (elm.href) {
        resource = {
          url: elm.href,
          parent: {
            linkText: elm.innerText,
          },
        };
      }

      if (elm.src) {
        resource = {
          url: elm.src,
          parent: {
            imgAlt: elm.alt,
          },
        };
      }

      if (resource && titles.length > 0) {
        resource.parent.title = titles.length > idx ? titles[idx] : titles[titles.length - 1];
      }

      return resource;
    });

    return resources.filter(resource => resource !== null);
  }

  isValidResourceUrl(resourceUrl) {
    // check valid protocol
    if (resourceUrl.protocol.match(/^(http:|https:)$/) === null) {
      return false;
    }

    // check valid pathname
    if (resourceUrl.pathname === null) {
      return false;
    }

    return true;
  }

  diffAndMerge(resourcesToAdd: Partial<Resource>[]) {
    return resourcesToAdd.filter(resource => {
      if (!this.prevUrls.has(resource.url)) {
        this.prevUrls.add(resource.url);
        return true;
      }

      return false;
    });
  }
}
