/* eslint-disable import/prefer-default-export */
import { KnexStorage } from '..';
import Storage, { StorageConfig } from './base/Storage';

export function initStorage(config: StorageConfig):Storage {
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
