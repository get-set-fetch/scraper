import acceptanceSuite from './acceptance-suite';
import Connection from '../../src/storage/base/Connection';
import KnexConnection from '../../src/storage/knex/KnexConnection';
import * as sqliteConn from '../config/storage/sqlite/sqlite-conn.json';
import * as mysqlConn from '../config/storage/mysql/mysql-conn.json';
import * as pgConn from '../config/storage/pg/pg-conn.json';
import CheerioClient from '../../src/domclient/CheerioClient';
import { ConcurrencyOptions } from '../../src/scraper/ConcurrencyManager';
import { PluginOpts } from '../../src';

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

const pluginOptions: PluginOpts[][] = [
  [
    {
      name: 'NodeFetchPlugin',
      headers: {
        'Accept-Encoding': 'br,gzip,deflate',
      },
    },
  ],
  [
    {
      name: 'NodeFetchPlugin',
      headers: {
        'Accept-Encoding': 'identity',
      },
    },
  ],
];

for (let i = 0; i < conn.length; i += 1) {
  for (let j = 0; j < concurrencyOptions.length; j += 1) {
    /*
    only when using cheerio
    for parallel scraping, fetch resources both compressed and uncompressed
    sequential scraping will fetch using default headers (accepting gzip) like the other acceptance suites
    */
    const nodeScrapeWithCustomHeaders = concurrencyOptions[j].proxy && concurrencyOptions[j].proxy.maxRequests > 1;

    if (nodeScrapeWithCustomHeaders) {
      for (let k = 0; k < pluginOptions.length; k += 1) {
        acceptanceSuite(
          'dom-static-content',
          conn[i],
          CheerioClient,
          concurrencyOptions[j],
          pluginOptions[k],
        );
      }
    }
    else {
      acceptanceSuite(
        'dom-static-content',
        conn[i],
        CheerioClient,
        concurrencyOptions[j],
      );
    }
  }
}
