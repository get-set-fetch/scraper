/* eslint-disable no-await-in-loop */
import { isAbsolute, join } from 'path';
import { initStorage } from '../storage/storage-utils';
import { LogWrapper } from '../logger/Logger';
import Project from '../storage/base/Project';
import Storage from '../storage/base/Storage';
import Resource, { ResourceQuery } from '../storage/base/Resource';

export type ExportOptions = {
  pageLimit?: number;
  filepath: string;
}

/** Scraped data exporters should extend this class. */
export default abstract class Exporter {
  logger: LogWrapper;

  project: Project;
  opts: ExportOptions;

  constructor(opts: ExportOptions) {
    this.opts = Object.assign(this.getDefaultOptions(), opts);
    this.opts.filepath = isAbsolute(opts.filepath) ? opts.filepath : join(process.cwd(), opts.filepath);
  }

  getPagedResources(offset: number, limit: number): Promise<Partial<Resource>[]> {
    return this.project.getPagedResources({ ...this.getResourceQuery(), offset, limit });
  }

  async export(project: Project) {
    try {
      // use a separate db connection, scrape and export have different db lifecycles and may run in parallel
      const storage:Storage = initStorage(project.Constructor.storage.config);
      await storage.connect();

      // retrieve the project from the currently active db connection
      this.project = await storage.Project.get(project.id);
      if (!this.project) {
        throw new Error(`could not find project ${project.name}`);
      }

      // need to init the plugins as one of the plugins may contain info related to the exported columns
      this.project.plugins = await this.project.initPlugins(true);

      let resources: Partial<Resource>[];
      const { pageLimit: limit } = this.opts;
      let offset = 0;

      do {
        resources = await this.getPagedResources(offset, limit);

        if (offset === 0) {
          if (resources.length === 0) {
            this.logger.warn('No content to export.');
            break;
          }

          this.logger.info(`Exporting using ${this.constructor.name} under ${this.opts.filepath} ...`);
          await this.preParse();
        }

        // eslint-disable-next-line no-loop-func
        await Promise.all(resources.map((resource, idx) => this.parse(resource, offset + idx)));
        offset += limit;
      }
      while (resources.length > 0);

      if (offset > 0) {
        await this.postParse();
        this.logger.info(`Exporting using ${this.constructor.name} under ${this.opts.filepath} ... done`);
      }

      await storage.close();
    }
    catch (err) {
      this.logger.error(err, `error exporting using options ${JSON.stringify(this.opts)}`);
    }
  }

  getDefaultOptions(): Partial<ExportOptions> {
    return {
      pageLimit: 100,
    };
  }

  abstract getResourceQuery(): Partial<ResourceQuery>;

  abstract preParse(): Promise<void>;
  abstract parse(resource: Partial<Resource>, resourceIdx: number): Promise<void>;
  abstract postParse(): Promise<void>;
}
