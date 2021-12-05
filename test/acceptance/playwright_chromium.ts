import acceptanceSuite from './acceptance-suite';
import Connection from '../../src/storage/base/Connection';
import KnexConnection from '../../src/storage/knex/KnexConnection';
import * as sqliteConn from '../config/storage/sqlite/sqlite-conn.json';
import * as mysqlConn from '../config/storage/mysql/mysql-conn.json';
import * as pgConn from '../config/storage/pg/pg-conn.json';
import * as playwrightChromium from '../config/browserclient/playwright/playwright-chromium.json';
import PlaywrightClient from '../../src/browserclient/PlaywrightClient';
import { ConcurrencyOptions } from '../../src/scraper/ConcurrencyManager';

const browserClient = new PlaywrightClient(playwrightChromium);

const conn:Connection[] = [
  new KnexConnection(sqliteConn),
  new KnexConnection(mysqlConn),
  new KnexConnection(pgConn),
];

const concurrencyOptions:ConcurrencyOptions[] = [
  {
    proxyPool: [ {
      host: '127.0.0.1',
      port: 8080,
    } ],
  },
  {
    proxy: {
      maxRequests: 10,
      delay: 100,
    },
    domain: {
      maxRequests: 10,
      delay: 100,
    },
    proxyPool: [ {
      host: '127.0.0.1',
      port: 8080,
    } ],
  },
];

for (let i = 0; i < conn.length; i += 1) {
  for (let j = 0; j < concurrencyOptions.length; j += 1) {
    acceptanceSuite(
      'browser-static-content',
      conn[i],
      browserClient,
      concurrencyOptions[j],
    );
  }
}
