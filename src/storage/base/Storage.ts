import Resource, { IStaticResource } from './Resource';
import Site, { IStaticSite } from './Site';

export default abstract class Storage {
  config;
  isConnected:boolean;

  Site: IStaticSite & typeof Site;
  Resource: IStaticResource & typeof Resource;

  constructor(config) {
    this.config = config;
    this.isConnected = false;
  }

  abstract connect():Promise<{
    Site: IStaticSite & typeof Site,
    Resource: IStaticResource & typeof Resource
  }>;

  abstract close():Promise<void>;
}
