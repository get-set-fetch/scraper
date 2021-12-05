/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable max-classes-per-file */
import Project from './base/Project';
import Queue from './base/Queue';
import Resource from './base/Resource';
import Connection, { ConnectionConfig } from './base/Connection';
import { moduleExists } from '../plugins/file-utils';

export type PerModelConfig<T = ConnectionConfig | Connection> = {
  [key in 'Project'|'Queue'|'Resource'] : T;
}

export type PerModelConnnection = {
  [key in 'Project'|'Queue'|'Resource'] : Connection;
}

export default class ConnectionManager {
  Project: Connection;
  Queue: Connection;
  Resource: Connection;

  get modelKeys():string[] {
    return [ 'Project', 'Queue', 'Resource' ];
  }

  constructor(config: ConnectionConfig | Connection | PerModelConfig) {
    this.init(config);
  }

  isConnectionConfig(conn): conn is ConnectionConfig {
    return conn && Object.prototype.hasOwnProperty.call(conn, 'client');
  }

  isConnection(conn): conn is Connection {
    return conn && Object.prototype.hasOwnProperty.call(conn, 'config');
  }

  isPerModelConfig(conn): conn is PerModelConfig {
    return conn && Array.from(Object.keys(conn)).every(propKey => [ 'Project', 'Queue', 'Resource' ].includes(propKey));
  }

  initConnection(config: ConnectionConfig):Connection {
    let conn:Connection;
    switch (config.client) {
      case 'sqlite3':
      case 'mysql':
      case 'pg':
        // eslint-disable-next-line no-case-declarations, global-require
        const KnexConnection = moduleExists('knex') ? require('./knex/KnexConnection').default : null;
        if (!KnexConnection) throw new Error('knex package not installed');
        conn = new KnexConnection(config);
        break;
      default:
        throw new Error(`unsupported storage client ${config.client}`);
    }

    return conn;
  }

  init(config: ConnectionConfig | Connection | PerModelConfig):void {
    let conn: Connection;

    if (this.isConnectionConfig(config)) {
      conn = this.initConnection(config);
    }
    else if (this.isConnection(config)) {
      conn = config;
    }

    // single connection config
    if (conn) {
      this.modelKeys.forEach(modelKey => {
        this[modelKey] = conn;
      });
    }
    // multiple connection configs, one for Project, Queue, Resource
    else if (this.isPerModelConfig(config)) {
      this.modelKeys.forEach(modelKey => {
        this[modelKey] = this.isConnectionConfig(config[modelKey]) ? this.initConnection(config[modelKey]) : config[modelKey];
      });
    }
    // invalid input
    else {
      throw new Error('invalid connect configuration(s)');
    }
  }

  async connect():Promise<void> {
    await Promise.all([ this.Project.open(), this.Queue.open(), this.Resource.open() ]);
  }

  async close():Promise<void> {
    await Promise.all(this.modelKeys.map(modelKey => this[modelKey].close()));
  }

  /**
   * Based on storage options, get custom Project class linked to custom Queue, Resource classes.
   */
  async getProject():Promise<typeof Project> {
    // create a unique combination of models
    const ExtProject:typeof Project = class extends Project {};
    ExtProject.storage = this.Project.getProjectStorage();

    const ExtQueue:typeof Queue = class extends Queue {};
    ExtQueue.storage = this.Queue.getQueueStorage();

    const ExtResource:typeof Resource = class extends Resource {};
    ExtResource.storage = this.Project.getResourceStorage();

    // link models
    ExtProject.ExtQueue = ExtQueue;
    ExtProject.ExtResource = ExtResource;
    ExtQueue.ExtResource = ExtResource;

    // init Project storage
    await ExtProject.storage.init();

    return ExtProject;
  }

  static clone(project:Project):ConnectionManager {
    const { config: projConnConfig, constructor: ProjConnConstructor } = project.Constructor.storage.conn;
    const projConn:Connection = new (<{new(config:ConnectionConfig):Connection}>ProjConnConstructor)(projConnConfig);

    const { config: queueConnConfig, constructor: QueueConnConstructor } = project.Constructor.ExtQueue.storage.conn;
    const queueConn:Connection = new (<{new(config:ConnectionConfig):Connection}>QueueConnConstructor)(queueConnConfig);

    const { config: resourceConnConfig, constructor: ResourceConnConstructor } = project.Constructor.ExtResource.storage.conn;
    const resourceConn:Connection = new (<{new(config:ConnectionConfig):Connection}>ResourceConnConstructor)(resourceConnConfig);

    return new ConnectionManager({
      Project: projConn,
      Queue: queueConn,
      Resource: resourceConn,
    });
  }
}
