// @ts-expect-error importing peer dependency
// eslint-disable-next-line import/no-unresolved
import { JSDOM } from 'jsdom';
import { IDomNode } from './DomClient';

export default class JsdomClient implements IDomNode {
  elm: Element;

  constructor(bufferOrElm: Buffer|Element) {
    this.elm = bufferOrElm instanceof Buffer ? new JSDOM(bufferOrElm.toString('utf8')).window.document.querySelector('body') : bufferOrElm;
  }

  querySelectorAll(selector: string):IDomNode[] {
    return Array.from(this.elm.querySelectorAll(selector)).map(elm => new JsdomClient(elm));
  }

  getAttribute(prop:string) {
    if (prop === 'innerText') {
      return this.elm.textContent;
    }

    return this.elm.getAttribute(prop);
  }
}
