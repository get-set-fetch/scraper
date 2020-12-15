import Knex from 'knex';
import { CapabilitiesType } from '../base/Entity';
import Storage from '../base/Storage';
import KnexResource from './KnexResource';
import KnexSite from './KnexSite';

export default class KnexStorage extends Storage {
  static knex: Knex;

  config: Knex.Config;

  async connect():Promise<void> {
    KnexStorage.knex = Knex(this.config);

    // create tables if missing
    await KnexResource.init();
    await KnexSite.init();
  }

  close():Promise<void> {
    return KnexStorage.knex.destroy();
  }

  static get capabilities():CapabilitiesType {
    if (!KnexStorage.knex) {
      throw new Error('connect to db first');
    }

    const { config } = KnexStorage.knex.client;

    /*
    json columns not supported in sqlite, don't rely on functions from json1 extension [1]
    that may or may not be embedded in the sqlite db being used
    manually invoke JSON.strigify, JSON.parse on the target column
    [1] - https://www.sqlite.org/json1.html
    */
    const json = config.client !== 'sqlite3';

    // only postgresql supports jsonb
    const jsonb = config.client === 'pg';

    return {
      json,
      jsonb,
    };
  }

  get Resource() {
    return KnexResource;
  }

  get Site() {
    return KnexSite;
  }
}
