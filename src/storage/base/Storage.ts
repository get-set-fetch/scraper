import Project, { IStaticProject } from './Project';
import Queue, { IStaticQueue } from './Queue';
import Resource, { IStaticResource } from './Resource';

export type StorageOptions = {
  client: string,
  [key: string]: any
}

/**
 * Each storage option (db, in-memory) extends this class.
 */
export default abstract class Storage {
  config: StorageOptions;

  /**
   * Stores db connection.
   * @param config - db connection information
   */
  constructor(config) {
    this.config = config;
  }

  /** Open db connection */
  abstract connect():Promise<void>;

  /** Close db connection. */
  abstract close():Promise<void>;

  abstract getProject():Promise<typeof Project & IStaticProject>;
  abstract getQueue():Promise<typeof Queue & IStaticQueue>;
  abstract getResource():Promise<typeof Resource & IStaticResource>;

  abstract toJSON(data: Resource | Queue | Project);
}
