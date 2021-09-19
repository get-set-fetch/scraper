/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/prefer-default-export */
import { moduleExists } from '../plugins/file-utils';
import Storage, { StorageOptions } from './base/Storage';

const KnexStorage = moduleExists('knex') ? require('./knex/KnexStorage').default : null;

export function initStorage(config: StorageOptions):Storage {
  let storage:Storage;
  switch (config.client) {
    case 'sqlite3':
    case 'mysql':
    case 'pg':
      if (!KnexStorage) throw new Error('knex package not installed');
      storage = new KnexStorage(config);
      break;
    default:
      throw new Error(`unsupported storage client ${config.client}`);
  }

  return storage;
}
