import { Pipeline } from './pipelines';

const pipeline:Pipeline = {
  defaultPluginOpts: [
    {
      name: 'NodeFetchPlugin',
    },
    {
      name: 'ExtractUrlsPlugin',
      domRead: false,
    },
    {
      name: 'ExtractHtmlContentPlugin',
      domRead: false,
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
