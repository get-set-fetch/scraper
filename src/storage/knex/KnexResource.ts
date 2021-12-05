import Project from '../base/Project';
import Resource, { ResourceQuery, IResourceStorage } from '../base/Resource';
import KnexStorage from './KnexStorage';

/** @see {@link Resource} */
export default class KnexResource extends KnexStorage implements IResourceStorage {
  projectId: string | number;

  get tableName():string {
    if (!this.projectId) throw new Error('projectId not set');
    return `${this.projectId}-resources`;
  }

  get builder() {
    return this.knex(this.tableName);
  }

  async init(project:Project):Promise<void> {
    if (!project.id) throw new Error('project.id not set');
    this.projectId = project.id;

    const schemaBuilder = this.knex.schema;
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

        this.jsonCol(builder, 'content');
        this.jsonCol(builder, 'parent');
        this.jsonCol(builder, 'actions');

        this.binaryCol(builder, 'data');
      },
    );
  }

  async getPagedResources(query: Partial<ResourceQuery>):Promise<Partial<Resource>[]> {
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

    return queryBuilder;
  }

  getResource(url: string):Promise<Resource> {
    return this.builder.where({ url }).first();
  }

  delAll():Promise<void> {
    return this.builder.del();
  }

  drop() {
    return this.knex.schema.dropTable(this.tableName);
  }

  count():Promise<number> {
    return super.count(this.tableName);
  }

  async save(resource):Promise<number> {
    const result:number[] = await (
      this.capabilities.returning
        ? this.builder.insert(resource.toJSON()).returning('id')
        : this.builder.insert(resource.toJSON())
    );
    const [ id ] = result;

    return id;
  }
}
