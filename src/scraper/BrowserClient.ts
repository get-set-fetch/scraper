import { Browser, LaunchOptions, launch as plaunch, Page, DirectNavigationOptions } from 'puppeteer';

export default class BrowserClient {
  browser: Browser;
  page: Page;

  async launch(opts:LaunchOptions = {}):Promise<void> {
    const defaultOpts:LaunchOptions = {
      headless: true,
    };
    const mergedOpts = Object.assign(defaultOpts, opts);

    this.browser = await plaunch(mergedOpts);
    // eslint-disable-next-line prefer-destructuring
    this.page = await this.browser.newPage();

    await this.page.setCacheEnabled(false);
  }

  close():Promise<void> {
    return this.browser.close();
  }

  goto(url: string, opts: DirectNavigationOptions) {
    return this.page.goto(url, opts);
  }

  evaluate(pageFunction, ...args):any {
    return this.page.evaluate(pageFunction, ...args);
  }
}
