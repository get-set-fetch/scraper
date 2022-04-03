import crypto from 'crypto';
import { NodeFetchPlugin, Resource } from '../../src/index';
import { Protocol } from '../../src/plugins/url-utils';

export default class RandomTlsFingerprintFetch extends NodeFetchPlugin {
  shuffledCipherList: string[];

  getShuffledCipherList():string[] {
    const nodeOrderedCipherList = crypto.constants.defaultCipherList.split(':');

    // keep the most important ciphers in the same order
    const fixedCipherList = nodeOrderedCipherList.slice(0, 3);

    // shuffled the rest
    const shuffledCipherList = nodeOrderedCipherList.slice(3)
      .map(cipher => ({ cipher, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ cipher }) => cipher);

    return [
      ...fixedCipherList,
      ...shuffledCipherList,
    ];
  }

  async getRequestOptions(url:URL, resource: Resource) {
    const reqOpts = await super.getRequestOptions(url, resource);

    if (url.protocol === Protocol.HTTPS) {
      // one time initialization of custom ordered ciphers
      if (!this.shuffledCipherList) {
        this.shuffledCipherList = this.getShuffledCipherList();
        this.logger.info(this.shuffledCipherList, 'using shuffled cipherlist');
      }

      reqOpts.ciphers = this.shuffledCipherList.join(':');
    }
    return reqOpts;
  }
}
