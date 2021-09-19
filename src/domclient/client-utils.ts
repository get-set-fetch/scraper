import { PlaywrightClient, PuppeteerClient, CheerioClient, JsdomClient, BrowserClient,
  IDomClientConstructor } from '../index';
import { ClientOptions } from '../scraper/Scraper';

export default function initClient(clientOpts:ClientOptions):BrowserClient|IDomClientConstructor {
  if (!clientOpts) throw new Error('missing DOM options');
  if (!clientOpts.name) throw new Error('missing DOM client');

  let client;
  switch (clientOpts.name) {
    case 'cheerio':
      if (!CheerioClient) throw new Error('cheerio package not installed');
      client = CheerioClient;
      break;
    case 'jsdom':
      if (!JsdomClient) throw new Error('jsdom package not installed');
      client = JsdomClient;
      break;
    case 'puppeteer':
      if (!PuppeteerClient) throw new Error('puppeteer package not installed');
      client = new PuppeteerClient(clientOpts.opts);
      break;
    case 'playwright':
      if (!PlaywrightClient) throw new Error('playwright-core package not installed');
      client = new PlaywrightClient(clientOpts.opts);
      break;
    default:
      throw new Error(`invalid client ${clientOpts.name}`);
  }

  return client;
}
