/** Provides a common API to interact with various browser clients. */
export default abstract class BrowserClient {
  isLaunched: boolean;

  abstract launch():Promise<void>;
  abstract close():Promise<void>;
  abstract closePage():Promise<void>;
  abstract evaluate(fnc, ...args):Promise<any>;
  abstract goto(url: string, opts):Promise<any>;
  abstract getUrl():string;
}
