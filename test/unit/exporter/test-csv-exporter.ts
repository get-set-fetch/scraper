import fs from 'fs';
import { assert } from 'chai';
import {SinonSandbox, createSandbox} from 'sinon';
import CsvExporter from '../../../src/export/CsvExporter';
import KnexSite from '../../../src/storage/knex/KnexSite';
import Exporter from '../../../src/export/Exporter';

describe('CsvExporter', () => {
  let sandbox:SinonSandbox;
  let exporter: Exporter;
  let site;
  let content: string;
  let lineSeparator = '\n';

  beforeEach(() => {
    content = '';
    sandbox = createSandbox();
    site = sandbox.createStubInstance(KnexSite);

    sandbox.stub(fs, "createWriteStream").returns(<any>{
      write: (val: string) => {
        content += val;
      },
      close: () => {}
    })
    
    exporter = new CsvExporter(site, 'fileA.csv');
  })

  afterEach( () => {
    sandbox.restore();
  })

  it('scalar values', async () => {
    site.getPagedContent.onCall(0).returns([
      { url: 'urlA', content: 'A "content"' },
      { url: 'urlB', content: 'B " content' },
    ])
    site.getPagedContent.onCall(1).returns([]);
    await exporter.export();

    const expectedContent = `url,content
      "urlA","A ""content"""
      "urlB","B "" content"`
    .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });

  it('array values', async () => {
    site.getPagedContent.onCall(0).returns([
      { url: 'urlA', content: [ 'A1 content', 'A2 content' ] },
      { url: 'urlB', content: [ 'B content' ] },
    ])
    site.getPagedContent.onCall(1).returns([]);
    await exporter.export();

    const expectedContent = `url,content
      "urlA","A1 content"
      "urlA","A2 content"
      "urlB","B content"`
    .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });

  it('nested obj values', async () => {
    site.getPagedContent.onCall(0).returns([
      { url: 'urlA', content: { arr: [ 'A-arr1', 'A-arr2' ], propB: 'A-propB' } },
      { url: 'urlB', content: { arr: [ 'B-arr1' ], propC: 'B-propC' } },
    ])
    site.getPagedContent.onCall(1).returns([
      { url: 'urlC', content: { arr: [ 'C-arr1', 'C-arr2', 'C-arr3' ], propC: 'C-propC' } },
    ]);
    site.getPagedContent.onCall(2).returns([]);
    await exporter.export();

    const expectedContent = `url,content.arr,content.propB,content.propC
      "urlA","A-arr1","A-propB",""
      "urlA","A-arr2","A-propB",""
      "urlB","B-arr1","","B-propC"
      "urlC","C-arr1","","C-propC"
      "urlC","C-arr2","","C-propC"
      "urlC","C-arr3","","C-propC"`
    .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });

  


});
