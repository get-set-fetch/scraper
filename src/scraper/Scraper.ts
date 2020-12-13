/* eslint-disable no-await-in-loop */
/* eslint-disable no-param-reassign */
import BrowserClient from './BrowserClient';
import Site from '../storage/base/Site';
import Resource from '../storage/base/Resource';
import Plugin from '../plugins/Plugin';
import PluginStore from '../pluginstore/PluginStore';

/*
scraper is:
- browser agnostic (init browser client outside scraper)
- storage agnostic (init storage outside scraper)
*/
export default class Scraper {
  browserClient:BrowserClient;

  constructor(browserClient:BrowserClient) {
    this.browserClient = browserClient;
  }

  async scrape(site: Site) {
    try {
      site.plugins = site.initPlugins();
    }
    catch (err) {
      console.error(
        `Error instantiating plugin definitions for site ${site.name}`,
        err,
      );

      // no plugins > no scrape process > abort
    }

    const domWritePluginsPresent = site.plugins.some(
      plugin => plugin.opts && plugin.opts.domWrite,
    );

    let staticResource:Resource = null;
    let dynamicResource:Resource = null;
    do {
      /*
      a null resource will result in selection of a new resource from the db (ex: SelectResourcePlugin)
      an existing resource can result in a new resource being generated in case of dynamic actions (ex: ScrollPlugin, ClickPlugin)

      after applying all the plugins, if the returned resource is null:
        - there are no resources to crawl from the db
        - there are no more dynamic actions to take
      => if both conditions are met, crawl is stopped
      */

      // retrieve static resource, opening its url in a new browser tab
      staticResource = await this.scrapeResource(site);

      if (staticResource && domWritePluginsPresent) {
        do {
          // retrieve dynamic resource, use the current tab dom state to further scroll, click, etc..
          dynamicResource = await this.scrapeResource(site, staticResource);
        }
        while (dynamicResource);
      }
    }
    while (staticResource);
  }

  async scrapeResource(site: Site, resource: Resource = null):Promise<Resource> {
    let pluginIdx: number;
    let resourceFound = false;

    try {
      /*
      will execute the plugins in the order they are defined
      apply each plugin to the current (site, resource) pair
      */
      for (pluginIdx = 0; pluginIdx < site.plugins.length; pluginIdx += 1) {
        const result = await this.executePlugin(site, resource, site.plugins[pluginIdx]);

        /*
        a plugin result can represent:
        - a new static resource
          - IdbResource from the db not yet crawled (ex: SelectResourcePlugin)
        - a new dynamic resource (ex: ScrollPlugin, ClickPlugin)
          - obj containing an "actions" key
        - additional data/content to be merged with the current resource (ex: ExtractUrlsPlugin, ExtractHtmlContentPlugin, ...)
          - generic object
        */

        console.debug(`Plugin result (json): ${JSON.stringify(result)}`);

        // current plugin did not returned a result, move on to the next one
        // eslint-disable-next-line no-continue
        if (!result) continue;

        // a new static resource has been selected for scraping
        if (result instanceof Resource) {
          resource = result;
          resourceFound = true;
        }
        /*
        // a new dynamic resource has been generated, it will be crawled right away by the next plugins
        else if (result.actions) {
          resource = site.createResource(
            Object.assign(
              result,
              {
                siteId: resource.siteId,
                url: resource.url,
                mediaType: resource.contentType,
                depth: resource.depth,
                scrapeInProgress: true,
              },
            ),
          );
          resourceFound = true;
        }
        */
        // new content has been generated to be merged wih the current resource
        else {
          // console.log(`result merging ${JSON.stringify(result)}`);
          Object.assign(resource, result);
          // console.log(`new resource ${JSON.stringify(resource)}`);
          // this.mergeResourceResult(resource, result);
        }
      }

      if (resource) {
        console.debug(`Resource successfully crawled (json): ${JSON.stringify(resource)}`);
        // console.info(`Resource successfully crawled (url): ${resource.url}`);
      }
      else {
        console.info(`No crawlable resource found for site ${site.name}`);
      }
    }
    catch (err) {
      console.error(
        // eslint-disable-next-line max-len
        `Crawl error for site ${site.name}, Plugin ${site.plugins[pluginIdx].constructor.name} against resource ${resource ? resource.url : ''}`,
        err,
      );

      /*
      manually update the resource, this resets the scrapeInProgress flag and adds scrapedAt date
      selecting new resources for crawling takes scrapedAt in consideration (right now only resources with scrapedAt undefined qualify)
      because of the above behavior, we don't attempt to crawl a resource that throws an error over and over again

      in future a possible approach will be just resetting the scrapeInProgress flag
        - next crawl operation will attempt to crawl it again, but atm this will just retry the same resource over and over again
        - there is no mechanism to escape the retry loop
      resource.scrapeInProgress = false;
      await resource.update(false);
      */
      if (resource) {
        /*
        unknown error occured,
        add scrapedAt field to the current resource so it won't be crawled again, possibly ending in an infinite loop retrying again and again
        */
        await resource.update();
      }
    }

    return resourceFound ? resource : null;
  }

  async executePlugin(site: Site, resource: Resource, plugin: Plugin):Promise<void | Partial<Resource>> {
    /*
    console.info(
      `Executing plugin ${plugin.constructor.name}
      using options ${JSON.stringify(plugin.opts)}
      against resource ${JSON.stringify(resource)}
      against site ${JSON.stringify((await site.toJSONAsync()))}
      --
      `,
    );
    */

    if (plugin.opts && (plugin.opts.domRead || plugin.opts.domWrite)) {
      return this.executePluginInDom(site, resource, plugin);
    }

    // test if plugin is aplicable
    const isApplicable = await plugin.test(site, resource);
    if (isApplicable) {
      return plugin.apply(site, resource, this.browserClient);
    }

    return null;
  }

  /*
  async run the plugin in DOM
  use a block declaration in order not to polute the global namespace
  avoiding conflicts, thus redeclaration errors
  */
  async executePluginInDom(site: Site, resource: Resource, plugin: Plugin):Promise<void | Partial<Resource>> {
    // plugins running in DOM assume a valid resource has already been fetched
    if (!resource) return null;

    const pluginClsName = plugin.constructor.name;
    const pluginInstanceName = `inst${pluginClsName}`;
    const pluginCode = PluginStore.get(pluginClsName).bundle;

    console.debug(`injecting in browser tab ${pluginClsName}`);

    const code = `
     {
       (async function() {
         try {
           // instantiate plugin instance, one time only, multiple plugin invocations will retain the previous plugin state
           if (!window.${pluginInstanceName}) {
             ${pluginCode}
             window.${pluginInstanceName} = new ${pluginClsName}(${JSON.stringify(plugin.opts)})
           }

           // execute plugin
           let result;
           const isApplicable = await window.${pluginInstanceName}.test(${JSON.stringify((await site.toJSONAsync()))}, ${JSON.stringify(resource)});
           if (isApplicable) {
             result = await window.${pluginInstanceName}.apply(${JSON.stringify(site)}, ${JSON.stringify(resource)});
           }

           return result;
         }
         catch(err) {
           return {err: JSON.stringify(err, Object.getOwnPropertyNames(err))};
         }
       })();
     }
   `;

    const result = await this.browserClient.evaluate(code);

    if (result && result.err) {
      throw Error(result.err);
    }

    return result;
  }
}
