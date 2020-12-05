import { IStaticResource } from './Resource';
import { IStaticSite } from './Site';

export default abstract class Storage {
  config;

  constructor(config) {
    this.config = config;
  }

  abstract connect():Promise<void>;
  abstract close():Promise<void>;

  abstract get Resource(): IStaticResource;
  abstract get Site(): IStaticSite;
}
