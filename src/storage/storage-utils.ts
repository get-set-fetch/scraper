/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/prefer-default-export */
import Project, { IStaticProject } from './base/Project';
import Queue, { IStaticQueue } from './base/Queue';
import Resource, { IStaticResource } from './base/Resource';
import Storage, { StorageOptions } from './base/Storage';

export type ModelStorageOptions<T = StorageOptions | Storage> = {
  [key in 'Project'|'Queue'|'Resource'] : T;
}

export type ModelCombination = {
  Project: typeof Project & IStaticProject,
  Queue: typeof Queue & IStaticQueue,
  Resource: typeof Resource & IStaticResource
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function staticImplements<T>(ctor: T) {
  return ctor;
}
