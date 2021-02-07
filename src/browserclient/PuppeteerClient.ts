import { Browser, LaunchOptions, launch as plaunch, Page, DirectNavigationOptions, Response, Request } from 'puppeteer';
import { getLogger } from '../logger/Logger';
import BrowserClient from './BrowserClient';

/** Puppeteer Client.  */
export default class PuppeteerClient extends BrowserClient {
  logger = getLogger('PuppeteerClient');

  browser: Browser;
  page: Page;
  opts: LaunchOptions;

  constructor(opts:LaunchOptions = {}) {
    super({ headlesss: true, ...opts });
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

  goto(url: string, opts: DirectNavigationOptions):Promise<Response> {
    return this.page.goto(url, opts);
  }

  async getRedirectResponse(req:Request):Promise<Response|null> {
    const redirectChain = req.redirectChain();
    return redirectChain.length > 0 ? redirectChain[0].response() : null;
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

  evaluate(pageFunction, argObj?) {
    this.logger.trace({ pageFunction: pageFunction.toString(), argObj }, 'evaluate call');
    return this.page.evaluate(pageFunction, argObj);
  }
}
