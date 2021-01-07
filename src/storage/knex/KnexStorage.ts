/* eslint-disable max-classes-per-file */
import Knex from 'knex';
import Entity from '../base/Entity';
import { IStaticResource } from '../base/Resource';
import { IStaticProject } from '../base/Project';
import Storage from '../base/Storage';
import KnexResource from './KnexResource';
import KnexProject from './KnexProject';

export type CapabilitiesType = {
  returning: boolean;
}
export default class KnexStorage extends Storage {
  knex: Knex;
  config: Knex.Config;

  Project: IStaticProject & typeof KnexProject;
  Resource: IStaticResource & typeof KnexResource;

  constructor(config?) {
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
    this.knex = Knex(this.config);

    // create Entity classes with current connection
    const DynamicKnexResource = class extends KnexResource {};
    await DynamicKnexResource.init(this);

    const DynamicKnexProject = class extends KnexProject {};
    await DynamicKnexProject.init(this);

    this.Project = DynamicKnexProject;
    this.Resource = DynamicKnexResource;
    this.isConnected = true;

    return {
      Project: DynamicKnexProject,
      Resource: DynamicKnexResource,
    };
  }

  async close():Promise<void> {
    await this.knex.destroy();
    this.isConnected = false;
  }

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

  toJSON(entity:Entity) {
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
}
