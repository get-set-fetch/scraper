/* eslint-disable max-classes-per-file */
import { Knex, knex } from 'knex';
import { IStaticProject } from '../base/Project';
import { IStaticQueue } from '../base/Queue';
import { IStaticResource } from '../base/Resource';
import Storage, { StorageOptions } from '../base/Storage';
import { staticImplements } from '../storage-utils';
import KnexProject from './KnexProject';
import KnexQueue from './KnexQueue';
import KnexResource from './KnexResource';

export type CapabilitiesType = {
  returning: boolean;
}

export default class KnexStorage extends Storage {
  knex: Knex;
  config: Knex.Config & {client: string};

  get client():string {
    if (!this.knex) {
      throw new Error('connect to db first');
    }

    const { config } = this.knex.client;
    return config.client;
  }

  get capabilities():CapabilitiesType {
    if (!this.knex) {
      throw new Error('connect to db first');
    }

    // only postgres needs returning on insert statements to retrieve newly inserted data
    const returning = this.client === 'pg';

    return {
      returning,
    };
  }

  constructor(config?:StorageOptions) {
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

  async connect() {
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

  async getProject(): Promise<typeof KnexProject & IStaticProject> {
    const ExtProject = class extends KnexProject {};
    ExtProject.storage = this;
    await ExtProject.init();
    return staticImplements<typeof KnexProject & IStaticProject>(ExtProject);
  }

  async getQueue(): Promise<typeof KnexQueue & IStaticQueue> {
    const ExtQueue = class extends KnexQueue {};
    ExtQueue.storage = this;
    return staticImplements<typeof KnexQueue & IStaticQueue>(ExtQueue);
  }

  async getResource(): Promise<typeof KnexResource & IStaticResource> {
    const ExtResource = class extends KnexResource {};
    ExtResource.storage = this;
    return staticImplements<typeof KnexResource & IStaticResource>(ExtResource);
  }

  toJSON(entity) {
    const { dbCols } = entity;

    const obj = {};
    dbCols.forEach(dbCol => {
      let dbVal = entity[dbCol];

      if (dbVal instanceof Object.getPrototypeOf(Uint8Array)) {
        // mysql doesn't insert Uint8Array as binary, needs to be converted to Buffer first
        if (this.client === 'mysql') {
          dbVal = Buffer.from(dbVal);
        }
      }
      else if (
        dbVal !== null
        && (typeof dbVal === 'object' || Array.isArray(dbVal))
        && !(dbVal instanceof Date)
      ) {
        dbVal = JSON.stringify(dbVal);
      }

      if (dbVal !== undefined) {
        obj[dbCol] = dbVal;
      }
    });

    return obj;
  }

  binaryCol(builder:Knex.CreateTableBuilder, colName: string):void {
    // mysql driver creates a BLOB column with just 64KB for knex.binary, override it
    if (this.client === 'mysql') {
      builder.specificType(colName, 'MEDIUMBLOB');
    }
    else {
      builder.binary(colName);
    }
  }

  jsonCol(builder:Knex.CreateTableBuilder, colName: string):void {
    // only postgres supports jsonb
    if (this.client === 'pg') {
      builder.jsonb(colName);
    }
    /*
    json columns not supported in sqlite, don't rely on functions from json1 extension [1]
    that may or may not be embedded in the sqlite db being used
    manually invoke JSON.strigify, JSON.parse on the target column
    [1] - https://www.sqlite.org/json1.html
    */
    else if (this.client !== 'sqlite3') {
      builder.json(colName);
    }
    else {
      builder.string(colName);
    }
  }

  btreeIdx(builder:Knex.CreateTableBuilder, colName: string) {
    // knex supports btrees only postgresql/mysql
    if (this.client === 'pg' || this.client === 'mysql') {
      builder.index(colName, undefined, 'btree');
    }
  }
}
