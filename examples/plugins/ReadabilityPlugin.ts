import { Readability } from '@mozilla/readability';
import { Plugin, Project, Resource } from '../../src/index';

/**
 * IMPORTANT NOTE !!!
 * if you're using plain javascript besides removing Project and Resource types, don't extend the abstract Plugin class
 * @rollup/plugin-commonjs will bundle the entire @get-set-fetch/scraper project including fs, jszip, ... imports
 * it will fail
 */
export default class ReadabilityPlugin extends Plugin {
  opts = {
    domRead: true,
  }

  test(project:Project, resource:Resource) {
    if (!resource) return false;
    return (/html/i).test(resource.contentType);
  }

  apply() {
    const article = new Readability(document).parse();
    return { content: [ [ article.excerpt ] ] };
  }
}
