/* eslint-disable @typescript-eslint/no-var-requires */
import Project, { IStaticProject } from './base/Project';
import Queue, { IStaticQueue } from './base/Queue';
import Resource, { IStaticResource } from './base/Resource';
import { moduleExists } from '../plugins/file-utils';
import Storage, { StorageOptions } from './base/Storage';

export type ModelStorageOptions<T = StorageOptions | Storage> = {
  [key in 'Project'|'Queue'|'Resource'] : T;
}

export type ModelCombination = {
  Project: typeof Project & IStaticProject,
  Queue: typeof Queue & IStaticQueue,
  Resource: typeof Resource & IStaticResource
}

export default class ModelStorage {
  Project: Storage;
  Resource: Storage;
  Queue: Storage;

  get modelKeys():string[] {
    return [ 'Project', 'Queue', 'Resource' ];
  }

  constructor(config: StorageOptions | Storage | ModelStorageOptions) {
    this.init(config);
  }

  isStorageOpts(storage): storage is StorageOptions {
    return storage && Object.prototype.hasOwnProperty.call(storage, 'client');
  }

  isStorage(storage): storage is Storage {
    return storage && Object.prototype.hasOwnProperty.call(storage, 'config');
  }

  isModelStorageOptions(storage): storage is ModelStorageOptions {
    return storage && Array.from(Object.keys(storage)).every(propKey => [ 'Project', 'Queue', 'Resource' ].includes(propKey));
  }

  initStorage(config: StorageOptions):Storage {
    let storage:Storage;
    switch (config.client) {
      case 'sqlite3':
      case 'mysql':
      case 'pg':
        // eslint-disable-next-line no-case-declarations, global-require
        const KnexStorage = moduleExists('knex') ? require('./knex/KnexStorage').default : null;
        if (!KnexStorage) throw new Error('knex package not installed');
        storage = new KnexStorage(config);
        break;
      default:
        throw new Error(`unsupported storage client ${config.client}`);
    }

    return storage;
  }

  init(config: StorageOptions | Storage | ModelStorageOptions):void {
    let storage: Storage;

    if (this.isStorageOpts(config)) {
      storage = this.initStorage(config);
    }
    else if (this.isStorage(config)) {
      storage = config;
    }

    // single storage option
    if (storage) {
      this.modelKeys.forEach(modelKey => {
        this[modelKey] = storage;
      });
    }
    // multiple storage options, one for Project, Queue, Resource
    else if (this.isModelStorageOptions(config)) {
      this.modelKeys.forEach(modelKey => {
        this[modelKey] = this.isStorageOpts(config[modelKey]) ? this.initStorage(config[modelKey]) : config[modelKey];
      });
    }
    // invalid input
    else {
      throw new Error('invalid storage configuration(s)');
    }
  }

  async connect():Promise<void> {
    await Promise.all(this.modelKeys.map(modelKey => this[modelKey].connect()));
  }

  async close():Promise<void> {
    await Promise.all(this.modelKeys.map(modelKey => this[modelKey].close()));
  }

  async getModels():Promise<ModelCombination> {
    const models:ModelCombination = {
      Project: await this.Project.getProject(),
      Queue: await this.Queue.getQueue(),
      Resource: await this.Resource.getResource(),
    };

    Object.values(models).forEach((model: IStaticProject | IStaticQueue | IStaticResource) => {
      // eslint-disable-next-line no-param-reassign
      model.models = models;
    });

    return models;
  }
}
