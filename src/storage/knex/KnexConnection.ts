import { Knex, knex } from 'knex';
import Connection, { ConnectionConfig } from '../base/Connection';
import { IProjectStorage } from '../base/Project';
import { IQueueStorage } from '../base/Queue';
import { IResourceStorage } from '../base/Resource';
import KnexProject from './KnexProject';
import KnexQueue from './KnexQueue';
import KnexResource from './KnexResource';

export default class KnexConnection extends Connection {
  knex: Knex;
  config: Knex.Config & {client: string};

  constructor(config?:ConnectionConfig) {
    // if no config present, use in memory sqlite
    super(config || {
      client: 'sqlite3',
      useNullAsDefault: true,
      connection: {
        filename: ':memory:',
      },
      debug: false,
    });
  }

  async open() {
    if (!this.knex) {
      this.knex = knex(this.config);
    }
  }

  async close():Promise<void> {
    if (this.knex) {
      const { knex } = this;
      delete this.knex;
      await knex.destroy();
    }
  }

  getProjectStorage():IProjectStorage {
    return new KnexProject(this);
  }

  getQueueStorage():IQueueStorage {
    return new KnexQueue(this);
  }

  getResourceStorage():IResourceStorage {
    return new KnexResource(this);
  }
}
