import Storage from '../../../src/storage/base/Storage';
import KnexStorage from '../../../src/storage/knex/KnexStorage';
import unitSuite from './unit-suite';
import * as conn from '../../config/storage/pg/pg-conn.json';

const storage:Storage = new KnexStorage(conn);
unitSuite(storage);
