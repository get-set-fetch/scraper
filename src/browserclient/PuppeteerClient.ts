// @ts-expect-error importing peer dependency
// eslint-disable-next-line import/no-unresolved
import { Browser, LaunchOptions, launch as plaunch, Page, WaitForOptions, HTTPResponse, HTTPRequest, BrowserLaunchArgumentOptions, BrowserConnectOptions } from 'puppeteer';
import { getLogger } from '../logger/Logger';
import BrowserClient from './BrowserClient';

/** Puppeteer Client.  */
export default class PuppeteerClient extends BrowserClient {
  logger = getLogger('PuppeteerClient');

  browser: Browser;
  page: Page;
  opts: LaunchOptions;

  constructor(opts:LaunchOptions & BrowserLaunchArgumentOptions & BrowserConnectOptions = {}) {
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

  goto(url: string, opts: WaitForOptions):Promise<HTTPResponse> {
    return this.page.goto(url, opts);
  }

  async getRedirectResponse(req:HTTPRequest):Promise<HTTPResponse|null> {
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

  async evaluate(pageFunction, argObj?) {
    // if there's an error in the async fnc to be evaluated the page.evaluate return promise may never resolve
    // listen to page errors and reject accordingly
    return new Promise(async (resolve, reject) => {
      const logConsole = this.logger.logger.level === 'trace' || this.logger.logger.level === 'debug';
      const consoleHandler = msg => {
        for (let i = 0; i < msg.args().length; i += 1) {
          this.logger.debug(`DOM console: ${msg.args()[i]}`);
        }
      };

      if (logConsole) {
        this.page.on('console', consoleHandler);
      }

      const errorHandler = err => {
        this.logger.error(err);
        reject(err);
        this.page.off('pageerror', errorHandler);
        this.page.off('error', errorHandler);
        if (logConsole) {
          this.page.off('console', consoleHandler);
        }
      };
      this.page.on('pageerror', errorHandler);
      this.page.on('error', errorHandler);

      this.logger.trace({ pageFunction: pageFunction.toString(), argObj }, 'evaluate call');
      const result = await this.page.evaluate(pageFunction, argObj);
      resolve(result);
      this.page.off('pageerror', errorHandler);
      this.page.off('error', errorHandler);
      this.page.off('console', consoleHandler);
    });
  }
}
