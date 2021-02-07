import cheerio from 'cheerio';
import { IDomNode } from './DomClient';

export default class CheerioClient implements IDomNode {
  root: cheerio.Root;
  elm:cheerio.Element;

  constructor(bufferOrRoot: Buffer|cheerio.Root, elm?: cheerio.Element) {
    this.root = bufferOrRoot instanceof Buffer ? cheerio.load(bufferOrRoot.toString('utf8')) : bufferOrRoot;
    this.elm = elm;
  }

  querySelectorAll(selector: string):IDomNode[] {
    const elms = this.elm ? this.root(selector, this.elm) : this.root(selector);
    return elms.toArray().map(elm => new CheerioClient(this.root, elm));
  }

  getAttribute(prop:string) {
    if (prop === 'innerText') {
      return this.root(this.elm).text();
    }

    return this.root(this.elm).attr(prop);
  }
}
