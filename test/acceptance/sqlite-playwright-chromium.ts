import acceptanceSuite from './acceptance-suite';
import Storage from '../../src/storage/base/Storage';
import KnexStorage from '../../src/storage/knex/KnexStorage';
import * as sqliteConn from '../config/storage/sqlite/sqlite-conn.json';
import * as playwrightChromium from '../config/browserclient/playwright/playwright-chromium.json';
import PlaywrightClient from '../../src/browserclient/PlaywrightClient';

const storage:Storage = new KnexStorage(sqliteConn);
const browserClient = new PlaywrightClient(playwrightChromium);
acceptanceSuite('browser-static-content', storage, browserClient);
