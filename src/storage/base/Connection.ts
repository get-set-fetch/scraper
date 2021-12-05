import { IProjectStorage } from './Project';
import { IQueueStorage } from './Queue';
import { IResourceStorage } from './Resource';

export type ConnectionConfig = {
  client: string,
  [key: string]: any
}

export default abstract class Connection {
  config: ConnectionConfig;

  constructor(config:ConnectionConfig) {
    this.config = config;
  }

  abstract open():Promise<void>;
  abstract close():Promise<void>;

  abstract getProjectStorage():IProjectStorage;
  abstract getQueueStorage():IQueueStorage;
  abstract getResourceStorage():IResourceStorage;
}
