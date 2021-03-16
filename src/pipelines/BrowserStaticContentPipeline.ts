import { Pipeline } from './pipelines';

const pipeline:Pipeline = {
  defaultPluginOpts: [
    {
      name: 'BrowserFetchPlugin',
    },
    {
      name: 'ExtractUrlsPlugin',
    },
    {
      name: 'ExtractHtmlContentPlugin',
    },
    {
      name: 'InsertResourcesPlugin',
    },
    {
      name: 'UpsertResourcePlugin',
    },
  ],

};

export default pipeline;
