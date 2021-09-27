import { ExtractUrlsPlugin, PluginOpts } from '../../src/index';

export default class ExtractSameHostUrlsPlugin extends ExtractUrlsPlugin {
  constructor(opts:Partial<PluginOpts> = {}) {
    super(opts);

    /* parent plugin runs in browser by default, the current one doesn't */
    this.opts.domRead = false;
  }

  /* only extract URLs from the sitemap domain */
  isValidUrl(url: URL) {
    return url.hostname === 'www.getsetfetch.org';
  }
}
