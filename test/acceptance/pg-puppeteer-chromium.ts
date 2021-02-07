import acceptanceSuite from './acceptance-suite';
import Storage from '../../src/storage/base/Storage';
import KnexStorage from '../../src/storage/knex/KnexStorage';
import * as pgConn from '../config/storage/pg/pg-conn.json';
import * as puppeteerChromium from '../config/browserclient/puppeteer/puppeteer-chromium.json';
import PuppeteerClient from '../../src/browserclient/PuppeteerClient';

const storage:Storage = new KnexStorage(pgConn);
const browserClient = new PuppeteerClient(puppeteerChromium);
acceptanceSuite('browser-static-content', storage, browserClient);
