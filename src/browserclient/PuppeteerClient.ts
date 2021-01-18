import { Browser, LaunchOptions, launch as plaunch, Page, DirectNavigationOptions } from 'puppeteer';
import BrowserClient from './BrowserClient';

/** Puppeteer Client.  */
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
    this.page = await this.browser.newPage();

    this.isLaunched = true;
  }

  async close():Promise<void> {
    this.page = null;
    await this.browser.close();
    this.isLaunched = false;
  }

  async goto(url: string, opts: DirectNavigationOptions) {
    return this.page.goto(url, opts);
  }

  getUrl() {
    return this.page.url();
  }

  async closePage() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
  }

  evaluate(pageFunction, ...args):any {
    return this.page.evaluate(pageFunction, ...args);
  }
}
