import { SchemaType } from '../../schema/SchemaHelper';
import Plugin from '../Plugin';
import Site from '../../storage/base/Site';
import Resource from '../../storage/base/Resource';

type ContentType = {
  [key: string]: string[];
}

export default class ExtractHtmlContentPlugin extends Plugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Extract Html Content Plugin',
      description: 'Scrapes html content using CSS selectors.',
      properties: {
        domRead: {
          type: 'boolean',
          const: true,
          default: true,
        },
        selectorPairs: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
              },
              property: {
                type: 'string',
                default: 'innerText',
              },
            },
            required: [ 'selector' ],
          },
          description: 'CSS selectors to be applied. By default the innerText property will be scraped but you can define your own using a {selector, property} pair.',
        },
      },
      required: [ 'selectors' ],
    } as const;
  }

  opts: SchemaType<typeof ExtractHtmlContentPlugin.schema>;

  constructor(opts:SchemaType<typeof ExtractHtmlContentPlugin.schema> = {}) {
    super(opts);
  }

  test(site: Site, resource: Resource) {
    // only extract content of a currently crawled resource
    if (!resource || !resource.scrapeInProgress) return false;

    return (/html/i).test(resource.contentType);
  }

  apply() {
    const content = this.extractContent();
    const result = this.diffAndMergeResult({ content });
    return result;
  }

  extractContent() {
    let content: ContentType;

    // only makes sense for more than one selector and only if selectorBase returns multiple elements
    let selectorBase = null;
    if (this.opts.selectorPairs.length > 1) {
      const potentialSelectorBase = this.getSelectorBase(this.opts.selectorPairs);
      if (potentialSelectorBase && Array.from(document.querySelectorAll(potentialSelectorBase)).length > 1) {
        selectorBase = potentialSelectorBase;
      }
    }

    /*
    common base detected for all selectors, query selectors within base elements
    see https://github.com/get-set-fetch/extension/issues/44
    */
    if (selectorBase) {
      const suffixSelectors = this.opts.selectorPairs.map(selectorPair => selectorPair.selector.replace(selectorBase, '').trim());
      content = Array.from(document.querySelectorAll(selectorBase)).reduce<ContentType>(
        (result, baseElm) => {
          // scrape content for the current selectorBase "row"
          const suffixResult:ContentType = {};
          for (let i = 0; i < suffixSelectors.length; i += 1) {
            const { selector, property } = this.opts.selectorPairs[i];
            const suffixSelector = suffixSelectors[i];

            suffixResult[selector] = Array.from(baseElm.querySelectorAll(suffixSelector))
              .map(elm => this.getContent((elm as HTMLElement), property))
              .filter(val => val);
          }

          // scraped content row is valid, at least one column contains a non-empty scraped value
          const validScrapedRow = this.opts.selectorPairs.find(({ selector }) => {
            const rowEntry = suffixResult[selector];
            return rowEntry.length > 0;
          });

          // add scraped content row to agg result
          if (validScrapedRow) {
            for (let i = 0; i < this.opts.selectorPairs.length; i += 1) {
              const { selector } = this.opts.selectorPairs[i];

              // eslint-disable-next-line no-param-reassign
              if (!result[selector]) result[selector] = [];

              result[selector].push(suffixResult[selector].join(','));
            }
          }

          return result;
        },
        {},
      );
    }
    // no common base detected
    else {
      content = this.opts.selectorPairs.reduce<ContentType>(
        (result, selectorPair) => Object.assign(
          result,
          {
            [selectorPair.selector]: Array.from(
              document.querySelectorAll(selectorPair.selector),
            ).map(elm => this.getContent(elm as HTMLElement, selectorPair.property)),
          },
        ),
        {},
      );
    }

    /*
    selector array values should be grouped by common dom parent, but a versatile way to do it has yet to be implemented
    (lots of use cases to be covered)
    simple example:
        selectors: h1\nh2
        h1: a1, a2
        h2: b2
        dom:
          <div>
            <h1>a1</h1>
          </div>
          <div>
            <h1>a2</h1>
            <h2>b2</h2>
          </div>

    ideal result:
        h1: a1, a2
        h2: '', b2
    resulting in csv entries (further down the chain):
        a1, ''
        a2, b2

    current implementation result
        h1: a1, a2
        h2: b2,
    resulting in csv entries (further down the chain):
        a1, b2
        a2, ''
    */

    return content;
  }

  getSelectorBase(selectorPairs: SchemaType<typeof ExtractHtmlContentPlugin.schema>['selectorPairs']):string {
    const selectors = selectorPairs.map(selectorPair => selectorPair.selector);

    const cssFragments = selectors[0].split(' ');
    let selectorBase = null;
    for (let i = 0; i < cssFragments.length; i += 1) {
      const checkBase = cssFragments.slice(0, i + 1).join(' ');
      for (let j = 0; j < selectors.length; j += 1) {
        if (!selectors[j].startsWith(checkBase)) return selectorBase;
      }
      selectorBase = checkBase;
    }
    return selectorBase;
  }

  getContent(elm: HTMLElement, prop: string):string {
    return elm[prop] || elm.getAttribute(prop);
  }
}
