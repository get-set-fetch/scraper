/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import { BrowserFetchPlugin, Resource } from '../../src/index';
import ConsolePuppeteerClient from './ConsolePuppeteerClient';

export default class ConsoleBrowserFetchPlugin extends BrowserFetchPlugin {
  getContentKeys() {
    return [ 'type', 'text' ];
  }

  async openInTab(resource: Resource, client: ConsolePuppeteerClient): Promise<Partial<Resource>> {
    const result: Partial<Resource> = await super.openInTab(resource, client);
    result.content = client.consoleContent;
    return result;
  }
}
