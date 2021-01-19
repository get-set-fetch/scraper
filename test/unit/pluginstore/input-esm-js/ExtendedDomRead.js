import { extra } from '@get-set-fetch/test-utils';
import { BaseJsB } from './BaseJs';

export default class ExtendedDomRead extends BaseJsB {
  opts = {
    domRead: true,
  }

  sum(a, b) {
    return this.jsb(a, b);
  }

  async asum(a, b) {
    console.log(extra);
    return this.jsb(a, b);
  }
}
