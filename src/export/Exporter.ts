import Site from '../storage/base/Site';

export type ExportOptions = {
  type: 'csv'|'zip';
}

export default abstract class Exporter {
  site: Site;
  filepath: string;
  opts: ExportOptions;

  constructor(site:Site, filepath: string, opts: Partial<ExportOptions> = {}) {
    const mergedOpts = Object.assign(this.getDefaultOptions(), opts);

    this.opts = mergedOpts;
    this.filepath = filepath;
    this.site = site;
  }

  abstract getDefaultOptions():ExportOptions;
  abstract export():Promise<void>;
}
