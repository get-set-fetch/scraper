export default abstract class BrowserClient {
  isLaunched: boolean;

  abstract launch():Promise<void>;
  abstract close():Promise<void>;
  abstract evaluate(fnc, ...args):Promise<any>;
  abstract goto(url: string, opts):Promise<any>;
}