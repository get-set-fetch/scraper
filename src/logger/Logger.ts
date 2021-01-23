import pino, { Logger, Bindings, DestinationStream, LoggerOptions } from 'pino';

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

  trace(...args) {
    this.logger.trace.call(this.logger, ...args);
  }

  debug(...args) {
    this.logger.debug.call(this.logger, ...args);
  }

  info(...args) {
    this.logger.info.call(this.logger, ...args);
  }

  warn(...args) {
    this.logger.warn.call(this.logger, ...args);
  }

  error(...args) {
    this.logger.error.call(this.logger, ...args);
  }

  fatal(...args) {
    this.logger.fatal.call(this.logger, ...args);
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
    const fullOpts = opts || {};
    if (fullOpts && !Object.prototype.hasOwnProperty.call(fullOpts, 'base')) {
      fullOpts.base = null;
    }

    this.logger = pino(fullOpts, stream);
    Array.from(this.children.keys()).forEach(module => {
      const childWrapper = this.children.get(module);
      childWrapper.logger = this.logger.child(childWrapper.bindings);
    });
  }
}

const logWrapper = new LogWrapper(pino({ level: 'warn', base: null }));

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
