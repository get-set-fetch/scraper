import Storage from '../../../src/storage/base/Storage';
import KnexStorage from '../../../src/storage/knex/KnexStorage';
import integrationSuite from '../../integration/integration-suite';
import * as conn from './pg-conn.json';

const storage:Storage = new KnexStorage(conn);
integrationSuite(storage);
