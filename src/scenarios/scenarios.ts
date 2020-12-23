import { IPluginOpts } from '../plugins/Plugin';
import StaticContentScenario from './StaticContentScenario';

interface IScenario {
  defaultPluginOpts:IPluginOpts[];
}

export type Scenarios = {
  [key: string] : IScenario
}

const scenarios: Scenarios = {
  'static-content': StaticContentScenario,
};

const mergePluginOpts = (defaultOpts: IPluginOpts[], customOpts: IPluginOpts[]):IPluginOpts[] => {
  const mergeOpts:IPluginOpts[] = [ ...defaultOpts ];
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
  IScenario,
  mergePluginOpts,
  scenarios,
};
