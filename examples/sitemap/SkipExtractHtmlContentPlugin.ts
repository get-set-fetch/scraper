import { Plugin } from '../../src/index';

/**
 * IMPORTANT NOTE !
 * if you're using plain javascript besides removing Project and Resource types, don't extend the abstract Plugin class
 * @rollup/plugin-commonjs will bundle the entire @get-set-fetch/scraper project including fs, jszip, ... imports
 */
export default class SkipExtractHtmlContentPlugin extends Plugin {
  /*
 never invoke the plugin, it's just an empty placeholder for ExtractHtmlContentPlugin
 since we're not interested in scraping content
 */
  test() {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  apply() {}
}
