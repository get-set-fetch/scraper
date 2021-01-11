// eslint-disable-next-line @typescript-eslint/no-var-requires
const Base = require('./Base');

class ExtendedDomRead extends Base {
  opts = {
    domRead: true,
  }

  sum(a, b) {
    return a + b;
  }

  async asum(a, b) {
    return a + b;
  }
}

module.exports = ExtendedDomRead;
