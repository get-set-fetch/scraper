export interface IDomNode {
  querySelectorAll(selector: string):IDomNode[];
  getAttribute(prop: string);
}

export interface IDomClientConstructor {
  new(...args): IDomNode;
}
