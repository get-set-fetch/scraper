import acceptanceSuite from './acceptance-suite';
import Storage from '../../src/storage/base/Storage';
import KnexStorage from '../../src/storage/knex/KnexStorage';
import * as sqliteConn from '../config/storage/sqlite/sqlite-conn.json';
import CheerioClient from '../../src/domclient/CheerioClient';

const storage:Storage = new KnexStorage(sqliteConn);
acceptanceSuite(
  'dom-static-content',
  storage,
  CheerioClient,
  [
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
  ],
);
