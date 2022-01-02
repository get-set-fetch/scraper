class ExtractScriptsPlugin {
  // defines csv export columns
  getContentKeys() {
    return [ 'scripts' ];
  }

  test(project, resource) {
    if (!resource) return false;
    return (/html/i).test(resource.contentType);
  }

  apply(project, resource, DomClient) {
    const doc = new DomClient(resource.data);

    const scripts = [];
    Array.from(doc.querySelectorAll('script')).forEach(script => {
      const src = script.getAttribute('src') ? script.getAttribute('src') : '<inline>';
      if (!scripts.includes(src)) {
        scripts.push(src);
      }
    });

    /*
    a content entry is represented by an array containing one or multiple scraped values
    we can have multiple content entries for a single resources due to dom selectors returning multiple results
    */
    return { content: [ scripts ] };
  }
}

module.exports = ExtractScriptsPlugin;
