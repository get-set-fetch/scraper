import fs from 'fs';
import Resource from '../storage/base/Resource';
import Exporter from './Exporter';

export default class CsvExporter extends Exporter {
  async export() {
    const { lineSeparator, fieldSeparator, pageLimit } = this.opts;
    let pageOffset = 0;

    const wstream = fs.createWriteStream(this.filepath);

    // write csv header
    wstream.write([ 'url', ...this.getContentKeys() ].join(fieldSeparator));

    // write csv body
    let resources = await this.site.getPagedContent(pageOffset, pageLimit);
    while (resources && resources.length > 0) {
      resources.forEach(resource => {
        wstream.write(lineSeparator);
        const csvRows = this.resourceToCsvRows(resource);
        wstream.write(csvRows.join(lineSeparator));
      });

      pageOffset += pageLimit;
      // eslint-disable-next-line no-await-in-loop
      resources = await this.site.getPagedContent(pageOffset, pageLimit);
    }

    wstream.close();
  }

  getContentKeys() {
    const contentPlugin:any = this.site.plugins.find((plugin:any) => typeof plugin.getContentKeys === 'function');
    return contentPlugin ? contentPlugin.getContentKeys() : [];
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

    const quotedVal = contentVal.replace(/"/g, '""');
    return `"${quotedVal}"`;
  }
}
