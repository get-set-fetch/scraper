/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import { ConsoleMessage, HTTPResponse, WaitForOptions } from 'puppeteer';
import { PuppeteerClient } from '../../src/index';

export default class ConsolePuppeteerClient extends PuppeteerClient {
  consoleContent: string[][];

  async launch(): Promise<void> {
    await super.launch();

    const consoleHandler = (evt: ConsoleMessage) => {
      this.consoleContent.push([
        evt.type(),
        evt.text(),
      ]);
    };

    this.page.on('console', consoleHandler);
  }

  goto(url: string, opts: WaitForOptions): Promise<HTTPResponse> {
    this.consoleContent = [];
    return super.goto(url, opts);
  }
}
