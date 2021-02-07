import { BrowserType, Browser, LaunchOptions, Page, ChromiumBrowser, Response, FirefoxBrowser, WebKitBrowser, chromium, firefox, webkit, Request } from 'playwright-core';
import { getLogger } from '../logger/Logger';
import BrowserClient from './BrowserClient';

type ArgumentsType<T> = T extends (...args: infer U) => any ? U : never;
type DirectNavigationOptions = ArgumentsType<Page['goto']>[1];

type ExtendedLaunchOptions = LaunchOptions & {
  browser: string;
}

/** Playwright Client.  */
export default class PlaywrightClient extends BrowserClient {
  logger = getLogger('PlaywrightClient');

  browserType: BrowserType<WebKitBrowser> | BrowserType<ChromiumBrowser> | BrowserType<FirefoxBrowser>;
  browser: Browser;
  page: Page;
  opts: LaunchOptions;

  constructor(opts:Partial<ExtendedLaunchOptions> = {}) {
    super({ headlesss: true, ...opts });

    this.browserType = this.getBrowserType(opts.browser);
  }

  getBrowserType(browser:string): BrowserType<WebKitBrowser> | BrowserType<ChromiumBrowser> | BrowserType<FirefoxBrowser> {
    switch (browser) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      default:
        return chromium;
    }
  }

  /*
  playwright does not yet implement downloadBrowserIfNeeded
  https://github.com/microsoft/playwright/issues/823

  async download() {
    // browser present, no download required
    if (existsSync(this.browserType.executablePath())) return;

    console.log(`Downloading ${this.browserType.name()}`);
    await this.browserType.downloadBrowserIfNeeded();
  }
  */

  async launch():Promise<void> {
    this.browser = await this.browserType.launch(this.opts);
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
    let redirectReq:Request = req.redirectedFrom();
    while (redirectReq && redirectReq.redirectedFrom()) {
      redirectReq = redirectReq.redirectedFrom();
    }
    return redirectReq ? redirectReq.response() : null;
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
