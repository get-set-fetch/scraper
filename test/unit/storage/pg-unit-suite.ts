import unitSuite from './unit-suite';
import * as connConfig from '../../config/storage/pg/pg-conn.json';
import Connection from '../../../src/storage/base/Connection';
import KnexConnection from '../../../src/storage/knex/KnexConnection';

const conn:Connection = new KnexConnection(connConfig);
unitSuite(conn);
