import Project from '../storage/base/Project';

export type ExportOptions = {
  type: 'csv'|'zip';
}

export default abstract class Exporter {
  project: Project;
  filepath: string;
  opts: ExportOptions;

  constructor(project:Project, filepath: string, opts: Partial<ExportOptions> = {}) {
    const mergedOpts = Object.assign(this.getDefaultOptions(), opts);

    this.opts = mergedOpts;
    this.filepath = filepath;
    this.project = project;
  }

  abstract getDefaultOptions():ExportOptions;
  abstract export():Promise<void>;
}
