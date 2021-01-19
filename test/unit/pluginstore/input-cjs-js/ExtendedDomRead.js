/* eslint-disable */
const { BaseJsB } = require('./BaseJs');

class ExtendedDomRead extends BaseJsB {
  opts = {
    domRead: true,
  }

  sum(a, b) {
    console.log(BaseJsB);
    return this.jsb(a, b);
  }

  async asum(a, b) {
    return this.jsb(a, b);
  }
}

module.exports = ExtendedDomRead;
