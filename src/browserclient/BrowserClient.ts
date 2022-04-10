/** Provides a common API to interact with various browser clients. */

export type BaseResponse = {
  status(): number;
  url(): string;
  request(): {};
  ok(): boolean;
  headers();
}

export default abstract class BrowserClient {
  /**
   * whether or not the browser is launched
   */
  isLaunched: boolean;

  /**
   * options for launching the browser
   * if not specified {headless: true} is added
   */
  opts: {
    browser?: string;
    [key: string]:any;
  };

  constructor(opts) {
    this.opts = opts;
    this.isLaunched = false;
  }

  abstract launch():Promise<void>;
  abstract close():Promise<void>;
  abstract closePage():Promise<void>;

  /*
  puppeteer supports evaluate with multiple arguments
  playwright supports evaluate with a single argument object
  use object destructuring to support both APIs
  */
  abstract evaluate(fnc, argObj?):Promise<any>;

  abstract getRedirectResponse(req):Promise<BaseResponse|null>;

  abstract goto(url: string, opts):Promise<BaseResponse>;
  abstract getUrl():string;
}
