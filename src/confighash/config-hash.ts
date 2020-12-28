import { Buffer } from 'buffer';
import { deflate, inflate } from 'pako';
import * as dictionaryV1 from './dictionary-v1.json';

function encode(input: object):string {
  const deflatedIntArr = deflate(JSON.stringify(input), { dictionary: JSON.stringify(dictionaryV1) });
  return Buffer.from(deflatedIntArr).toString('base64');
}

function decode(deflatedBase64String: string): object {
  if (!deflatedBase64String || deflatedBase64String.length === 0) return null;

  let inflatedInstance = null;
  const buffer = Buffer.from(deflatedBase64String, 'base64');
  const inflatedString = inflate(buffer, <any>{ dictionary: JSON.stringify(dictionaryV1), to: 'string' });
  inflatedInstance = JSON.parse(inflatedString);

  return inflatedInstance;
}

export {
  encode, decode,
};
