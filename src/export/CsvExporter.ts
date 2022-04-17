import fs from 'fs';
import Resource, { ResourceQuery } from '../storage/base/Resource';
import Exporter, { ExportOptions } from './Exporter';
import { getLogger } from '../logger/Logger';

export type CsvExportOptions = ExportOptions & {
  fieldSeparator?: string;
  lineSeparator?: string;
}

/** Provides CSV export capabilities. */
export default class CsvExporter extends Exporter {
  logger = getLogger('CsvExporter');

  opts: CsvExportOptions;

  wstream: fs.WriteStream;

  getResourceQuery(): Partial<ResourceQuery> {
    return { whereNotNull: [ 'content' ], cols: [ 'url', 'content' ] };
  }

  async preParse(): Promise<void> {
    this.wstream = fs.createWriteStream(this.opts.filepath);

    // write csv header
    this.wstream.write([ 'url', ...this.getContentKeys() ].join(this.opts.fieldSeparator));
  }

  async parse(resource: Partial<Resource>): Promise<void> {
    const { lineSeparator } = this.opts;
    const csvRows = this.resourceToCsvRows(resource);
    this.wstream.write(lineSeparator);
    this.wstream.write(csvRows.join(lineSeparator));
  }

  async postParse() {
    this.wstream.close();
  }

  getContentKeys(): string[] {
    return this.project.plugins
      .map(plugin => plugin.getContentKeys())
      .find(contentKeys => contentKeys)
      || [];
  }

  resourceToCsvRows(resource: Partial<Resource>): string[][] {
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

  getDefaultOptions(): Partial<CsvExportOptions> {
    return {
      fieldSeparator: ',',
      lineSeparator: '\n',
      pageLimit: 10000,
    };
  }
}
