import { IDomNode } from './DomClient';

export default class NativeClient implements IDomNode {
  document: Element;

  constructor(document: Element) {
    this.document = document;
  }

  querySelectorAll(selector: string):IDomNode[] {
    return Array.from(this.document.querySelectorAll(selector)).map(elm => new NativeClient(elm));
  }

  getAttribute(prop:string) {
    return this.document[prop] || this.document.getAttribute(prop);
  }
}
