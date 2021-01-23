/** Provides a common API to interact with various browser clients. */
export default abstract class BrowserClient {
  isLaunched: boolean;
  opts: {
    browser?: string;
    [key: string]:any;
  }

  constructor(opts) {
    this.opts = opts;
    this.isLaunched = false;
  }

  abstract launch():Promise<void>;
  abstract close():Promise<void>;
  abstract closePage():Promise<void>;
  abstract evaluate(fnc, ...args):Promise<any>;
  abstract goto(url: string, opts):Promise<any>;
  abstract getUrl():string;
}
