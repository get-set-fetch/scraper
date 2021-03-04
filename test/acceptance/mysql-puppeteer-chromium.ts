import acceptanceSuite from './acceptance-suite';
import Storage from '../../src/storage/base/Storage';
import KnexStorage from '../../src/storage/knex/KnexStorage';
import * as mysqlConn from '../config/storage/mysql/mysql-conn.json';
import * as puppeteerChromium from '../config/browserclient/puppeteer/puppeteer-chromium.json';
import PuppeteerClient from '../../src/browserclient/PuppeteerClient';

const storage:Storage = new KnexStorage(mysqlConn);
const browserClient = new PuppeteerClient(puppeteerChromium);
acceptanceSuite(
  'browser-static-content',
  storage,
  browserClient,
  [
    {
      proxyPool: [ {
        host: '127.0.0.1',
        port: 8080,
      } ],
    },
  ],
);
