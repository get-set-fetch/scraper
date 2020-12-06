import Knex from 'knex';
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

  get Resource() {
    return KnexResource;
  }

  get Site() {
    return KnexSite;
  }
}
