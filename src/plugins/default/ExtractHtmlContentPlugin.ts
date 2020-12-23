import { SchemaType } from '../../schema/SchemaHelper';
import Plugin from '../Plugin';
import Site from '../../storage/base/Site';
import Resource from '../../storage/base/Resource';

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
  content: Set<string>; // in case of dynamic resource, content already scraped

  constructor(opts:SchemaType<typeof ExtractHtmlContentPlugin.schema> = {}) {
    super(opts);

    this.content = new Set<string>();
  }

  test(site: Site, resource: Resource) {
    if (!resource) return false;

    return (/html/i).test(resource.contentType);
  }

  apply() {
    const currentContent = this.extractContent();
    const content = this.diffAndMerge(currentContent);
    return { content };
  }

  extractContent():string[][] {
    let content: string[][];

    // only makes sense for more than one selector and only if selectorBase returns valid elements
    let selectorBase = null;
    if (this.opts.selectorPairs.length > 1) {
      const potentialSelectorBase = this.getSelectorBase(this.opts.selectorPairs);
      if (potentialSelectorBase && Array.from(document.querySelectorAll(potentialSelectorBase)).length > 0) {
        selectorBase = potentialSelectorBase;
      }
    }

    /*
    common base detected for all selectors, query selectors within base elements
    see https://github.com/get-set-fetch/extension/issues/44
    */
    if (selectorBase) {
      const suffixSelectors = this.opts.selectorPairs.map(selectorPair => selectorPair.selector.replace(selectorBase, '').trim());
      content = Array.from(document.querySelectorAll(selectorBase))
        // scrape content for the current selectorBase "row"
        .map((baseElm: HTMLElement) => {
          const suffixRowResult:string[] = [];
          for (let i = 0; i < suffixSelectors.length; i += 1) {
            const suffixSelector = suffixSelectors[i];
            const { property } = this.opts.selectorPairs[i];

            suffixRowResult.push(
              Array.from(baseElm.querySelectorAll(suffixSelector))
                .map(elm => this.getContent((elm as HTMLElement), property))
                .filter(val => val)
                .join(','),
            );
          }

          // scraped content row is valid, at least one column contains a non-empty scraped value
          const validRowResult = suffixRowResult.find(colEntry => colEntry.length > 0);

          // add scraped content row to agg result
          if (validRowResult) {
            return suffixRowResult;
          }

          return null;
        })
        // filter out rows containing no content
        .filter(row => row);
    }
    // no common base detected
    else {
      const contentBySelector: string[][] = this.opts.selectorPairs.map(
        selectorPair => Array
          .from(document.querySelectorAll(selectorPair.selector))
          .map(elm => this.getContent(elm as HTMLElement, selectorPair.property)),
      );

      // make all selector results of equal length
      const maxLength = Math.max(...contentBySelector.map(result => result.length));
      for (let i = 0; i < contentBySelector.length; i += 1) {
        const selectorContent = contentBySelector[i];
        if (selectorContent.length < maxLength) {
          const lastVal = selectorContent.length > 0 ? selectorContent[selectorContent.length - 1] : '';
          selectorContent.splice(selectorContent.length, 0, ...Array(maxLength - selectorContent.length).fill(0).map(() => lastVal));
          contentBySelector[i] = selectorContent;
        }
      }

      // transform contentBySelector(each row contains one querySelector result) into content (each row contains one element from each querySelector result)
      content = Array(maxLength).fill(0).map((val, idx) => {
        const rowContent: string[] = [];
        for (let i = 0; i < contentBySelector.length; i += 1) {
          rowContent.push(contentBySelector[i][idx]);
        }
        return rowContent;
      });
    }

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
    return elm[prop] !== undefined ? elm[prop] : elm.getAttribute(prop);
  }

  getContentKeys() {
    return this.opts.selectorPairs.map(selectorPair => selectorPair.label || selectorPair.selector);
  }

  diffAndMerge(currentContent: string[][]) {
    return currentContent.filter(contentRow => {
      const joinedContent = contentRow.join(',');
      if (!this.content.has(joinedContent)) {
        this.content.add(joinedContent);
        return true;
      }

      return false;
    });
  }
}
