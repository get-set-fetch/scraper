import Base from './Base';

export default class ExtendedDomRead extends Base {
  opts = {
    domRead: true,
  }

  sum(a: number, b: number) {
    return a + b;
  }

  async asum(a: number, b: number):Promise<number> {
    return a + b;
  }
}
