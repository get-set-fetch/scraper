import { Browser, LaunchOptions, launch as plaunch, Page, DirectNavigationOptions } from 'puppeteer';
import BrowserClient from './BrowserClient';

export default class PuppeteerClient extends BrowserClient {
  browser: Browser;
  page: Page;
  opts: LaunchOptions;

  constructor(opts:LaunchOptions = {}) {
    super();
    const defaultOpts:LaunchOptions = {
      headless: true,
    };
    this.opts = Object.assign(defaultOpts, opts);
    this.isLaunched = false;
  }

  async launch():Promise<void> {
    this.browser = await plaunch(this.opts);
    // eslint-disable-next-line prefer-destructuring
    this.page = await this.browser.newPage();

    await this.page.setCacheEnabled(false);

    this.isLaunched = true;
  }

  async close():Promise<void> {
    await this.browser.close();
    this.isLaunched = false;
  }

  goto(url: string, opts: DirectNavigationOptions) {
    return this.page.goto(url, opts);
  }

  evaluate(pageFunction, ...args):any {
    return this.page.evaluate(pageFunction, ...args);
  }
}
