import pino, { Logger, Bindings, DestinationStream, LoggerOptions } from 'pino';
import PinoPretty from 'pino-pretty';

const defaultOpts:LoggerOptions = {
  base: null,
  level: 'warn',
};

export class LogWrapper {
  /** pino */
  logger: Logger;
  bindings: Bindings;
  children:Map<string, LogWrapper>;

  constructor(logger:Logger, bindings?:Bindings) {
    this.logger = logger;
    this.bindings = bindings;
    this.children = new Map();
  }

  /**
   * @param obj object to be serialized
   * @param msg the log message to write
   * @param ...args format string values when `msg` is a format string
   */
  trace(obj, msg?:string, ...args) {
    this.logger.trace.call(this.logger, obj, msg, ...args);
  }

  debug(obj, msg?:string, ...args) {
    this.logger.debug.call(this.logger, obj, msg, ...args);
  }

  info(obj, msg?:string, ...args) {
    this.logger.info.call(this.logger, this.filterArg(obj), msg, ...args);
  }

  warn(obj, msg?:string, ...args) {
    this.logger.warn.call(this.logger, this.filterArg(obj), msg, ...args);
  }

  error(obj, msg?:string, ...args) {
    this.logger.error.call(this.logger, this.filterArg(obj), msg, ...args);
  }

  fatal(obj, msg?:string, ...args) {
    this.logger.error.call(this.logger, this.filterArg(obj), msg, ...args);
  }

  /**
   * Filter out properties like Buffer to prevent needless log pollution
   * @param args - log arguments
   * @returns - filtered out arguments
   */
  filterArg(arg, visited = new WeakMap()) {
    if (!arg) return arg;

    // avoid circular references
    if (visited.has(arg)) return null;

    switch (typeof arg) {
      case 'object':
        visited.set(arg, true);

        if (Buffer.isBuffer(arg)) return '<Buffer> not included';
        if (Array.isArray(arg)) return arg.map(a => this.filterArg(a, visited));

        return Object.keys(arg).reduce(
          (acc, curr) => {
            /*
            tls specific cases where we want to filter all sorts of cert info like manifest, content...
            you can still log them in debug where filterArg is not applied
            */
            acc[curr] = curr === 'cert' ? '<cert> not included' : this.filterArg(arg[curr], visited);
            return acc;
          },
          {},
        );
      default:
        return arg;
    }
  }

  child(bindings):LogWrapper {
    // it's a convention in gsf scraper to request child logger by specifying the module they're going to be used in
    const { module }:{module: string} = bindings;

    // no module declared, return the main logger instead
    if (!module) return this;

    this.children.set(module, new LogWrapper(this.logger.child(bindings), bindings));
    return this.children.get(module);
  }

  setLogger(opts?: LoggerOptions, stream?: DestinationStream) {
    const fullOpts = {
      ...defaultOpts,
      ...opts,
    };

    // on process.stdout, pretty-print the logs, no timestamp, no json format
    const defaultStream = PinoPretty({
      colorize: true,
      ignore: 'pid,hostname,time,module',
      messageFormat: '{module} - {msg}',
      sync: true,
    });

    this.logger = pino(fullOpts, stream || defaultStream);
    Array.from(this.children.keys()).forEach(module => {
      const childWrapper = this.children.get(module);
      childWrapper.logger = this.logger.child(childWrapper.bindings);
    });
  }

  get level() {
    return this.logger.level;
  }
}

const logWrapper = new LogWrapper(pino(defaultOpts));

/**
 * Returns either the main logger or a child one if a module is specified
 * @param module - module name the child logger will be called from
 * @param bindings - additional pino bindings
 */
function getLogger(module?:string, bindings?:Bindings):LogWrapper {
  return module ? logWrapper.child({ module, ...bindings }) : logWrapper;
}

/**
 * Creates a new main logger and propagates settings to existing child loggers
 * @param opts - pino constructor options
 * @param stream - pino constructor stream
 */
function setLogger(opts?: LoggerOptions, stream?: DestinationStream):LogWrapper {
  logWrapper.setLogger(opts, stream);
  return logWrapper;
}

export {
  getLogger,
  setLogger,
};
