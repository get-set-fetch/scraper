import Resource, { IStaticResource } from './Resource';
import Project, { IStaticProject } from './Project';

/**
 * Each storage option extends this class.
 * On a succesfull db connection it returns Project and Resource classes linked to that connection.
 */
export default abstract class Storage {
  config;
  isConnected:boolean;

  Project: IStaticProject & typeof Project;
  Resource: IStaticResource & typeof Resource;

  /**
   * Stores db connection.
   * @param config - db connection information
   */
  constructor(config) {
    this.config = config;
    this.isConnected = false;
  }

  /** Connects to db and returns Project and Resource classes linked to the db connection. */
  abstract connect():Promise<{
    Project: IStaticProject & typeof Project,
    Resource: IStaticResource & typeof Resource
  }>;

  /** Closes the database. */
  abstract close():Promise<void>;
}
