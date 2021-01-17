import * as types from 'asn1/lib/ber/types';
import { BaseJsB } from './BaseJs';
import { BaseTsB } from './BaseTs';

export default class ExtendedDomRead extends BaseJsB {
  opts = {
    domRead: true,
  }

  sum(a, b) {
    console.log(BaseTsB);
    return this.jsb(a, b);
  }

  async asum(a, b) {
    console.log(types);
    return this.jsb(a, b);
  }
}
