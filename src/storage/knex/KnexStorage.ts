/* eslint-disable max-classes-per-file */
import { Knex } from 'knex';
import Storage from '../base/Storage';
import Entity from '../base/Entity';

import KnexConnection from './KnexConnection';

export type CapabilitiesType = {
  returning: boolean;
}

export default abstract class KnexStorage extends Storage {
  knex: Knex;
  config: Knex.Config & {client: string};

  abstract get builder():Knex.QueryBuilder;

  constructor(conn: KnexConnection) {
    super(conn);
    this.knex = conn.knex;
    this.config = conn.config;
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

  get(id:number):Promise<Entity> {
    return this.builder.where({ id }).first();
  }

  getAll<T extends Partial<Entity> = Partial<Entity>>():Promise<T[]> {
    return this.builder.select();
  }

  /**
   * On Queue and Resource tables we only add entries, not remove them.
   * Use last autoincrement sequence value to get total number of entries.
   * @param tableName table to count entries from
   * @returns number of entries
   */
  async count(tableName: string):Promise<number> {
    let selectCount:Knex.QueryBuilder | Knex.Raw;
    let result;

    switch (this.client) {
      case 'sqlite3':
        selectCount = this.knex.raw(
          'SELECT seq as "count" FROM main.sqlite_sequence WHERE name = ?',
          tableName,
        );
        [ result ] = await selectCount;
        break;
      case 'pg':
        selectCount = this.knex.raw(
          'SELECT last_value as "count" FROM pg_sequences WHERE sequencename = ?',
          `${tableName}_id_seq`,
        );
        [ result ] = (await selectCount).rows;
        break;
      // regular table storage scan
      default:
        selectCount = this.knex(tableName).count('*', { as: 'count' });
        [ result ] = await selectCount;
    }

    return typeof result.count === 'string' ? parseInt(result.count, 10) : result.count;
  }

  async save(entity:Entity):Promise<number> {
    if (this.capabilities.returning) {
      const result:{id: number}[] = await this.builder.insert(this.toJSON(entity)).returning('id');
      const [ { id } ] = result;
      return id;
    }

    const result:number[] = await this.builder.insert(this.toJSON(entity));
    const [ id ] = result;
    return id;
  }

  del(id:string | number):Promise<void> {
    return this.builder.where('id', id).del();
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
