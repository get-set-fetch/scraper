import KnexStorage from '../../../../src/storage/knex/KnexStorage';
import * as sharedTests from '../shared/shared-tests';

const storage = new KnexStorage({
  client: 'sqlite3',
  useNullAsDefault: true,
  connection: {
    filename: ':memory:',
  },
  debug: false,
});

Object.values(sharedTests).forEach(sharedTest => {
  sharedTest(storage);
});
