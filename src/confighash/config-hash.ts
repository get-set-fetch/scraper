import { Buffer } from 'buffer';
import { deflateSync, inflateSync } from 'zlib';
import * as dictionaryV1 from './dictionary-v1.json';

/**
 * Converts a scraping configuration to a deflated based64 string.
 * @param input - scraping configuration
 */
function encode(input: object):string {
  const deflatedIntArr = deflateSync(JSON.stringify(input), { dictionary: Buffer.from(JSON.stringify(dictionaryV1)) });
  return Buffer.from(deflatedIntArr).toString('base64');
}

/**
 * Converts a deflated based64 string to a scraping configuration.
 * @param deflatedBase64String - scraping configuration
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
