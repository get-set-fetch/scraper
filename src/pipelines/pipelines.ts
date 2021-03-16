import { PluginOpts } from '../plugins/Plugin';
import BrowserStaticContentPipeline from './BrowserStaticContentPipeline';
import DomStaticContentPipeline from './DomStaticContentPipeline';

export type Pipeline = {
  defaultPluginOpts:PluginOpts[];
}

export type Pipelines = {
  [key: string] : Pipeline
}

/**
 * Built-in, predefined pipelines.
 * Each one defines a series of plugins with default options to be executed against each to be scraped resource.
 */
const pipelines: Pipelines = {
  'browser-static-content': BrowserStaticContentPipeline,
  'dom-static-content': DomStaticContentPipeline,
};

/**
 * Takes starting default options and overrides them with custom ones.
 * @param defaultOpts - default starting options
 * @param customOpts - override options
 */
const mergePluginOpts = (defaultOpts: PluginOpts[], customOpts: PluginOpts[] = []):PluginOpts[] => {
  const mergeOpts:PluginOpts[] = [ ...defaultOpts ];
  customOpts.forEach(pluginCustomOpts => {
    if (pluginCustomOpts.before) {
      const idx = mergeOpts.findIndex(mergePluginOpts => mergePluginOpts.name === pluginCustomOpts.before);
      if (idx === -1) throw new Error(`could not find plugin ${pluginCustomOpts.before} as before anchor`);
      mergeOpts.splice(idx, 0, pluginCustomOpts);
      return;
    }

    if (pluginCustomOpts.replace) {
      const idx = mergeOpts.findIndex(mergePluginOpts => mergePluginOpts.name === pluginCustomOpts.replace);
      if (idx === -1) throw new Error(`could not find plugin ${pluginCustomOpts.before} as replace anchor`);
      mergeOpts[idx] = pluginCustomOpts;
      return;
    }

    if (pluginCustomOpts.after) {
      const idx = mergeOpts.findIndex(mergePluginOpts => mergePluginOpts.name === pluginCustomOpts.after);
      if (idx === -1) throw new Error(`could not find plugin ${pluginCustomOpts.before} as after anchor`);
      mergeOpts.splice(idx + 1, 0, pluginCustomOpts);
      return;
    }

    const idx = mergeOpts.findIndex(mergePluginOpts => mergePluginOpts.name === pluginCustomOpts.name);
    if (idx === -1) throw new Error(`could not find plugin ${pluginCustomOpts.name} as merge anchor`);
    mergeOpts[idx] = { ...mergeOpts[idx], ...pluginCustomOpts };
  });

  return mergeOpts;
};

export {
  mergePluginOpts,
  pipelines,
};
