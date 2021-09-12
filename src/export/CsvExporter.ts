import fs from 'fs';
import Resource from '../storage/base/Resource';
import Exporter, { ExportOptions } from './Exporter';
import { getLogger } from '../logger/Logger';

export type CsvExportOptions = ExportOptions & {
  type: 'csv',
  cols?: string[];
  fieldSeparator?: string;
  lineSeparator?: string;
}

/** Provides CSV export capabilities. */
export default class CsvExporter extends Exporter {
  logger = getLogger('CsvExporter');

  opts: CsvExportOptions;

  async export() {
    this.logger.info(`Exporting as ${this.opts.type} under ${this.filepath} ...`);

    const { lineSeparator, fieldSeparator, pageLimit } = this.opts;
    let pageOffset = 0;

    let resources = await this.project.getPagedResources({ whereNotNull: [ 'content' ], offset: pageOffset, limit: pageLimit });
    if (resources.length === 0) {
      this.logger.warn('No csv content to export.');
      return;
    }

    const wstream = fs.createWriteStream(this.filepath);

    // write csv header
    wstream.write([ 'url', ...this.getContentKeys() ].join(fieldSeparator));

    // write csv body
    while (resources && resources.length > 0) {
      resources.forEach(resource => {
        wstream.write(lineSeparator);
        const csvRows = this.resourceToCsvRows(resource);
        wstream.write(csvRows.join(lineSeparator));
      });

      pageOffset += pageLimit;
      // eslint-disable-next-line no-await-in-loop
      resources = await this.project.getPagedResources({ whereNotNull: [ 'content' ], offset: pageOffset, limit: pageLimit });
    }

    wstream.close();

    this.logger.info(`Exporting as ${this.opts.type} under ${this.filepath} ... done`);
  }

  getContentKeys():string[] {
    return this.project.plugins
      .map(plugin => plugin.getContentKeys())
      .find(contentKeys => contentKeys)
    || [];
  }

  resourceToCsvRows(resource: Partial<Resource>):string[][] {
    const { url, content } = resource;

    const csvRows: string[][] = [];
    content.forEach(contentRowVal => {
      const csvRow = [ url ];
      contentRowVal.forEach(contentColVal => {
        csvRow.push(this.getCsvVal(contentColVal));
      });
      csvRows.push(csvRow);
    });

    // no content for current resource, add a [url] entry
    if (csvRows.length === 0) {
      csvRows.push([ url ]);
    }

    return csvRows;
  }

  getCsvVal(contentVal: string) {
    /*
    quotes handling
    RFC-4180 "If double-quotes are used to enclose fields,
    then a double-quote appearing inside a field must be escaped by preceding it with another double quote."
    */
    if (contentVal === undefined) {
      return '""';
    }

    if (typeof contentVal === 'string') {
      const quotedVal = contentVal.replace(/"/g, '""');
      return `"${quotedVal}"`;
    }

    return contentVal;
  }

  getDefaultOptions():CsvExportOptions {
    return {
      type: 'csv',
      fieldSeparator: ',',
      lineSeparator: '\n',
      cols: [ 'url', 'content' ],
      pageLimit: 100,
    };
  }
}
