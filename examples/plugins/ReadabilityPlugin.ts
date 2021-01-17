import { Readability } from '@mozilla/readability';
import { Plugin, Project, Resource } from '../../src/index';

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
