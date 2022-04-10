/* eslint-disable no-param-reassign */
import { IQueueStorage, QueueEntry } from '../base/Queue';
import KnexStorage from './KnexStorage';
import { Project } from '../..';

export default class KnexQueue extends KnexStorage implements IQueueStorage {
  static ERROR_CODE_LEN = 50;

  projectId: string | number;

  get tableName():string {
    if (!this.projectId) throw new Error('projectId not set');
    return `${this.projectId}-queue`;
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
        builder.string('url').index(`ix_${this.projectId}_url`).unique();
        builder.integer('depth').defaultTo(0);

        if (this.client === 'pg') {
          builder.specificType('status', 'smallint');
        }
        else {
          builder.integer('status');
        }

        // error code from thrown exceptions
        builder.string('error', KnexQueue.ERROR_CODE_LEN);

        this.jsonCol(builder, 'parent');
      },
    );

    /*
    pg optimizations
    - hash index on resource.url
        - starting with pg 10 hash indexes support Write-Ahead-Logging
        - it makes sense to do a hash index on url since we only check for equality (if an url already exists)
        - we can't use hash indexes with unique constraints though
        - unfortunately inserts with ignore on 'url' conflict are only possible with B-tree indexes
        - such inserts are used by the InsertResourcesPlugin to save new resources without pre-checking for already present urls
        - fallback to default B-tree indexes via knex.index()
    - HOT updates
        - are possible since variable length scraped content is stored in another table
        - don't have much impact since we need to rebuild the status index on update (status is the only queue column being updated)
    */
  }

  async drop() {
    const hasTable = await this.knex.schema.hasTable(this.tableName);
    if (hasTable) {
      // drop index
      await new Promise<void>(async (resolve, reject) => {
        try {
          await this.knex.schema.table(
            this.tableName,
            async t => {
              await t.dropUnique([ 'url' ], `ix_${this.projectId}_url`);
              resolve();
            },
          );
        }
        catch (err) {
          reject(err);
        }
      });

      // drop table
      await this.knex.schema.dropTable(this.tableName);
    }
  }

  get builder() {
    return this.knex(this.tableName);
  }

  /**
   * Find a resource to scrape and update its queue status
   * @returns - null if no to-be-scraped resource has been found
   */
  async getResourcesToScrape(limit:number = 10):Promise<QueueEntry[]> {
    let queueEntries:QueueEntry[];

    // pg optimization
    if (this.client === 'pg') {
      const query = this.knex.raw<{rows: QueueEntry[]}>(
        `
          update ?? set "status" = 1
          where "id" in (
            select "id" from ?? 
            where status is null
            limit ? 
            for update skip locked
          )
          returning "id", "url", "depth", "parent";
        `,
        [ this.tableName, this.tableName, limit ],
      );

      const result = await query;
      queueEntries = result.rows;
    }
    // generic approach
    else {
      await this.knex.transaction(async trx => {
        queueEntries = await this.builder
          .transacting(trx)
          .whereNull('status')
          .limit(limit)
          .forUpdate();

        if (queueEntries && queueEntries.length > 0) {
          await Promise.all(queueEntries.map(queueEntry => this.builder.transacting(trx).where('id', queueEntry.id).update('status', 1)));
        }
        await trx.commit();
      });
    }

    return queueEntries;
  }

  count():Promise<number> {
    return super.count(this.tableName);
  }

  async updateStatus(id: number, status: number, error?: string):Promise<void> {
    const partialUpdate = error ? { status, error: error.substring(0, KnexQueue.ERROR_CODE_LEN) } : { status };
    await this.builder.where('id', id).update(partialUpdate);
  }

  async add(entries: QueueEntry[]) {
    await this.builder.insert(entries).onConflict('url').ignore();
  }

  async filterExistingEntries(urls: string[]) {
    const existingEntries:Partial<QueueEntry>[] = await this.builder.select('url').whereIn('url', urls);
    return existingEntries;
  }
}
