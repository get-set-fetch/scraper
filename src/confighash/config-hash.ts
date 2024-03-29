import { Buffer } from 'buffer';
import { deflateSync, inflateSync, constants } from 'zlib';
import * as dictionaryV1 from './dictionary-v1.json';

/**
 * Converts a project configuration to a deflated based64 string.
 * @param input - project configuration
 */
function encode(input: object):string {
  const deflatedIntArr = deflateSync(JSON.stringify(input), { dictionary: Buffer.from(JSON.stringify(dictionaryV1)), level: constants.Z_BEST_COMPRESSION });
  return Buffer.from(deflatedIntArr).toString('base64');
}

/**
 * Converts a deflated based64 string to a project configuration.
 * @param deflatedBase64String - project configuration
 */
function decode(deflatedBase64String: string) {
  if (!deflatedBase64String || deflatedBase64String.length === 0) return null;

  let inflatedInstance = null;
  const buffer = Buffer.from(deflatedBase64String, 'base64');
  const inflatedString = inflateSync(buffer, { dictionary: Buffer.from(JSON.stringify(dictionaryV1)) });
  inflatedInstance = JSON.parse(inflatedString.toString('utf-8'));

  return inflatedInstance;
}

export {
  encode, decode,
};
