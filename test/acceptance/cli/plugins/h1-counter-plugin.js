class H1CounterPlugin {
  opts = {
    startVal: 10,
  }

  // defines csv export columns
  getContentKeys() {
    return [ 'h1', 'h1Length' ];
  }

  test(project, resource) {
    if (!resource) return false;
    return (/html/i).test(resource.contentType);
  }

  apply(project, resource, DomClient) {
    const doc = new DomClient(resource.data);

    const content = doc.querySelectorAll('h1').map(domNode => ([
      domNode.getAttribute('innerText'),
      domNode.getAttribute('innerText').length + this.opts.startVal,
    ]));
    // const content = doc.querySelectorAll('h1').map(domNode => ([ domNode.innerText, domNode.innerText ]));

    /*
    a content entry is represented by an array containing one or multiple scraped values
    we can have multiple content entries for a single resources due to
      - dom selectors returning multiple results
    */

    return { content };
  }
}

module.exports = H1CounterPlugin;
