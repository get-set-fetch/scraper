/* eslint-disable @typescript-eslint/no-empty-function */
import fs from 'fs';
import { assert } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import CsvExporter from '../../../src/export/CsvExporter';
import KnexSite from '../../../src/storage/knex/KnexSite';
import Exporter from '../../../src/export/Exporter';

describe('CsvExporter', () => {
  let sandbox:SinonSandbox;
  let exporter: Exporter;
  let site;
  let content: string;
  const lineSeparator = '\n';

  beforeEach(() => {
    content = '';
    sandbox = createSandbox();
    site = sandbox.createStubInstance(KnexSite);

    sandbox.stub(fs, 'createWriteStream').returns(<any>{
      write: (val: string) => {
        content += val;
      },
      close: () => {},
    });

    exporter = new CsvExporter(site, 'fileA.csv');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('array values - single selector', async () => {
    site.plugins = [ { getContentKeys: () => [ 'colA' ] } ];
    site.getPagedContent.onCall(0).returns([
      { url: 'urlA', content: [ [ 'A1 content' ], [ 'A2 content' ] ] },
      { url: 'urlB', content: [ [ 'A3 content' ] ] },
    ]);
    site.getPagedContent.onCall(1).returns([]);
    await exporter.export();

    const expectedContent = `url,colA
      urlA,"A1 content"
      urlA,"A2 content"
      urlB,"A3 content"`
      .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });

  it('array values - multiple selectors', async () => {
    site.plugins = [ { getContentKeys: () => [ 'colA', 'colB' ] } ];
    site.getPagedContent.onCall(0).returns([
      { url: 'urlA', content: [ [ 'A1 content', 'B1 content' ], [ 'A2 content', 'B2 content' ] ] },
      { url: 'urlB', content: [ [ 'A3 content', 'B3 content' ] ] },
    ]);
    site.getPagedContent.onCall(1).returns([]);
    await exporter.export();

    const expectedContent = `url,colA,colB
      urlA,"A1 content","B1 content"
      urlA,"A2 content","B2 content"
      urlB,"A3 content","B3 content"`
      .split(lineSeparator).map(csvLine => csvLine.trim()).join(lineSeparator);

    assert.strictEqual(content, expectedContent);
  });
});
