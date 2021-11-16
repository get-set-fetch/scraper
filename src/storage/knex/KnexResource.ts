import Resource, { ResourceQuery, IStaticResource } from '../base/Resource';
import { ModelCombination } from '../storage-utils';
import KnexStorage from './KnexStorage';

/** @see {@link Resource} */
export default class KnexResource extends Resource {
  static storage:KnexStorage;
  static models: ModelCombination;
  static projectId: number;

  static get tableName():string {
    if (!this.projectId) throw new Error('projectId not set');
    return `${this.projectId}-resources`;
  }

  static get builder() {
    return this.storage.knex(this.tableName);
  }

  static async init():Promise<void> {
    const schemaBuilder = this.storage.knex.schema;
    const tablePresent = await schemaBuilder.hasTable(this.tableName);
    if (tablePresent) return;

    await schemaBuilder.createTable(
      this.tableName,
      builder => {
        builder.increments('id').primary();
        builder.string('url');
        builder.integer('depth').defaultTo(0);
        builder.dateTime('scrapedAt');

        builder.integer('status');
        builder.string('contentType');

        this.storage.jsonCol(builder, 'content');
        this.storage.jsonCol(builder, 'parent');
        this.storage.jsonCol(builder, 'actions');

        this.storage.binaryCol(builder, 'data');
      },
    );
  }

  static async get(resourceId:number):Promise<Resource> {
    const rawResource = await this.builder.where({ id: resourceId }).first();
    return rawResource ? new (<IStaticResource> this.models.Resource)(rawResource) : undefined;
  }

  static async getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]> {
    const { cols, where, whereNotNull, whereIn, offset, limit } = query;

    let queryBuilder = this.builder.select(cols || [ 'url', 'content' ]).orderBy('id');

    if (where && Object.keys(where).length > 0) {
      queryBuilder = queryBuilder.where(where);
    }
    if (offset !== undefined) {
      queryBuilder = queryBuilder.offset(offset);
    }
    if (limit !== undefined) {
      queryBuilder = queryBuilder.limit(limit);
    }
    if (whereNotNull) {
      whereNotNull.forEach(notNullCol => {
        queryBuilder = queryBuilder.whereNotNull(notNullCol);
      });
    }
    if (whereIn) {
      Object.keys(whereIn).forEach(key => {
        queryBuilder = queryBuilder.whereIn(key, whereIn[key]);
      });
    }

    const rawResources:any[] = await queryBuilder;

    // json value returned as string not obj, parse the content string into proper json obj
    if (rawResources.length > 0 && typeof rawResources[0].content === 'string') {
      return rawResources.map(rawResource => Object.assign(rawResource, { content: JSON.parse(rawResource.content) }));
    }

    // json value returned as string not obj, parse the parent string into proper json obj
    if (rawResources.length > 0 && typeof rawResources[0].parent === 'string') {
      return rawResources.map(rawResource => Object.assign(rawResource, { parent: JSON.parse(rawResource.parent) }));
    }

    // no conversion required
    return rawResources;
  }

  static getAll():Promise<Resource[]> {
    return this.builder.select();
  }

  static async getResource(url: string):Promise<Resource> {
    const rawResource = await this.builder.where({ url }).first();
    return rawResource ? new (<IStaticResource> this.models.Resource)(rawResource) : undefined;
  }

  static delAll():Promise<void> {
    return this.builder.del();
  }

  static drop() {
    return this.storage.knex.schema.dropTable(this.tableName);
  }

  static count():Promise<number> {
    return this.storage.count(this.tableName);
  }

  get Constructor():typeof KnexResource {
    return (<typeof KnexResource> this.constructor);
  }

  async save():Promise<number> {
    const result:number[] = await (
      this.Constructor.storage.capabilities.returning
        ? this.Constructor.builder.insert(this.toJSON()).returning('id')
        : this.Constructor.builder.insert(this.toJSON())
    );
    [ this.id ] = result;

    return this.id;
  }

  del():Promise<void> {
    return this.Constructor.builder.where('id', this.id).del();
  }
}
