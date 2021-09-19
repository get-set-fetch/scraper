import fs from 'fs';
import path, { parse } from 'path';
import JSZip from 'jszip';
import Exporter from './Exporter';
import Resource, { ResourceQuery } from '../storage/base/Resource';

import * as MimeTypes from './MimeTypes.json';
import { getLogger } from '../logger/Logger';

/** Provides ZIP export capabilities. */
export default class ZipExporter extends Exporter {
  logger = getLogger('ZipExporter');

  zip:JSZip;
  zipIdx: number;

  getResourceQuery():Partial<ResourceQuery> {
    return { whereNotNull: [ 'data' ], cols: [ 'url', 'data', 'parent', 'contentType' ] };
  }

  async preParse():Promise<void> {
    this.zipIdx = 0;
  }

  async parse(resource: Partial<Resource>, idx: number):Promise<void> {
    // for each bulk resource read do a separate archive
    if (idx % this.opts.pageLimit === 0) {
      // close the prev archive if present
      if (this.zip) {
        await this.writeZip();
        this.zipIdx += 1;
      }

      // create a new archive
      this.zip = new JSZip();
    }

    const name = `${this.getName(resource)}.${this.getExtension(resource)}`;
    this.zip.file(name, resource.data);
  }

  async postParse() {
    await this.writeZip();
  }

  async writeZip() {
    const content = await this.zip.generateAsync({
      type: 'uint8array',
      compression: 'STORE',
    });
    fs.writeFileSync(this.getPath(), content);
  }

  getPath() {
    const { dir, name, ext } = parse(this.opts.filepath);

    const idxSuffix = this.zipIdx === 0 ? '' : `-${this.zipIdx}`;
    const zipPath = path.join(dir, `${name}${idxSuffix}${ext}`);
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
}
