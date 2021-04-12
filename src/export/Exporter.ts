import { isAbsolute, join } from 'path';
import Project from '../storage/base/Project';

export type ExportOptions = {
  type: 'csv'|'zip';
}

/** Scraped data exporters should extend this class. */
export default abstract class Exporter {
  project: Project;
  filepath: string;
  opts: ExportOptions;

  constructor(project:Project, filepath: string, opts: Partial<ExportOptions> = {}) {
    const mergedOpts = Object.assign(this.getDefaultOptions(), opts);

    this.opts = mergedOpts;
    this.filepath = isAbsolute(filepath) ? filepath : join(process.cwd(), filepath);
    this.project = project;
  }

  abstract getDefaultOptions():ExportOptions;
  abstract export():Promise<void>;
}
