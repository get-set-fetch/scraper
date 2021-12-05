/* eslint-disable @typescript-eslint/no-empty-function */
/* for standalone projects replace '../../src/index' with '@get-set-fetch/scraper' */
import { IProjectStorage, IResourceStorage, IQueueStorage, Connection } from '../../src/index';
import InMemoryQueue from './InMemoryQueue';

export default class InMemoryConnection extends Connection {
  /*
  by default each connection type is established based on some config,
  there are no settings for in-memory storage, just specify a client value
  */
  constructor() {
    super({ client: 'in-memory' });
  }

  async open() {}
  async close() {}

  getProjectStorage():IProjectStorage {
    throw new Error('In-Memory Project not supported');
  }

  getResourceStorage():IResourceStorage {
    throw new Error('In-Memory Resource not supported');
  }

  getQueueStorage():IQueueStorage {
    return new InMemoryQueue(this);
  }
}
