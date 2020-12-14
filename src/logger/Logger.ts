import pino, { Logger } from 'pino';

let logger:Logger = pino({ level: 'warn' });

function getLogger(module?:string) {
  return module ? logger : logger.child({ module });
}

function setLogger(opts?: pino.LoggerOptions, stream?: pino.DestinationStream) {
  logger = pino(opts, stream);
}

export default getLogger;
export {
  setLogger,
};
