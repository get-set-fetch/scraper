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
    this.page = await this.browser.newPage(); // (await this.browser.pages())[0];

    await this.page.setCacheEnabled(false);

    /*
    this.page
      .on('console', message => console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
      .on('pageerror', ({ message }) => console.log(message))
      .on('response', async response => console.log(`${response.status()} ${response.url()}`))
      .on('response', async response => console.log(`${response.status()} ${response.url()} ${(await response.buffer()).toString()}`))
      .on('requestfinished', response => console.log('requestfinished'))
      .on('requestfailed', request => console.log(`${request.failure().errorText} ${request.url()}`));
      */
  }

  close():Promise<void> {
    return this.browser.close();
  }

  goto(url: string, opts: DirectNavigationOptions) {
    return this.page.goto(url, opts);
  }

  /*
  evaluate<T extends EvaluateFn<A>>(
    pageFunction: T,
    ...args: SerializableOrJSHandle[]
  ): Promise<EvaluateFnReturnType<T> extends PromiseLike<infer U> ? U : EvaluateFnReturnType<T>> {
    return this.page.evaluate(pageFunction, ...args);
  }
  */

  evaluate(pageFunction, ...args):any {
    return this.page.evaluate(pageFunction, ...args);
  }
}
