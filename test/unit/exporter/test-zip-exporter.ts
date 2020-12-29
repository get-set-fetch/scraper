/* eslint-disable @typescript-eslint/no-empty-function */
import fs from 'fs';
import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import JSZip from 'jszip';
import ZipExporter from '../../../src/export/ZipExporter';
import KnexSite from '../../../src/storage/knex/KnexSite';
import Exporter from '../../../src/export/Exporter';

describe('ZipExporter', () => {
  let sandbox:SinonSandbox;
  let exporter: Exporter;
  let writeStub;
  let site;

  beforeEach(() => {
    sandbox = createSandbox();
    site = sandbox.createStubInstance(KnexSite);
    writeStub = sandbox.stub(fs, 'writeFileSync');

    exporter = new ZipExporter(site, 'archiveA.zip');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('entry name from parent, extension from contentType', async () => {
    site.getPagedResources.onCall(0).returns([
      {
        url: 'siteA.com/bkg.png',
        data: Uint8Array.from(Buffer.from('dataA')),
        parent: { imgAlt: 'imgA', title: 'titleA', linkText: 'linkA' },
        contentType: 'image/png',
      },
    ]);
    site.getPagedResources.onCall(1).returns([]);
    await exporter.export();

    const [ archiveName, archiveContent ] = writeStub.getCall(0).args;
    assert.strictEqual(archiveName, 'archiveA.zip');

    const archive = await JSZip.loadAsync(archiveContent);
    const archiveEntries = Object.keys(archive.files).map(name => archive.files[name].name);

    assert.sameMembers([ 'titleA-linkA-imgA.png' ], archiveEntries);
  });

  it('entry name from url, extension from url', async () => {
    site.getPagedResources.onCall(0).returns([
      {
        url: 'siteA.com/report.pdf',
        data: Uint8Array.from(Buffer.from('dataA')),
        contentType: 'NotPresentInMimeTypes',
      },
    ]);
    site.getPagedResources.onCall(1).returns([]);
    await exporter.export();

    const [ archiveName, archiveContent ] = writeStub.getCall(0).args;
    assert.strictEqual(archiveName, 'archiveA.zip');

    const archive = await JSZip.loadAsync(archiveContent);
    const archiveEntries = Object.keys(archive.files).map(name => archive.files[name].name);

    assert.sameMembers([ 'report.pdf' ], archiveEntries);
  });

  it('entry name from url, extension from url, multiple archives', async () => {
    site.getPagedResources.onCall(0).returns([
      {
        url: 'siteA.com/report.pdf',
        data: Uint8Array.from(Buffer.from('dataA')),
        contentType: 'NotPresentInMimeTypes',
      },
    ]);
    site.getPagedResources.onCall(1).returns([
      {
        url: 'siteA.com/animation.gif',
        data: Uint8Array.from(Buffer.from('dataA')),
        contentType: 'NotPresentInMimeTypes',
      },
    ]);
    site.getPagedResources.onCall(2).returns([]);
    await exporter.export();

    let [ archiveName, archiveContent ] = writeStub.getCall(0).args;
    let archive = await JSZip.loadAsync(archiveContent);
    let archiveEntries = Object.keys(archive.files).map(name => archive.files[name].name);

    assert.strictEqual(archiveName, 'archiveA.zip');
    assert.sameMembers([ 'report.pdf' ], archiveEntries);

    [ archiveName, archiveContent ] = writeStub.getCall(1).args;
    archive = await JSZip.loadAsync(archiveContent);
    archiveEntries = Object.keys(archive.files).map(name => archive.files[name].name);

    assert.strictEqual(archiveName, 'archiveA-1.zip');
    assert.sameMembers([ 'animation.gif' ], archiveEntries);
  });
});
