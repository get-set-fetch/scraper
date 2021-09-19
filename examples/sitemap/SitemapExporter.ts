/* eslint-disable no-await-in-loop */
import fs from 'fs';
import { Exporter, Resource, getLogger } from '../../src/index';

export default class SitemapExporter extends Exporter {
  logger = getLogger('SitemapExporter');

  wstream: fs.WriteStream;

  getResourceQuery() {
    return { cols: [ 'url' ] };
  }

  async preParse() {
    this.wstream = fs.createWriteStream(this.opts.filepath);
    this.wstream.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
  }

  async parse(resource: Partial<Resource>) {
    this.wstream.write(`<url><loc>${resource.url}</loc></url>\n`);
  }

  async postParse() {
    this.wstream.write('</urlset>');
    this.wstream.close();
  }
}
