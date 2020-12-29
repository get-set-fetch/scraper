import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import Resource from '../storage/base/Resource';
import Exporter, { ExportOptions } from './Exporter';
import * as MimeTypes from './MimeTypes.json';

export type ZipExportOptions = ExportOptions & {
  type: 'zip',
  pageLimit?: number;
}
export default class ZipExporter extends Exporter {
  opts: ZipExportOptions;

  async export() {
    const { pageLimit } = this.opts;
    let pageOffset = 0;

    let resources = await this.site.getPagedResources({ whereNotNull: [ 'data' ], cols: [ 'url', 'data', 'parent', 'contentType' ], offset: pageOffset, limit: pageLimit });
    if (resources.length === 0) throw new Error('No binary content to export.');

    while (resources && resources.length > 0) {
      // create an archive for each chunk of paged resources
      const zip = new JSZip();
      resources.forEach(resource => {
        const name = `${this.getName(resource)}.${this.getExtension(resource)}`;
        zip.file(name, resource.data);
      });

      // eslint-disable-next-line no-await-in-loop
      const content = await zip.generateAsync({
        type: 'uint8array',
        compression: 'STORE',
      });

      const zipPath = this.getPath(this.filepath, pageOffset, pageLimit);
      fs.writeFileSync(zipPath, content);

      pageOffset += pageLimit;
      // eslint-disable-next-line no-await-in-loop
      resources = await this.site.getPagedResources({ whereNotNull: [ 'data' ], cols: [ 'url', 'data', 'parent', 'contentType' ], offset: pageOffset, limit: pageLimit });
    }
  }

  getPath(filepath: string, offset: number, limit: number) {
    const dirname = path.dirname(this.filepath);
    const extName = path.extname(this.filepath) || '.zip';
    const basename = path.basename(this.filepath, extName);

    const idx = offset / limit;
    const idxSuffix = idx === 0 ? '' : `-${idx}`;
    const zipPath = path.join(dirname, `${basename}${idxSuffix}${extName}`);
    return zipPath;
  }

  getName(resource: Partial<Resource>): string {
    const nameParts: string[] = [];

    // get resource name from parent metadata
    if (resource.parent) {
      const { title, linkText, imgAlt } = resource.parent;
      nameParts.push(title);
      nameParts.push(linkText);
      nameParts.push(imgAlt);

      const nonEmptyNameParts = nameParts.filter(namePart => namePart);
      if (nonEmptyNameParts.length > 0) {
        return nonEmptyNameParts.map(namePart => namePart.substr(0, 100)).join('-');
      }
    }

    // get resource name just from its url
    const nameMatch = /.+\/([^.?]+).*($|\?)/.exec(resource.url);
    if (nameMatch) {
      return nameMatch[1];
    }

    // failsafe, just return the last part of url
    return resource.url.substr(-30);
  }

  getExtension(resource: Partial<Resource>): string {
    // extension can be identified based on mime type
    if (MimeTypes[resource.contentType]) {
      return MimeTypes[resource.contentType];
    }

    // extension can be identified based on regex against url
    // have at least 2 ".", one from domain, one from extension
    const extensionMatch = /\..+.\.([^.?]+)($|\?)/.exec(resource.url);
    if (extensionMatch) {
      return extensionMatch[1];
    }

    // failed to find extension
    return 'unknown';
  }

  getDefaultOptions():ZipExportOptions {
    return {
      type: 'zip',
      pageLimit: 100,
    };
  }
}
