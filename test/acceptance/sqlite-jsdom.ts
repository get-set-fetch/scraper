import acceptanceSuite from './acceptance-suite';
import Storage from '../../src/storage/base/Storage';
import KnexStorage from '../../src/storage/knex/KnexStorage';
import * as sqliteConn from '../config/storage/sqlite/sqlite-conn.json';
import JsdomClient from '../../src/domclient/JsdomClient';

const storage:Storage = new KnexStorage(sqliteConn);
acceptanceSuite('dom-static-content', storage, JsdomClient);
