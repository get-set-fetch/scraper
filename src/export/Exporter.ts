import Site from '../storage/base/Site';

export type ExportOptions = {
  cols: string[];
  fieldSeparator: string;
  lineSeparator: string;
  pageLimit: number;
}

export default abstract class Exporter {
  site: Site;
  filepath: string;
  opts: ExportOptions;

  constructor(site:Site, filepath: string, opts: Partial<ExportOptions> = {}) {
    const defaultOpts:ExportOptions = {
      fieldSeparator: ',',
      lineSeparator: '\n',
      cols: [ 'url', 'content' ],
      pageLimit: 100,
    };
    const mergedOpts = Object.assign(defaultOpts, opts);

    this.opts = mergedOpts;
    this.filepath = filepath;
    this.site = site;
  }

  abstract export():Promise<void>;
}
