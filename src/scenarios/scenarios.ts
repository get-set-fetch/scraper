import { IPluginOpts } from '../plugins/Plugin';
import ScrapeStaticContent from './ScrapeStaticContent';

interface IScenario {
  defaultPluginOpts:IPluginOpts[];
}

const scenarios: {[key: string] : IScenario} = {
  ScrapeStaticContent,
};

const mergePluginOpts = (defaultOpts: IPluginOpts[], customOpts: IPluginOpts[]):IPluginOpts[] => defaultOpts.map(defaultOpt => {
  const customOpt = customOpts.find(opt => opt.name === defaultOpt.name) || {};
  return { ...defaultOpt, ...customOpt };
});

export {
  IScenario,
  mergePluginOpts,
  scenarios,
};
