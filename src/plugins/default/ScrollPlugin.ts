import { SchemaType } from '../../schema/SchemaHelper';
import Plugin from '../Plugin';
import Project from '../../storage/base/Project';
import Resource from '../../storage/base/Resource';
import { DomStabilityStatus, waitForDomStability } from '../dom-utils';

/** Provides infinite scrolling. Runs in browser. */
export default class ScrollPlugin extends Plugin {
  static get schema() {
    return {
      type: 'object',
      title: 'Scroll Plugin',
      description: 'performs infinite scrolling in order to load additional content.',
      properties: {
        domRead: {
          type: 'boolean',
          const: true,
          default: true,
        },
        domWrite: {
          type: 'boolean',
          const: true,
          default: true,
        },
        delay: {
          type: 'integer',
          default: '1000',
          description: 'delay (milliseconds) between performing two consecutive scroll operations.',
        },
        maxActions: {
          type: 'integer',
          default: '-1',
          title: 'Max Actions',
          description: 'number of maximum scroll actions. A value of -1 scrolls till no new content is added to the page.',
        },
        stabilityCheck: {
          type: 'integer',
          default: 1000,
          title: 'Stability Check',
          description: 'Considers the page loaded and ready to be scraped when there are no more DOM changes within the specified amount of time (milliseconds). Only applies to html resources. Useful for bypassing preloader content.',
        },
        stabilityTimeout: {
          type: 'integer',
          default: 3000,
          title: 'Max Stability Waiting Time',
          description: 'Maximum waiting time (miliseconds) for achieving DOM stability in case of a continuously updated DOM (ex: timers, countdowns).',
        },
      },
    } as const;
  }

  opts: SchemaType<typeof ScrollPlugin.schema>;
  actionNo: number;

  constructor(opts: SchemaType<typeof ScrollPlugin.schema> = {}) {
    super(opts);
    this.actionNo = 0;
  }

  test(project: Project, resource: Resource) {
    if (!resource) return false;

    // don't attempt to scroll non-html resources
    const validContentType = (/html/i).test(resource.contentType);
    if (!validContentType) return false;

    // if a dynamic action was already performed against the resource, don't perform another one
    if (resource.actions) return false;

    // don't exceed max allowed scroll actions
    const scrollExceeded = this.opts.maxActions >= 0 ? this.actionNo >= this.opts.maxActions : false;
    if (scrollExceeded) return false;

    return true;
  }

  async apply():Promise<Partial<Resource>> {
    await new Promise(resolve => setTimeout(resolve, this.opts.delay));

    // start listening to DOM changes
    const stabilityStatusPromise = waitForDomStability({ stabilityCheck: this.opts.stabilityCheck, stabilityTimeout: this.opts.stabilityTimeout });

    // actual scrolling action
    window.scrollTo(0, document.body.scrollHeight);
    this.actionNo += 1;

    const stabilityStatus: DomStabilityStatus = await stabilityStatusPromise;
    switch (stabilityStatus) {
      // dom changed and now stable
      case DomStabilityStatus.Stable:
        return { actions: [ `scroll#${this.actionNo}` ] };
      // dom unchanged, nothing more to scroll
      case DomStabilityStatus.Unchanged:
        return null;
      // dom changed but not stable
      default:
        throw new Error(`DOM not stable after stabilityTimeout of ${this.opts.stabilityTimeout}`);
    }
  }
}
