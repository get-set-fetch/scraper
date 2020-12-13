import KnexStorage from '../../src/storage/knex/KnexStorage';
import integrationSuite from './integration-suite';

const storage = new KnexStorage({
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: ':memory:',
  },
  debug: false,
});

integrationSuite(storage);
