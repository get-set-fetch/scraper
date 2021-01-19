import { extra } from '@get-set-fetch/test-utils';
import { BaseTsB } from './BaseTs';

export default class ExtendedDomRead extends BaseTsB {
  opts = {
    domRead: true,
  }

  sum(a, b) {
    return this.tsb(a, b);
  }

  async asum(a, b) {
    console.log(extra);
    return this.tsb(a, b);
  }
}
