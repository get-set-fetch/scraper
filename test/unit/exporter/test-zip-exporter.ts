/* eslint-disable @typescript-eslint/no-empty-function */
import fs from 'fs';
import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import JSZip from 'jszip';
import { join } from 'path';
import ZipExporter from '../../../src/export/ZipExporter';
import KnexProject from '../../../src/storage/knex/KnexProject';
import Exporter from '../../../src/export/Exporter';
import * as StorageUtils from '../../../src/storage/storage-utils';

describe('ZipExporter', () => {
  let sandbox:SinonSandbox;
  let exporter: Exporter;
  let writeStub;
  let project;

  beforeEach(() => {
    sandbox = createSandbox();
    project = sandbox.createStubInstance(KnexProject);
    project.Constructor.storage = { };

    sandbox.stub(StorageUtils, 'initStorage').returns({
      connect: sandbox.stub(),
      close: sandbox.stub(),
      Project: {
        get: sandbox.stub().returns(project),
      },
    } as any);

    writeStub = sandbox.stub(fs, 'writeFileSync');

    exporter = new ZipExporter({ filepath: 'archiveA.zip' });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('entry name from parent, extension from contentType', async () => {
    project.getPagedResources.onCall(0).returns([
      {
        url: 'siteA.com/bkg.png',
        data: Uint8Array.from(Buffer.from('dataA')),
        parent: { imgAlt: 'imgA', title: 'titleA', linkText: 'linkA' },
        contentType: 'image/png',
      },
    ]);
    project.getPagedResources.onCall(1).returns([]);
    await exporter.export(project);

    const [ archiveName, archiveContent ] = writeStub.getCall(0).args;
    assert.strictEqual(archiveName, join(process.cwd(), 'archiveA.zip'));

    const archive = await JSZip.loadAsync(archiveContent);
    const archiveEntries = Object.keys(archive.files).map(name => archive.files[name].name);

    assert.sameMembers([ 'titleA-linkA-imgA.png' ], archiveEntries);
  });

  it('entry name from url, extension from url', async () => {
    project.getPagedResources.onCall(0).returns([
      {
        url: 'siteA.com/report.pdf',
        data: Uint8Array.from(Buffer.from('dataA')),
        contentType: 'NotPresentInMimeTypes',
      },
    ]);
    project.getPagedResources.onCall(1).returns([]);
    await exporter.export(project);

    const [ archiveName, archiveContent ] = writeStub.getCall(0).args;
    assert.strictEqual(archiveName, join(process.cwd(), 'archiveA.zip'));

    const archive = await JSZip.loadAsync(archiveContent);
    const archiveEntries = Object.keys(archive.files).map(name => archive.files[name].name);

    assert.sameMembers([ 'report.pdf' ], archiveEntries);
  });

  it('entry name from url, extension from url, multiple archives', async () => {
    project.getPagedResources.onCall(0).returns([
      {
        url: 'siteA.com/report.pdf',
        data: Uint8Array.from(Buffer.from('dataA')),
        contentType: 'NotPresentInMimeTypes',
      },
    ]);
    project.getPagedResources.onCall(1).returns([
      {
        url: 'siteA.com/animation.gif',
        data: Uint8Array.from(Buffer.from('dataA')),
        contentType: 'NotPresentInMimeTypes',
      },
    ]);
    project.getPagedResources.onCall(2).returns([]);
    await exporter.export(project);

    let [ archiveName, archiveContent ] = writeStub.getCall(0).args;
    let archive = await JSZip.loadAsync(archiveContent);
    let archiveEntries = Object.keys(archive.files).map(name => archive.files[name].name);

    assert.strictEqual(archiveName, join(process.cwd(), 'archiveA.zip'));
    assert.sameMembers([ 'report.pdf' ], archiveEntries);

    [ archiveName, archiveContent ] = writeStub.getCall(1).args;
    archive = await JSZip.loadAsync(archiveContent);
    archiveEntries = Object.keys(archive.files).map(name => archive.files[name].name);

    assert.strictEqual(archiveName, join(process.cwd(), 'archiveA-1.zip'));
    assert.sameMembers([ 'animation.gif' ], archiveEntries);
  });
});
