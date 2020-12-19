import { IStaticResource } from './Resource';
import { IStaticSite } from './Site';

export default abstract class Storage {
  config;
  isConnected:boolean;

  constructor(config) {
    this.config = config;
    this.isConnected = false;
  }

  abstract connect():Promise<void>;
  abstract close():Promise<void>;

  abstract get Resource(): IStaticResource;
  abstract get Site(): IStaticSite;
}
